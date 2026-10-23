import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFileRecord, PlaybackSession } from '$lib/media/types';

const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getExternalSubtitlePath: vi.fn(),
	getProgress: vi.fn(),
	saveProgress: vi.fn(),
	listContinueWatching: vi.fn()
}));
vi.mock('./repository', () => repo);
vi.mock('./capabilities', () => ({
	ffmpegSupport: vi.fn(async () => ({ available: true, nvenc: true, cuda: true, libplacebo: true }))
}));
const spawned = vi.hoisted(() => [] as Array<{ command: string; args: string[] }>);
vi.mock('./process', async (original) => {
	const actual = await original<typeof import('./process')>();
	return {
		...actual,
		spawnTracked: vi.fn((command: string, args: string[]) => {
			spawned.push({ command, args });
			const child = Object.assign(new EventEmitter(), {
				stdout: new PassThrough(),
				stderr: new PassThrough(),
				kill: () => setImmediate(() => child.emit('close', null))
			});
			return child;
		}),
		runCommand: vi.fn(async () => ({
			code: 0,
			stdout: '{"chapters":[]}',
			stderr: '',
			timedOut: false
		}))
	};
});

const api = await import('./api');

const OWNER = { id: '00000000-0000-4000-8000-000000000001', role: 'owner' };
const MEMBER = { id: '00000000-0000-4000-8000-000000000002', role: 'member' };
const OTHER_OWNER = { id: '00000000-0000-4000-8000-000000000003', role: 'owner' };
const FILE_ID = '11111111-1111-4111-8111-111111111111';
const ORIGIN = 'http://127.0.0.1:5182';

let library: string;
let cache: string;
let outside: string;

function record(path: string, partial: Partial<MediaFileRecord> = {}): MediaFileRecord {
	return {
		id: FILE_ID,
		path,
		sizeBytes: 4,
		durationSeconds: 100,
		video: {
			codec: 'hevc',
			profile: 'Main 10',
			pixFmt: 'yuv420p10le',
			width: 3840,
			height: 1600,
			hdr: 'hdr10'
		},
		audioTracks: [
			{ ordinal: 0, codec: 'eac3', channels: 6, language: 'eng', title: null, isDefault: true },
			{ ordinal: 1, codec: 'eac3', channels: 6, language: 'fre', title: null, isDefault: false }
		],
		subtitleTracks: [
			{
				ordinal: 0,
				source: 'embedded',
				codec: 'subrip',
				language: 'fre',
				title: null,
				forced: true,
				isText: true
			},
			{
				ordinal: 1,
				source: 'embedded',
				codec: 'hdmv_pgs_subtitle',
				language: 'eng',
				title: null,
				forced: false,
				isText: false
			}
		],
		movieId: null,
		episodeId: null,
		matchStatus: 'matched',
		...partial
	};
}

function event(
	user: unknown,
	init: {
		method?: string;
		path?: string;
		params?: Record<string, string>;
		body?: unknown;
		origin?: string | null;
		contentType?: string;
	} = {}
) {
	const url = new URL(init.path ?? '/api/media/sessions', ORIGIN);
	const headers = new Headers();
	if (init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
	if (init.body !== undefined) headers.set('content-type', init.contentType ?? 'application/json');
	const request = new Request(url, {
		method: init.method ?? 'GET',
		headers,
		body:
			init.body === undefined
				? undefined
				: typeof init.body === 'string'
					? init.body
					: JSON.stringify(init.body)
	});
	return { locals: { user } as unknown as App.Locals, params: init.params ?? {}, request, url };
}

const CAPS = {
	h264: true,
	hevc: true,
	hevcMain10: true,
	av1: true,
	nativeHls: false,
	maxHeight: null
};

beforeAll(async () => {
	library = await mkdtemp(join(tmpdir(), 'media-lib-'));
	cache = await mkdtemp(join(tmpdir(), 'media-cache-'));
	outside = await mkdtemp(join(tmpdir(), 'media-outside-'));
	await writeFile(join(library, 'movie.mkv'), 'fake');
	await writeFile(join(outside, 'secret.mkv'), 'fake');
	await mkdir(join(library, 'sub'), { recursive: true });
});

afterAll(async () => {
	for (const dir of [library, cache, outside]) await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
	process.env.MEDIA_LIBRARY_ROOTS = library;
	process.env.MEDIA_CACHE_DIR = cache;
	process.env.FFMPEG_PATH = 'C:/ff/ffmpeg.exe';
	for (const fn of Object.values(repo)) fn.mockReset();
	repo.getMediaFile.mockResolvedValue(record(join(library, 'movie.mkv')));
	spawned.length = 0;
});

async function start(user = OWNER, body: unknown = { fileId: FILE_ID, audio: null, caps: CAPS }) {
	return api.startSession(event(user, { method: 'POST', body }));
}

describe('owner-only access', () => {
	it('answers 401 without a session and 403 for non-owners on every endpoint', async () => {
		const handlers = [
			() => api.startSession(event(null, { method: 'POST', body: {} })),
			() => api.sessionAsset(event(null, { params: { sid: 'a'.repeat(32), name: 'index.m3u8' } })),
			() => api.readProgress(event(null)),
			() => api.continueWatching(event(null))
		];
		for (const handler of handlers) expect((await handler()).status).toBe(401);
		expect((await start(MEMBER)).status).toBe(403);
		expect((await api.readProgress(event(MEMBER))).status).toBe(403);
		expect(
			(await api.subtitle(event(MEMBER, { params: { fileId: FILE_ID, name: '0.vtt' } }))).status
		).toBe(403);
		expect((await api.writeProgress(event(MEMBER, { method: 'PUT', body: {} }))).status).toBe(403);
		expect(repo.getMediaFile).not.toHaveBeenCalled();
	});

	it('answers 503 when the library is not configured', async () => {
		delete process.env.MEDIA_LIBRARY_ROOTS;
		const res = await start();
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'Media streaming is not configured on this server' });
		expect((await api.readProgress(event(OWNER))).status).toBe(503);
		expect((await api.continueWatching(event(OWNER))).status).toBe(503);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('refuses a cache folder inside the library, equal to it or above it', async () => {
		for (const dir of [
			join(library, 'cache'),
			library,
			`${library}${sep}`,
			library.toUpperCase(),
			`${library}.`,
			dirname(library)
		]) {
			process.env.MEDIA_CACHE_DIR = dir;
			const res = await start();
			expect(res.status, dir).toBe(503);
			expect(await res.json()).toEqual({
				error: 'MEDIA_CACHE_DIR must be outside the media library'
			});
		}
		expect(spawned).toHaveLength(0);
	});
});

describe('POST /api/media/sessions', () => {
	it('requires a same-origin JSON request', async () => {
		expect(
			(
				await api.startSession(
					event(OWNER, { method: 'POST', body: {}, origin: 'https://evil.example' })
				)
			).status
		).toBe(403);
		expect(
			(await api.startSession(event(OWNER, { method: 'POST', body: {}, origin: null }))).status
		).toBe(403);
		expect(
			(
				await api.startSession(
					event(OWNER, { method: 'POST', body: 'x', contentType: 'text/plain' })
				)
			).status
		).toBe(415);
		expect((await api.startSession(event(OWNER, { method: 'POST', body: '{nope' }))).status).toBe(
			400
		);
	});

	it('validates the request', async () => {
		expect((await start(OWNER, { fileId: '../../etc', caps: CAPS })).status).toBe(400);
		expect((await start(OWNER, { fileId: FILE_ID })).status).toBe(400);
		expect((await start(OWNER, { fileId: FILE_ID, caps: CAPS, quality: '4k' })).status).toBe(400);
		expect((await start(OWNER, { fileId: FILE_ID, caps: CAPS, audio: -1 })).status).toBe(400);
		expect((await start(OWNER, { fileId: FILE_ID, caps: CAPS, startSeconds: -3 })).status).toBe(
			400
		);
		expect((await start(OWNER, { fileId: FILE_ID, caps: { ...CAPS, maxHeight: 5 } })).status).toBe(
			400
		);
	});

	it('answers 404 for an unknown file, 403 outside the roots, 409 for a vanished file', async () => {
		repo.getMediaFile.mockResolvedValueOnce(null);
		expect((await start()).status).toBe(404);
		repo.getMediaFile.mockResolvedValueOnce(record(join(outside, 'secret.mkv')));
		expect((await start()).status).toBe(403);
		repo.getMediaFile.mockResolvedValueOnce(record(join(library, '..', 'x', 'movie.mkv')));
		expect((await start()).status).toBe(403);
		repo.getMediaFile.mockResolvedValueOnce(record(join(library, 'gone.mkv')));
		expect((await start()).status).toBe(409);
		expect(spawned).toHaveLength(0);
	});

	it('starts a session and describes it for the player', async () => {
		const res = await start(OWNER, { fileId: FILE_ID, audio: null, caps: CAPS, startSeconds: 50 });
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		const session = (await res.json()) as PlaybackSession;
		expect(session.sessionId).toMatch(/^[0-9a-f]{32}$/u);
		expect(session).toMatchObject({
			playlistUrl: `/api/media/sessions/${session.sessionId}/index.m3u8`,
			masterPlaylistUrl: `/api/media/sessions/${session.sessionId}/master.m3u8`,
			durationSeconds: 100,
			segmentSeconds: 4,
			startSeconds: 48,
			audio: 1, // French first
			audioMode: 'transcode',
			quality: 'original',
			qualities: ['original', '1080p', '720p', '480p'],
			chaptersUrl: `/api/media/files/${FILE_ID}/chapters`,
			trickplayUrl: `/api/media/files/${FILE_ID}/trickplay.json`,
			video: { mode: 'transcode', codec: 'hevc', width: 3840, height: 1600, hdr: true }
		});
		expect(session.audioTracks.map((t) => t.label)).toEqual([
			'English · Dolby Digital Plus 5.1',
			'French · Dolby Digital Plus 5.1'
		]);
		// Codec and channels travel with each track so the player builds its labels from fields.
		expect(session.audioTracks.map((t) => [t.codec, t.channels])).toEqual([
			['eac3', 6],
			['eac3', 6]
		]);
		expect(session.subtitleTracks).toEqual([
			{
				ordinal: 0,
				label: 'French (forced)',
				language: 'fre',
				url: `/api/media/files/${FILE_ID}/subtitles/0.vtt`,
				forced: true
			}
		]);
		expect(JSON.stringify(session)).not.toContain(library.replaceAll('\\', '\\\\'));
		expect(spawned).toHaveLength(1);
		expect(spawned[0].command).toBe('C:/ff/ffmpeg.exe');
		expect(spawned[0].args[spawned[0].args.indexOf('-ss') + 1]).toBe('48.000');

		const playlist = await api.sessionAsset(
			event(OWNER, { params: { sid: session.sessionId, name: 'index.m3u8' } })
		);
		expect(playlist.status).toBe(200);
		expect(playlist.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
		expect(await playlist.text()).toContain('#EXT-X-PLAYLIST-TYPE:VOD');

		// another account (even an owner) cannot read it; bad names are 404
		expect(
			(
				await api.sessionAsset(
					event(OTHER_OWNER, { params: { sid: session.sessionId, name: 'index.m3u8' } })
				)
			).status
		).toBe(404);
		for (const name of ['seg-x.m4s', '../index.m3u8', 'seg-1.ts', 'seg-9999999.m4s']) {
			expect(
				(await api.sessionAsset(event(OWNER, { params: { sid: session.sessionId, name } }))).status
			).toBe(404);
		}
		expect(
			(await api.sessionAsset(event(OWNER, { params: { sid: 'nope', name: 'index.m3u8' } }))).status
		).toBe(404);

		// DELETE: same-origin only, then gone
		expect(
			(
				await api.stopSession(
					event(OWNER, {
						method: 'DELETE',
						params: { sid: session.sessionId },
						origin: 'https://evil.example'
					})
				)
			).status
		).toBe(403);
		expect(
			(
				await api.stopSession(
					event(OTHER_OWNER, { method: 'DELETE', params: { sid: session.sessionId } })
				)
			).status
		).toBe(404);
		expect(
			(
				await api.stopSession(
					event(OWNER, { method: 'DELETE', params: { sid: session.sessionId } })
				)
			).status
		).toBe(204);
		expect(
			(
				await api.sessionAsset(
					event(OWNER, { params: { sid: session.sessionId, name: 'index.m3u8' } })
				)
			).status
		).toBe(404);
	});

	it('on the media node, accepts the app origin with a grant and grants every URL it emits', async () => {
		const withGrant = (init: Parameters<typeof event>[1]) => {
			const e = event(OWNER, { origin: 'https://alandatabase.com', ...init });
			e.locals.mediaGrant = 'v1.G.S';
			return e;
		};
		const res = await api.startSession(
			withGrant({ method: 'POST', body: { fileId: FILE_ID, audio: null, caps: CAPS } })
		);
		expect(res.status).toBe(201);
		const session = (await res.json()) as PlaybackSession;
		expect(session.playlistUrl).toBe(
			`/api/media/sessions/${session.sessionId}/index.m3u8?mt=v1.G.S`
		);
		expect(session.chaptersUrl).toBe(`/api/media/files/${FILE_ID}/chapters?mt=v1.G.S`);
		expect(session.subtitleTracks[0].url).toBe(
			`/api/media/files/${FILE_ID}/subtitles/0.vtt?mt=v1.G.S`
		);

		const playlist = await (
			await api.sessionAsset(withGrant({ params: { sid: session.sessionId, name: 'index.m3u8' } }))
		).text();
		expect(playlist).toContain('URI="init.mp4?mt=v1.G.S"');
		expect(playlist).toMatch(/^seg-0\.m4s\?mt=v1\.G\.S$/mu);

		// Without a grant, a foreign origin is still refused.
		expect(
			(
				await api.startSession(
					event(OWNER, { method: 'POST', body: {}, origin: 'https://alandatabase.com' })
				)
			).status
		).toBe(403);
	});
});

describe('file extras', () => {
	it('refuses image subtitles with 415 and unknown names with 404', async () => {
		expect(
			(await api.subtitle(event(OWNER, { params: { fileId: FILE_ID, name: '1.vtt' } }))).status
		).toBe(415);
		expect(
			(await api.subtitle(event(OWNER, { params: { fileId: FILE_ID, name: '7.vtt' } }))).status
		).toBe(404);
		expect(
			(await api.subtitle(event(OWNER, { params: { fileId: FILE_ID, name: '0.srt' } }))).status
		).toBe(404);
		expect(
			(await api.subtitle(event(OWNER, { params: { fileId: 'x', name: '0.vtt' } }))).status
		).toBe(404);
	});

	it('checks external subtitle paths against the library roots', async () => {
		repo.getMediaFile.mockResolvedValue(
			record(join(library, 'movie.mkv'), {
				subtitleTracks: [
					{
						ordinal: 0,
						source: 'external',
						codec: 'subrip',
						language: 'fre',
						title: null,
						forced: false,
						isText: true
					}
				]
			})
		);
		repo.getExternalSubtitlePath.mockResolvedValueOnce(join(outside, 'secret.srt'));
		expect(
			(await api.subtitle(event(OWNER, { params: { fileId: FILE_ID, name: '0.vtt' } }))).status
		).toBe(403);
	});

	it('serves chapters and a pending trickplay manifest; missing sheets are 404', async () => {
		const chapters = await api.chapters(event(OWNER, { params: { fileId: FILE_ID } }));
		expect(chapters.status).toBe(200);
		expect(await chapters.json()).toEqual([]);
		const manifest = await api.trickplayManifest(event(OWNER, { params: { fileId: FILE_ID } }));
		expect(await manifest.json()).toMatchObject({
			status: 'pending',
			intervalSeconds: 10,
			tileWidth: 480
		});
		expect(
			(await api.trickplaySheet(event(OWNER, { params: { fileId: FILE_ID, sheet: '0.webp' } })))
				.status
		).toBe(404);
		expect(
			(await api.trickplaySheet(event(OWNER, { params: { fileId: FILE_ID, sheet: '../x.webp' } })))
				.status
		).toBe(404);
	});
});

describe('progress and continue watching', () => {
	const ID2 = '22222222-2222-4222-8222-222222222222';

	it('reads saved positions for valid ids only', async () => {
		repo.getProgress.mockResolvedValue([
			{
				fileId: FILE_ID,
				positionSeconds: 10,
				durationSeconds: 100,
				completed: false,
				updatedAt: 'x'
			}
		]);
		const res = await api.readProgress(
			event(OWNER, { path: `/api/media/progress?fileIds=${FILE_ID},${ID2}` })
		);
		expect(res.status).toBe(200);
		expect(repo.getProgress).toHaveBeenCalledWith(OWNER.id, [FILE_ID, ID2]);
		expect(
			(await api.readProgress(event(OWNER, { path: '/api/media/progress?fileIds=abc' }))).status
		).toBe(400);
		expect(
			await (await api.readProgress(event(OWNER, { path: '/api/media/progress' }))).json()
		).toEqual([]);
	});

	it('writes positions (same-origin, validated, 404 for unknown files)', async () => {
		repo.saveProgress.mockResolvedValueOnce({ fileId: ID2 });
		const put = (body: unknown, origin?: string) =>
			api.writeProgress(event(OWNER, { method: 'PUT', path: '/api/media/progress', body, origin }));
		expect((await put({ fileId: ID2, positionSeconds: 12.5, durationSeconds: 100 })).status).toBe(
			204
		);
		expect(repo.saveProgress).toHaveBeenCalledWith(OWNER.id, {
			fileId: ID2,
			positionSeconds: 12.5,
			durationSeconds: 100
		});
		expect((await put({ fileId: ID2, positionSeconds: 13 }, 'https://evil.example')).status).toBe(
			403
		);
		expect((await put({ fileId: ID2, positionSeconds: -1 })).status).toBe(400);
		expect((await put({ fileId: ID2, positionSeconds: 'x' })).status).toBe(400);
		expect((await put({ fileId: 'nope', positionSeconds: 1 })).status).toBe(400);
		expect((await put({ fileId: ID2, positionSeconds: 1, durationSeconds: 0 })).status).toBe(400);
		repo.saveProgress.mockResolvedValueOnce(null);
		expect(
			(
				await put({
					fileId: '33333333-3333-4333-8333-333333333333',
					positionSeconds: 1,
					durationSeconds: null
				})
			).status
		).toBe(404);
	});

	it('lists continue-watching rows', async () => {
		repo.listContinueWatching.mockResolvedValue([{ fileId: FILE_ID }]);
		const res = await api.continueWatching(event(OWNER, { path: '/api/media/continue?limit=5' }));
		expect(await res.json()).toEqual([{ fileId: FILE_ID }]);
		expect(repo.listContinueWatching).toHaveBeenCalledWith(OWNER.id, 5);
		expect(
			(await api.continueWatching(event(OWNER, { path: '/api/media/continue?limit=500' }))).status
		).toBe(400);
	});
});
