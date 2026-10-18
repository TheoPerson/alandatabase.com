import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, PlaybackSession, StartSessionRequest } from '$lib/media/types';
import { CAPS_OVERRIDE_KEY } from './caps';
import { createHqpEngine } from './engine';
import { HQP_PREFS_KEY } from './prefs';
import { FakeHls } from './testing/fake-hls';
import { createFakeMedia, type FakeMediaSession, type FakeWakeLock } from './testing/fake-media';
import type { CapsProbe, HqpItem, HqpLaunchPayload, HqpPrefs, Readable } from './types';

class MemoryStorage {
	map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	setItem(key: string, value: string) {
		this.map.set(key, String(value));
	}
}

const appleProbe = (): CapsProbe => ({
	vendor: 'Apple Computer, Inc.',
	canPlayType: () => 'maybe',
	mseIsTypeSupported: () => true,
	hlsJsSupported: true,
	matchMedia: (q) => q === '(dynamic-range: high)',
	decodingInfo: async () => ({ supported: true, powerEfficient: true })
});

const chromeProbe = (): CapsProbe => ({
	vendor: 'Google Inc.',
	canPlayType: () => '',
	mseIsTypeSupported: (t) => !/ac-3|ec-3/.test(t),
	hlsJsSupported: true,
	matchMedia: () => false,
	decodingInfo: null
});

function episode(n: number, over: Partial<HqpItem> = {}): HqpItem {
	return {
		fileId: `f${n}`,
		kind: 'episode',
		title: `Episode ${n}`,
		showTitle: 'The Show',
		seasonNumber: 1,
		episodeNumber: n,
		overview: null,
		year: 2025,
		runtimeMinutes: 60,
		originalLanguage: 'en',
		artwork: { stillPath: `/s${n}.jpg`, backdropPath: null, posterPath: null, logoPath: null },
		titleHref: '/tv/1?season=1',
		file: {
			fileId: `f${n}`,
			durationSeconds: 3600,
			resolution: '2160p',
			hdr: 'hdr10',
			audio: [
				{ ordinal: 0, language: 'fre', title: 'VFF', channels: 6 },
				{ ordinal: 1, language: 'eng', title: null, channels: 6 }
			],
			subtitles: [
				{ ordinal: 0, language: 'fre', title: 'Forcés', forced: true, isText: true },
				{ ordinal: 1, language: 'fre', title: null, forced: false, isText: true },
				{ ordinal: 2, language: 'eng', title: 'SDH', forced: false, isText: true },
				{ ordinal: 3, language: 'fre', title: 'PGS', forced: false, isText: false }
			]
		},
		progress: null,
		...over
	};
}

function makeSession(
	id: string,
	req: StartSessionRequest,
	over: Partial<PlaybackSession> = {}
): PlaybackSession {
	const labels = ['French forced', 'French', 'English SDH'];
	const langs = ['fre', 'fre', 'eng'];
	return {
		sessionId: id,
		playlistUrl: `/api/media/sessions/${id}/index.m3u8`,
		masterPlaylistUrl: `/api/media/sessions/${id}/master.m3u8`,
		durationSeconds: 3600,
		segmentSeconds: 4,
		startSeconds: req.startSeconds ?? 0,
		audio: req.audio ?? 0,
		audioTracks: [
			{ ordinal: 0, label: 'French · VFF 5.1', language: 'fre' },
			{ ordinal: 1, label: 'English 5.1', language: 'eng' }
		],
		subtitleTracks: [0, 1, 2].map((o) => ({
			ordinal: o,
			label: labels[o],
			language: langs[o],
			url: `/api/media/files/${req.fileId}/subtitles/${o}.vtt`,
			forced: o === 0
		})),
		video: {
			mode: 'copy',
			codec: 'hevc',
			width: 3840,
			height: 2160,
			hdr: true,
			reason: 'Original stream'
		},
		quality: req.quality ?? 'original',
		qualities: ['original', '1080p', '720p'],
		audioMode: 'copy',
		chaptersUrl: `/api/media/files/${req.fileId}/chapters`,
		trickplayUrl: `/api/media/files/${req.fileId}/trickplay.json`,
		...over
	};
}

const res = (status: number, body?: unknown) =>
	({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

const TRICKPLAY = {
	status: 'ready',
	intervalSeconds: 10,
	tileWidth: 240,
	tileHeight: 135,
	columns: 10,
	rows: 10,
	sheets: ['/api/media/files/f1/trickplay/0.webp']
};

interface Options {
	probe?: () => CapsProbe;
	post?: (req: StartSessionRequest, n: number) => Response | 'throw' | null;
	chapters?: Chapter[];
	prefs?: Partial<HqpPrefs>;
	queue?: HqpItem[];
	index?: number;
	session?: (n: number) => Partial<PlaybackSession>;
}

function get<T>(store: Readable<T>): T {
	let value!: T;
	store.subscribe((v) => (value = v))();
	return value;
}

const flush = async () => {
	for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

function setup(o: Options = {}) {
	const media = createFakeMedia();
	const requests: Array<{
		method: string;
		url: string;
		body: Record<string, unknown> | null;
		keepalive: boolean;
	}> = [];
	let posts = 0;
	const storage = new MemoryStorage();
	if (o.prefs) storage.setItem(HQP_PREFS_KEY, JSON.stringify({ version: 1, ...o.prefs }));
	const sessionStorage = new MemoryStorage();
	const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
		const method = init.method ?? 'GET';
		const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
		requests.push({ method, url, body, keepalive: !!init.keepalive });
		if (method === 'POST') {
			posts++;
			const custom = o.post?.(body, posts);
			if (custom === 'throw') throw new TypeError('Failed to fetch');
			if (custom) return custom;
			return res(201, makeSession(`s${posts}`, body, o.session?.(posts)));
		}
		if (method === 'DELETE' || method === 'PUT') return res(204);
		if (url.endsWith('/chapters')) return res(200, o.chapters ?? []);
		if (url.endsWith('/trickplay.json')) return res(200, TRICKPLAY);
		return res(200, '');
	});
	const onItemChange = vi.fn();
	const engine = createHqpEngine({
		fetch: fetch as never,
		storage: storage as unknown as Storage,
		sessionStorage: sessionStorage as unknown as Storage,
		probe: o.probe ?? appleProbe,
		loadHls: async () => FakeHls as never,
		onItemChange
	});
	engine.attach(media);
	const payload: HqpLaunchPayload = {
		queue: o.queue ?? [episode(1), episode(2), episode(3)],
		index: o.index ?? 0,
		returnHref: '/tv/1'
	};
	const state = () => get(engine.snapshot);
	const posted = () =>
		requests.filter((r) => r.method === 'POST').map((r) => r.body ?? {}) as Array<
			Record<string, unknown>
		>;
	const deleted = () => requests.filter((r) => r.method === 'DELETE');
	const puts = () =>
		requests
			.filter((r) => r.method === 'PUT')
			.map((r) => ({ ...r, body: (r.body ?? {}) as Record<string, unknown> }));
	return {
		media,
		engine,
		fetch,
		requests,
		storage,
		sessionStorage,
		onItemChange,
		payload,
		state,
		posted,
		deleted,
		puts
	};
}

type H = ReturnType<typeof setup>;

/** Loads, delivers metadata at the start position and plays. */
async function start(h: H, options?: Parameters<H['engine']['load']>[1], position?: number) {
	const loading = h.engine.load(h.payload, options);
	await flush();
	await loading;
	await ready(h, position);
}

async function ready(h: H, position?: number) {
	if (position !== undefined) h.media.currentTime = position;
	h.media.fake.loadMetadata(3600);
	h.media.fake.ready();
	await flush();
	h.media.emit('playing');
}

/** Plays forward to `position` with a timeupdate. */
function playTo(h: H, position: number) {
	h.media.currentTime = position;
	h.media.emit('timeupdate');
}

beforeEach(() => {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
		now: 1_800_000_000_000
	});
	FakeHls.reset();
});
afterEach(() => vi.useRealTimers());

describe('load', () => {
	it('posts caps and the preferred audio, attaches native HLS, resumes and sets the notice', async () => {
		const h = setup({ prefs: { audioLanguage: 'eng' } });
		h.payload.queue[0] = episode(1, {
			progress: {
				fileId: 'f1',
				positionSeconds: 600,
				durationSeconds: 3600,
				completed: false,
				updatedAt: '2026-10-16T20:00:00Z'
			}
		});
		const loading = h.engine.load(h.payload);
		expect(h.state().status).toBe('starting');
		await flush();
		await loading;
		expect(h.posted()).toEqual([
			{
				fileId: 'f1',
				audio: 1,
				caps: expect.objectContaining({
					nativeHls: true,
					hevcMain10: true,
					av1: true,
					eac3: true,
					ac3: true,
					hdrDisplay: true,
					multichannel: true,
					maxHeight: null
				}),
				quality: 'original',
				startSeconds: 600
			}
		]);
		expect(h.state()).toMatchObject({ status: 'loading', delivery: 'native', hdrShown: true });
		expect(h.media.src).toBe('/api/media/sessions/s1/master.m3u8');
		expect(FakeHls.instances).toHaveLength(0);

		h.media.fake.loadMetadata(3600);
		expect(h.media.currentTime).toBe(600);
		h.media.fake.ready();
		await flush();
		expect(h.media.fake.calls.play).toBe(1);
		h.media.emit('playing');
		expect(h.state().status).toBe('playing');
		expect(h.state().resume).toEqual({ from: 600, until: Date.now() + 6000 });
		expect(h.state().announcement?.text).toBe('Resumed at 10:00');
		vi.advanceTimersByTime(6000);
		expect(h.state().resume).toBeNull();
	});

	it('merges tracks: English audio picks the full French subtitles; image tracks stay unselectable', async () => {
		const h = setup({ prefs: { audioLanguage: 'eng' } });
		await start(h);
		const s = h.state();
		expect(s.audio.mode).toBe('copy');
		expect(s.audio.options.map((a) => [a.ordinal, a.selected, a.isOriginal, a.channels])).toEqual([
			[0, false, false, 6],
			[1, true, true, 6]
		]);
		expect(s.subtitles.options.map((o) => [o.ordinal, o.isText, o.forced, o.sdh, !!o.url])).toEqual(
			[
				[0, true, true, false, true],
				[1, true, false, false, true],
				[2, true, false, true, true],
				[3, false, false, false, false]
			]
		);
		expect(s.subtitles).toMatchObject({ selected: 1, forced: null, offsetSeconds: 0 });
		const tracks = h.media.fake.tracks;
		expect(tracks.map((t) => [t.kind, t.src, t.srclang, t.track.mode])).toEqual([
			// Only the shown track loads; the others stay disabled until chosen.
			['subtitles', '/api/media/files/f1/subtitles/0.vtt', 'fr', 'disabled'],
			['subtitles', '/api/media/files/f1/subtitles/1.vtt', 'fr', 'hidden'],
			['subtitles', '/api/media/files/f1/subtitles/2.vtt', 'en', 'disabled']
		]);
		expect(h.requests.filter((r) => r.url.endsWith('/chapters'))).toHaveLength(1);
	});

	it('keeps the WebVTT tracks unloaded until the first frame plays (the first segment comes first)', async () => {
		const h = setup();
		const loading = h.engine.load(h.payload);
		await flush();
		await loading;
		h.media.fake.loadMetadata(3600);
		h.media.fake.ready();
		await flush();
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'disabled',
			'disabled',
			'disabled'
		]);
		h.media.emit('playing');
		// French audio: the forced French track is the one shown.
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'hidden',
			'disabled',
			'disabled'
		]);
		// A switch attaches the new source with every track disabled (a loading track would hold
		// the new source at HAVE_CURRENT_DATA), then re-enables the shown one once it plays.
		playTo(h, 100);
		const switching = h.engine.setQuality('1080p');
		await flush();
		await switching;
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'disabled',
			'disabled',
			'disabled'
		]);
		h.media.emit('playing');
		// French audio: the forced French track is the one shown.
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'hidden',
			'disabled',
			'disabled'
		]);
		// Choosing another track loads only that one.
		h.engine.setSubtitles(2);
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'disabled',
			'disabled',
			'hidden'
		]);
	});

	it('uses hls.js light (and only there) with the start position on Chrome', async () => {
		const h = setup({ probe: chromeProbe });
		h.payload.queue[0] = episode(1, {
			progress: {
				fileId: 'f1',
				positionSeconds: 900,
				durationSeconds: 3600,
				completed: false,
				updatedAt: ''
			}
		});
		await start(h, undefined, 900);
		expect(h.posted()[0].caps).toMatchObject({
			nativeHls: false,
			eac3: false,
			ac3: false,
			multichannel: false
		});
		expect(FakeHls.instances).toHaveLength(1);
		expect(FakeHls.instances[0].config.startPosition).toBe(900);
		expect(FakeHls.instances[0].source).toBe('/api/media/sessions/s1/index.m3u8');
		expect(h.state()).toMatchObject({ status: 'playing', delivery: 'hls.js', hdrShown: false });
	});

	it('honours startAt and autoplay false', async () => {
		const h = setup();
		await start(h, { startAt: 120, autoplay: false });
		expect(h.posted()[0].startSeconds).toBe(120);
		expect(h.media.fake.calls.play).toBe(0);
		expect(h.state().resume).toBeNull();
	});

	it('a rejected play() marks autoplay as blocked; play() later succeeds', async () => {
		const h = setup();
		h.media.fake.rejectPlay = new DOMException('blocked', 'NotAllowedError');
		const loading = h.engine.load(h.payload);
		await flush();
		await loading;
		h.media.fake.loadMetadata(3600);
		h.media.fake.ready();
		await flush();
		expect(h.state()).toMatchObject({ status: 'paused', autoplayBlocked: true });
		await h.engine.play();
		h.media.emit('playing');
		expect(h.state()).toMatchObject({ status: 'playing', autoplayBlocked: false });
	});

	it('reports unsupported browsers without calling the server', async () => {
		const h = setup({
			probe: () => ({ ...chromeProbe(), mseIsTypeSupported: null, hlsJsSupported: false })
		});
		await h.engine.load(h.payload);
		expect(h.state().error).toMatchObject({ code: 'unsupported' });
		expect(h.posted()).toEqual([]);
	});

	it('requires attach() before load()', async () => {
		const engine = createHqpEngine({
			fetch: vi.fn() as never,
			storage: null,
			sessionStorage: null
		});
		await expect(engine.load({ queue: [episode(1)], index: 0, returnHref: '/' })).rejects.toThrow(
			/attach/
		);
	});
});

describe('errors', () => {
	it('maps a 503 to library-offline with the server message, and retry() starts again', async () => {
		const h = setup({
			post: (_req, n) => (n === 1 ? res(503, { error: 'Streaming is turned off' }) : null)
		});
		await h.engine.load(h.payload);
		await flush();
		expect(h.state()).toMatchObject({
			status: 'error',
			error: { code: 'library-offline', status: 503, message: 'Streaming is turned off' }
		});
		const retrying = h.engine.retry();
		await flush();
		await retrying;
		await ready(h);
		expect(h.state()).toMatchObject({ status: 'playing', error: null });
	});

	it('a retried first load starts at the intended resume point', async () => {
		const h = setup({ post: (_req, n) => (n === 1 ? res(503, { error: 'off' }) : null) });
		h.payload.queue[0] = episode(1, {
			progress: {
				fileId: 'f1',
				positionSeconds: 600,
				durationSeconds: 3600,
				completed: false,
				updatedAt: ''
			}
		});
		await h.engine.load(h.payload);
		const retrying = h.engine.retry();
		await flush();
		await retrying;
		expect(h.posted().map((b) => b.startSeconds)).toEqual([600, 600]);
	});

	it.each([
		[401, 'unauthorized'],
		[403, 'forbidden'],
		[404, 'not-found'],
		[409, 'gone'],
		[400, 'bad-request']
	] as const)('maps %i to %s', async (status, code) => {
		const h = setup({ post: () => res(status, { error: 'nope' }) });
		await h.engine.load(h.payload);
		expect(h.state().error).toMatchObject({ code, status });
	});

	it('retries a session start offline with 2/4/8/16/30 s backoff, then fails after 60 s', async () => {
		const h = setup({ post: () => 'throw' });
		const loading = h.engine.load(h.payload);
		await flush();
		expect(h.state()).toMatchObject({ status: 'starting', online: false });
		for (const delay of [2000, 4000, 8000, 16000, 30000]) {
			await vi.advanceTimersByTimeAsync(delay);
			await flush();
		}
		await loading;
		expect(h.posted()).toHaveLength(6);
		expect(h.state().error).toMatchObject({ code: 'network' });
	});

	it('an expired hls.js session (404) restarts a session at the position', async () => {
		const h = setup({ probe: chromeProbe });
		await start(h, undefined, 0);
		playTo(h, 1500);
		FakeHls.instances[0].error('networkError', 'fragLoadError', 404);
		await flush();
		expect(h.posted().at(-1)).toMatchObject({ startSeconds: 1500 });
		expect(FakeHls.instances).toHaveLength(2);
		expect(FakeHls.instances[0].destroyed).toBe(true);
	});

	it('native: a source error probes the playlist; a gone session restarts, a 503 fails', async () => {
		const h = setup();
		await start(h);
		playTo(h, 300);
		h.fetch.mockImplementationOnce(async () => res(404));
		h.media.fake.error = { code: 4, message: '' };
		h.media.emit('error');
		await flush();
		expect(h.posted()).toHaveLength(2);
		expect(h.posted()[1].startSeconds).toBe(300);
		await ready(h);
		h.fetch.mockImplementationOnce(async () => res(503));
		h.media.emit('error');
		await flush();
		expect(h.state().error).toMatchObject({ code: 'library-offline' });
	});
});

describe('switching', () => {
	it('setAudio restarts at the position, deletes the old session and keeps the language', async () => {
		const h = setup();
		await start(h);
		playTo(h, 1234);
		const switching = h.engine.setAudio(1);
		expect(h.state().status).toBe('switching');
		expect(h.state().toasts.at(-1)?.text).toBe('Switching to English 5.1…');
		await flush();
		await switching;
		expect(h.posted()[1]).toMatchObject({ fileId: 'f1', audio: 1, startSeconds: 1234 });
		expect(h.deleted()).toEqual([
			{ method: 'DELETE', url: '/api/media/sessions/s1', body: null, keepalive: true }
		]);
		expect(h.media.src).toBe('/api/media/sessions/s2/master.m3u8');
		h.media.fake.loadMetadata(3600);
		expect(h.media.currentTime).toBe(1234);
		h.media.fake.ready();
		await flush();
		h.media.emit('playing');
		expect(h.state().status).toBe('playing');
		expect(h.state().audio.options.find((a) => a.selected)?.ordinal).toBe(1);
		expect(get(h.engine.prefs).audioLanguage).toBe('eng');
		// Auto policy: English audio now shows the full French track.
		expect(h.state().subtitles).toMatchObject({ selected: 1, forced: null });
		// Same subtitle files: the <track> elements are kept.
		expect(h.media.fake.tracks).toHaveLength(3);
	});

	it('setQuality keeps the position and the paused state', async () => {
		const h = setup();
		await start(h);
		playTo(h, 700);
		h.engine.pause();
		expect(h.state().status).toBe('paused');
		const switching = h.engine.setQuality('720p');
		await flush();
		await switching;
		expect(h.posted()[1]).toMatchObject({ quality: '720p', startSeconds: 700 });
		h.media.fake.loadMetadata(3600);
		h.media.fake.ready();
		await flush();
		expect(h.media.fake.calls.play).toBe(1);
		expect(h.state()).toMatchObject({
			status: 'paused',
			quality: { choice: '720p', active: '720p' }
		});
		expect(get(h.engine.prefs).quality).toBe('720p');
	});

	it('a failed switch restores the previous choice and shows the error', async () => {
		const h = setup({ post: (_r, n) => (n === 2 ? res(503, { error: 'Library offline' }) : null) });
		await start(h);
		playTo(h, 50);
		await h.engine.setQuality('1080p');
		await flush();
		expect(h.state()).toMatchObject({
			status: 'playing',
			quality: { choice: 'auto', active: 'original' }
		});
		expect(get(h.engine.prefs).quality).toBe('auto');
		expect(h.state().toasts.at(-1)).toMatchObject({ kind: 'error' });
		expect(h.state().toasts.at(-1)?.text).toContain('Library offline');
		expect(h.deleted()).toEqual([]);
	});

	it('events of the previous source during a switch do not change the status', async () => {
		let release: (r: Response) => void = () => {};
		const h = setup({
			post: (_r, n) => (n === 2 ? (new Promise((r) => (release = r)) as never) : null)
		});
		await start(h);
		playTo(h, 400);
		const switching = h.engine.setQuality('1080p');
		await flush();
		h.media.emit('waiting');
		h.media.emit('canplay');
		h.media.emit('playing');
		expect(h.state().status).toBe('switching');
		release(
			res(
				201,
				makeSession('s2', {
					fileId: 'f1',
					audio: 0,
					caps: {} as never,
					quality: '1080p',
					startSeconds: 400
				})
			)
		);
		await flush();
		await switching;
		h.media.fake.loadMetadata(3600);
		h.media.fake.ready();
		await flush();
		h.media.emit('playing');
		expect(h.state()).toMatchObject({ status: 'playing', quality: { active: '1080p' } });
	});

	it('moving to the next item pauses the previous native source at once', async () => {
		const h = setup();
		await start(h);
		playTo(h, 1000);
		const moving = h.engine.next();
		expect(h.media.paused).toBe(true);
		await flush();
		await moving;
		expect(h.state()).toMatchObject({ index: 1, status: 'loading' });
	});

	it('subtitle switches are instant: no new session', async () => {
		const h = setup();
		await start(h);
		expect(h.state().subtitles).toMatchObject({ selected: null, forced: 0 });
		h.engine.setSubtitles(2);
		expect(h.state().subtitles).toMatchObject({ selected: 2, forced: null });
		expect(get(h.engine.prefs)).toMatchObject({ subtitleMode: 'on', subtitleLanguage: 'eng' });
		h.engine.setSubtitles(3);
		expect(h.state().subtitles.selected).toBe(2);
		h.engine.toggleSubtitles();
		expect(h.state().subtitles).toMatchObject({ selected: null, forced: 0 });
		expect(get(h.engine.prefs).subtitleMode).toBe('off');
		h.engine.toggleSubtitles();
		expect(h.state().subtitles.selected).toBe(2);
		expect(h.posted()).toHaveLength(1);
	});
});

describe('subtitle cues', () => {
	it('emits spans from the shown track and shifts cue times by the offset', async () => {
		const h = setup();
		await start(h);
		h.engine.setSubtitles(1);
		const [, fr] = h.media.fake.tracks;
		const cue = { id: 'c1', startTime: 10, endTime: 12, text: '<i>Bonjour</i> & <b>salut</b>' };
		fr.load([cue]);
		fr.track.setActive([cue]);
		expect(get(h.engine.cues)).toEqual([
			{
				id: 'c1',
				lines: [
					[
						{ text: 'Bonjour', italic: true, bold: false },
						{ text: ' & ', italic: false, bold: false },
						{ text: 'salut', italic: false, bold: true }
					]
				]
			}
		]);
		h.engine.setSubtitleOffset(0.54);
		expect(h.state().subtitles.offsetSeconds).toBe(0.5);
		expect(cue).toMatchObject({ startTime: 10.5, endTime: 12.5 });
		// A track loaded later gets the current offset too.
		const [, , en] = h.media.fake.tracks;
		const late = { id: 'e1', startTime: 20, endTime: 21, text: 'Hi' };
		en.load([late]);
		expect(late.startTime).toBe(20.5);
		h.engine.setSubtitleOffset(-30);
		expect(h.state().subtitles.offsetSeconds).toBe(-10);
		expect(cue.startTime).toBe(0);
		h.engine.setSubtitles(null);
		expect(get(h.engine.cues)).toEqual([]);
	});

	it('shows the active track natively during Picture in Picture', async () => {
		const h = setup();
		await start(h);
		h.engine.setSubtitles(1);
		await h.engine.togglePip();
		expect(h.state().pip).toBe(true);
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'disabled',
			'showing',
			'disabled'
		]);
		await h.engine.togglePip();
		expect(h.state().pip).toBe(false);
		expect(h.media.fake.tracks.map((t) => t.track.mode)).toEqual([
			'disabled',
			'hidden',
			'disabled'
		]);
	});
});

describe('auto quality', () => {
	it('steps down after a stall over 4 s and offers Keep Original', async () => {
		const h = setup({ probe: chromeProbe });
		await start(h, undefined, 0);
		vi.advanceTimersByTime(31_000);
		playTo(h, 31);
		h.media.emit('waiting');
		expect(h.state().status).toBe('buffering');
		await vi.advanceTimersByTimeAsync(5000);
		await flush();
		expect(h.posted().at(-1)).toMatchObject({ quality: '1080p', startSeconds: 31 });
		await ready(h, 31);
		expect(h.state().quality).toMatchObject({ choice: 'auto', active: '1080p' });
		const toast = h
			.state()
			.toasts.find((t) => t.text === 'Lower quality (1080p) for smooth playback');
		expect(toast?.action?.label).toBe('Keep Original');
		toast!.action!.run();
		await flush();
		expect(h.posted().at(-1)).toMatchObject({ quality: 'original' });
		expect(h.state().quality.choice).toBe('original');
	});

	it('an explicit level never switches by itself; it suggests once', async () => {
		const h = setup({ prefs: { quality: '1080p' } });
		await start(h);
		for (const t of [10_000, 30_000]) {
			vi.advanceTimersByTime(t);
			h.media.emit('waiting');
			vi.advanceTimersByTime(4500);
			h.media.emit('playing');
		}
		playTo(h, 100);
		expect(h.posted()).toHaveLength(1);
		const toast = h.state().toasts.find((t) => t.text === 'Slow connection · Try 720p');
		expect(toast?.action?.label).toBe('Try 720p');
	});
});

describe('decode failure', () => {
	it('disables the codec once and restarts converted; a second failure is a decode error', async () => {
		const h = setup({
			probe: chromeProbe,
			session: (n) => ({
				video: {
					mode: n === 1 ? 'copy' : 'transcode',
					codec: n === 1 ? 'av1' : 'hevc',
					height: 2160,
					hdr: false
				}
			})
		});
		await start(h, undefined, 0);
		playTo(h, 420);
		const hls = FakeHls.instances[0];
		hls.error('mediaError', 'bufferAppendError');
		expect(hls.recovers).toBe(1);
		hls.error('mediaError', 'bufferAppendError');
		await flush();
		expect(JSON.parse(h.sessionStorage.getItem(CAPS_OVERRIDE_KEY)!)).toEqual({ av1: false });
		expect(h.posted()[1]).toMatchObject({ startSeconds: 420, caps: { av1: false } });
		expect(
			h.state().toasts.some((t) => t.text === 'Converted stream: this device could not decode AV1')
		).toBe(true);
		await ready(h, 420);
		const second = FakeHls.instances[1];
		second.error('mediaError', 'bufferAppendError');
		second.error('mediaError', 'bufferAppendError');
		await flush();
		expect(h.state().error).toEqual({
			code: 'decode',
			status: null,
			message: "This device couldn't play this stream.",
			fallback: '1080p'
		});
		// "Try 1080p (converted)" starts again from the error position.
		const trying = h.engine.setQuality('1080p');
		await flush();
		await trying;
		expect(h.posted().at(-1)).toMatchObject({ quality: '1080p', startSeconds: 420 });
	});
});

describe('up next', () => {
	const chapters: Chapter[] = [
		{ start: 0, end: 90, title: 'Previously' },
		{ start: 90, end: 3420, title: 'Episode' },
		{ start: 3420, end: 3600, title: 'Générique de fin' }
	];

	it('counts down at the credits chapter; interaction pauses it 2 s; then plays the next episode', async () => {
		const h = setup({ chapters });
		await start(h);
		expect(h.state().chapters).toEqual(chapters);
		playTo(h, 30);
		expect(h.state().skipIntro).toEqual({ end: 90 });
		expect(h.state().chapterIndex).toBe(0);
		playTo(h, 3419);
		expect(h.state().upNext).toBeNull();
		vi.advanceTimersByTime(300);
		playTo(h, 3420);
		expect(h.state().upNext).toMatchObject({
			index: 1,
			reason: 'credits',
			countdownEndsAt: Date.now() + 10_000
		});
		vi.advanceTimersByTime(5000);
		h.engine.noteInteraction();
		expect(h.state().upNext?.countdownEndsAt).toBeNull();
		vi.advanceTimersByTime(2000);
		expect(h.state().upNext?.countdownEndsAt).toBe(Date.now() + 5000);
		await vi.advanceTimersByTimeAsync(5000);
		await flush();
		expect(h.onItemChange).toHaveBeenCalledWith(h.payload.queue[1], 1);
		expect(h.posted().at(-1)).toMatchObject({ fileId: 'f2' });
		expect(h.puts().at(-1)).toMatchObject({
			body: { fileId: 'f1', positionSeconds: 3420, durationSeconds: 3600 },
			keepalive: true
		});
		expect(h.deleted().at(-1)?.url).toBe('/api/media/sessions/s1');
		expect(h.state()).toMatchObject({ index: 1, upNext: null, trickplay: null });
		expect(h.state().queue[0].progress).toMatchObject({ positionSeconds: 3420, completed: true });
	});

	it('falls back to duration - max(45 s, 2%) and asks "Still watching?" after 3 autoplays', async () => {
		const h = setup({ queue: [1, 2, 3, 4, 5].map((n) => episode(n)) });
		await start(h);
		for (let i = 0; i < 3; i++) {
			playTo(h, 3528);
			expect(h.state().upNext).toMatchObject({
				reason: 'end',
				countdownEndsAt: expect.any(Number)
			});
			await vi.advanceTimersByTimeAsync(10_000);
			await flush();
			await ready(h);
		}
		expect(h.state().index).toBe(3);
		playTo(h, 3530);
		expect(h.state()).toMatchObject({ stillWatching: true, upNext: { countdownEndsAt: null } });
		h.engine.confirmStillWatching();
		await flush();
		expect(h.state()).toMatchObject({ index: 4, stillWatching: false });
	});

	it('autoplay off gives no countdown; Credits hides the card until the end', async () => {
		const h = setup({ prefs: { autoplayNext: false } });
		await start(h);
		playTo(h, 3530);
		expect(h.state().upNext).toMatchObject({ countdownEndsAt: null });
		h.engine.cancelUpNext();
		playTo(h, 3540);
		expect(h.state().upNext).toBeNull();
		h.media.fake.paused = true;
		h.media.fake.ended = true;
		h.media.emit('ended');
		expect(h.state()).toMatchObject({
			status: 'ended',
			upNext: { reason: 'end', countdownEndsAt: null }
		});
	});

	it('next() on the last item does nothing; the media session has no next track there', async () => {
		const h = setup({ queue: [episode(1)] });
		await start(h);
		await h.engine.next();
		expect(h.posted()).toHaveLength(1);
		const ms = h.media.win.navigator.mediaSession as FakeMediaSession;
		expect(ms.handlers.get('nexttrack')).toBeNull();
	});
});

describe('progress', () => {
	it('saves every 10 s while playing, on pause, on seek end (1 s debounce) and on hide', async () => {
		const h = setup();
		await start(h);
		playTo(h, 5);
		vi.advanceTimersByTime(10_000);
		playTo(h, 15);
		expect(h.puts().map((p) => p.body.positionSeconds)).toEqual([15]);
		vi.advanceTimersByTime(5000);
		playTo(h, 20);
		expect(h.puts()).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		h.media.pause();
		expect(h.puts().map((p) => p.body.positionSeconds)).toEqual([15, 20]);
		vi.advanceTimersByTime(6000);
		h.engine.seek(1800);
		h.media.emit('seeked');
		vi.advanceTimersByTime(999);
		expect(h.puts()).toHaveLength(2);
		vi.advanceTimersByTime(1);
		expect(h.puts().at(-1)?.body.positionSeconds).toBe(1800);
		h.media.currentTime = 1810;
		h.media.doc.setVisibility('hidden');
		expect(h.puts().at(-1)).toMatchObject({ body: { positionSeconds: 1810 }, keepalive: true });
		const pagehide = new Event('pagehide');
		Object.assign(pagehide, { persisted: false });
		h.media.win.dispatchEvent(pagehide);
		expect(h.deleted().at(-1)).toMatchObject({ url: '/api/media/sessions/s1', keepalive: true });
	});

	it('retries a failed PUT once when back online', async () => {
		const h = setup();
		await start(h);
		vi.advanceTimersByTime(10_000);
		h.fetch.mockImplementationOnce(async () => {
			throw new TypeError('offline');
		});
		playTo(h, 200);
		await flush();
		h.media.win.dispatchEvent(new Event('online'));
		await flush();
		const bodies = h.fetch.mock.calls
			.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
			.map(([, init]) => JSON.parse((init as RequestInit).body as string).positionSeconds);
		expect(bodies).toEqual([200, 200]);
		expect(h.state().online).toBe(true);
	});
});

describe('clock', () => {
	it('emits at 4 Hz on timeupdate, 1 Hz when asked, and at once on seeking', async () => {
		const h = setup();
		await start(h);
		const seen: number[] = [];
		const stop = h.engine.clock.subscribe((c) => seen.push(c.position));
		seen.length = 0;
		for (let i = 1; i <= 8; i++) {
			vi.advanceTimersByTime(125);
			playTo(h, i);
		}
		expect(seen).toHaveLength(4);
		h.engine.setClockRate(1);
		seen.length = 0;
		for (let i = 1; i <= 8; i++) {
			vi.advanceTimersByTime(250);
			playTo(h, 10 + i);
		}
		expect(seen).toHaveLength(2);
		h.media.currentTime = 500;
		h.media.emit('seeking');
		expect(seen.at(-1)).toBe(500);
		h.media.setBuffered([[480, 560]]);
		h.media.emit('progress');
		expect(get(h.engine.clock)).toMatchObject({ position: 500, duration: 3600, bufferedEnd: 560 });
		stop();
	});
});

describe('system integration', () => {
	it('wires the media session and the wake lock', async () => {
		const h = setup();
		await start(h);
		const ms = h.media.win.navigator.mediaSession as FakeMediaSession;
		const lock = h.media.win.navigator.wakeLock as FakeWakeLock;
		await flush();
		expect(ms.metadata).toMatchObject({
			title: 'Episode 1',
			artist: 'The Show',
			album: "Alan's HQP"
		});
		expect(ms.metadata?.artwork[0].src).toBe('https://image.tmdb.org/t/p/w780/s1.jpg');
		expect(ms.playbackState).toBe('playing');
		expect(lock.active).toBe(1);
		playTo(h, 100);
		ms.handlers.get('seekforward')?.({ action: 'seekforward' });
		expect(h.media.currentTime).toBe(110);
		ms.handlers.get('seekto')?.({ action: 'seekto', seekTime: 50 });
		expect(h.media.currentTime).toBe(50);
		ms.handlers.get('pause')?.({ action: 'pause' });
		expect(ms.playbackState).toBe('paused');
		await vi.advanceTimersByTimeAsync(5 * 60_000);
		expect(lock.active).toBe(0);
		ms.handlers.get('nexttrack')?.({ action: 'nexttrack' });
		await flush();
		expect(h.state().index).toBe(1);
	});

	it('sleep: end of item pauses at the end instead of advancing', async () => {
		const h = setup();
		await start(h);
		h.engine.setSleep('end-of-item');
		playTo(h, 3530);
		expect(h.state().upNext).toMatchObject({ countdownEndsAt: null });
		h.media.fake.paused = true;
		h.media.fake.ended = true;
		h.media.emit('ended');
		expect(h.state().toasts.at(-1)?.text).toBe('Sleep timer paused playback');
		await vi.advanceTimersByTimeAsync(30_000);
		expect(h.state()).toMatchObject({ status: 'ended', index: 0, sleep: { mode: 'off' } });
	});

	it('sleep: timed mode fades the volume and pauses', async () => {
		const h = setup();
		await start(h);
		h.engine.setSleep(15);
		expect(h.state().sleep).toEqual({ mode: 15, endsAt: Date.now() + 900_000 });
		vi.advanceTimersByTime(895_000);
		expect(h.media.volume).toBe(0.5);
		vi.advanceTimersByTime(5000);
		expect(h.media.paused).toBe(true);
		expect(h.media.volume).toBe(1);
		expect(h.state().sleep.mode).toBe('off');
	});
});

describe('controls', () => {
	it('a seek asked before the metadata applies once the stream can play', async () => {
		const h = setup();
		const loading = h.engine.load(h.payload, { startAt: 100 });
		await flush();
		await loading;
		h.engine.seek(900);
		expect(get(h.engine.clock).position).toBe(900);
		h.media.fake.loadMetadata(3600);
		expect(h.media.currentTime).toBe(100);
		h.media.fake.ready();
		expect(h.media.currentTime).toBe(900);
	});

	it('seeks by chapter, steps frames, holds 2x and starts over', async () => {
		const h = setup({
			chapters: [
				{ start: 0, end: 600, title: 'A' },
				{ start: 600, end: 1200, title: 'B' },
				{ start: 1200, end: 3600, title: 'C' }
			]
		});
		await start(h);
		playTo(h, 700);
		h.engine.seekChapter(1);
		expect(h.media.currentTime).toBe(1200);
		h.engine.seekChapter(-1);
		expect(h.media.currentTime).toBe(600);
		h.engine.seekChapter(-1);
		expect(h.media.currentTime).toBe(0);
		h.engine.setRate(1.5);
		h.engine.holdRate(true);
		expect(h.media.playbackRate).toBe(2);
		expect(h.state()).toMatchObject({ held: true, rate: 1.5 });
		h.engine.holdRate(false);
		expect(h.media.playbackRate).toBe(1.5);
		playTo(h, 100);
		h.engine.stepFrame(1);
		expect(h.media.paused).toBe(true);
		expect(h.media.currentTime).toBeCloseTo(100 + 1 / 24);
		h.engine.startOver();
		expect(h.media.currentTime).toBe(0);
	});

	it('remembers Fit/Fill per aspect class and applies volume prefs', async () => {
		const h = setup({ prefs: { volume: 0.4, muted: true } });
		expect(h.media.volume).toBe(0.4);
		expect(h.media.muted).toBe(true);
		await start(h);
		h.engine.setFrameMode('fill');
		expect(get(h.engine.prefs).frameModes).toEqual({ standard: 'fill', wide: 'fit', scope: 'fit' });
		h.engine.setVolume(0.8);
		expect(h.state()).toMatchObject({ volume: 0.8, muted: false });
	});

	it('loads trickplay on demand and caches a ready manifest', async () => {
		const h = setup();
		await start(h);
		expect(h.requests.some((r) => r.url.endsWith('trickplay.json'))).toBe(false);
		await expect(h.engine.ensureTrickplay()).resolves.toEqual(TRICKPLAY);
		await h.engine.ensureTrickplay();
		expect(h.requests.filter((r) => r.url.endsWith('trickplay.json'))).toHaveLength(1);
		expect(h.state().trickplay).toEqual(TRICKPLAY);
	});

	it('metrics and diagnostics never contain a file path', async () => {
		const h = setup();
		await start(h);
		const metrics = h.engine.metrics();
		expect(metrics).toMatchObject({ sessionId: 's1', videoMode: 'copy', delivery: 'native' });
		const diagnostics = JSON.parse(h.engine.diagnostics());
		expect(diagnostics.events.length).toBeGreaterThan(0);
		expect(h.engine.diagnostics()).not.toMatch(/[A-Za-z]:\\\\|\/MOVIES/);
	});
});

describe('destroy', () => {
	it('saves progress and deletes the session with keepalive, clears the source, leaves no timers', async () => {
		const h = setup({ probe: chromeProbe });
		await start(h, undefined, 0);
		playTo(h, 2500);
		h.engine.setSleep(30);
		await h.engine.destroy();
		expect(h.puts().at(-1)).toMatchObject({ body: { positionSeconds: 2500 }, keepalive: true });
		expect(h.deleted().at(-1)).toMatchObject({ url: '/api/media/sessions/s1', keepalive: true });
		expect(FakeHls.instances[0].destroyed).toBe(true);
		expect(h.media.fake.tracks).toHaveLength(0);
		expect(h.media.src).toBe('');
		expect(h.media.fake.calls.load).toBeGreaterThan(0);
		expect((h.media.win.navigator.mediaSession as FakeMediaSession).metadata).toBeNull();
		expect((h.media.win.navigator.wakeLock as FakeWakeLock).active).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		// Listeners are gone: events no longer change anything.
		h.media.emit('playing');
		expect(h.state().status).toBe('idle');
	});
});
