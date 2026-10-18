import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubtitleTrack, VideoInfo } from '$lib/media/types';
import { BackgroundQueue, JobCancelledError } from './background';
import { chaptersArgs, ChapterService, parseChapters } from './chapters';
import { KeyframeIndexer } from './indexer';
import { readCachedIndex } from './keyframes';
import type { RunResult } from './process';
import {
	detectCharset,
	embeddedSubtitleArgs,
	externalSubtitleArgs,
	SubtitleService,
	subtitleCachePath
} from './subtitles';
import { tileHeight, trickplayArgs, TrickplayService } from './trickplay';

const dirs: string[] = [];
async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), 'media-extras-'));
	dirs.push(dir);
	return dir;
}
afterAll(async () => {
	for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '', timedOut: false });
const fail = (): RunResult => ({ code: 1, stdout: '', stderr: 'boom', timedOut: false });

describe('BackgroundQueue', () => {
	it('runs one job at a time, by priority, deduplicated by key', async () => {
		const queue = new BackgroundQueue(() => undefined);
		const order: string[] = [];
		let running = 0;
		let maxRunning = 0;
		const job = (key: string, priority: number) => ({
			key,
			priority,
			run: async () => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				await new Promise((r) => setTimeout(r, 5));
				order.push(key);
				running--;
			}
		});
		expect(queue.enqueue(job('a', 0))).toBe(true);
		expect(queue.enqueue(job('b', 0))).toBe(true);
		expect(queue.enqueue(job('c', 9))).toBe(true);
		expect(queue.enqueue(job('b', 1))).toBe(false);
		await queue.idle();
		expect(order).toEqual(['a', 'c', 'b']);
		expect(maxRunning).toBe(1);
	});

	it('starts nothing while a playback session reads the library (closed gate)', async () => {
		let open = false;
		const queue = new BackgroundQueue(() => undefined, { gate: () => open, pollMs: 5 });
		let ran = false;
		const done = queue.schedule({ key: 'x', priority: 0, run: async () => void (ran = true) });
		await new Promise((r) => setTimeout(r, 40));
		expect(ran).toBe(false);
		expect(queue.size).toBe(1);
		open = true;
		await done;
		expect(ran).toBe(true);
	});

	it('resolves every waiter of a key once, raising the priority of a queued job', async () => {
		let open = false;
		const queue = new BackgroundQueue(() => undefined, { gate: () => open, pollMs: 5 });
		const order: string[] = [];
		const job = (key: string, priority: number) => ({
			key,
			priority,
			run: async () => void order.push(key)
		});
		queue.enqueue(job('trickplay', 5));
		const prefetch = queue.schedule(job('subs', 1));
		const asked = queue.schedule(job('subs', 100));
		open = true;
		await Promise.all([prefetch, asked]);
		expect(order).toEqual(['subs', 'trickplay']);
		const failing = queue.schedule({
			key: 'bad',
			priority: 0,
			run: async () => Promise.reject(new Error('ffmpeg failed'))
		});
		await expect(failing).rejects.toThrow('ffmpeg failed');
	});

	it('preempts a running background chore for an urgent job, then runs the chore again', async () => {
		const queue = new BackgroundQueue(() => undefined);
		const events: string[] = [];
		let attempts = 0;
		queue.enqueue({
			key: 'trickplay',
			priority: 5,
			fileId: 'f',
			preemptible: true,
			run: (signal) =>
				new Promise<void>((resolve) => {
					attempts++;
					events.push(`trickplay start ${attempts}`);
					if (attempts > 1) return resolve();
					signal.addEventListener('abort', () => {
						events.push('trickplay aborted');
						resolve();
					});
				})
		});
		await new Promise((r) => setTimeout(r, 5));
		await queue.schedule({ key: 'subs', priority: 100, run: async () => void events.push('subs') });
		await queue.idle();
		expect(events).toEqual(['trickplay start 1', 'trickplay aborted', 'subs', 'trickplay start 2']);
	});

	it('cancels the queued and running jobs of a file the owner left', async () => {
		let open = false;
		const queue = new BackgroundQueue(() => undefined, { gate: () => open, pollMs: 5 });
		let aborted = false;
		const running = queue.schedule({
			key: 'a',
			priority: 9,
			fileId: 'left',
			run: (signal) =>
				new Promise<void>((resolve) =>
					signal.addEventListener('abort', () => {
						aborted = true;
						resolve();
					})
				)
		});
		const queued = queue.schedule({ key: 'b', priority: 1, fileId: 'left', run: async () => {} });
		let otherRan = false;
		const other = queue.schedule({
			key: 'c',
			priority: 0,
			fileId: 'kept',
			run: async () => void (otherRan = true)
		});
		open = true;
		await new Promise((r) => setTimeout(r, 20));
		queue.cancelFile('left');
		await expect(running).rejects.toBeInstanceOf(JobCancelledError);
		await expect(queued).rejects.toBeInstanceOf(JobCancelledError);
		await other;
		expect(aborted).toBe(true);
		expect(otherRan).toBe(true);
	});

	it('keeps going after a failing job', async () => {
		const logs: string[] = [];
		const queue = new BackgroundQueue((m) => logs.push(m));
		let ran = false;
		queue.enqueue({ key: 'x', priority: 0, run: async () => Promise.reject(new Error('nope')) });
		queue.enqueue({ key: 'y', priority: 0, run: async () => void (ran = true) });
		await queue.idle();
		expect(ran).toBe(true);
		expect(logs[0]).toContain('x failed');
	});
});

describe('KeyframeIndexer', () => {
	it('scans non-Matroska files with ffprobe in the background and caches the result', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		const calls: string[][] = [];
		const indexer = new KeyframeIndexer({
			cacheDir,
			ffprobePath: 'ffprobe',
			queue,
			run: async (_cmd, args) => {
				calls.push(args);
				return ok(
					'0.000000,0.04,K__\n1.000000,0.04,___\n4.004000,0.04,K__\n8.008000,0.04,K_\n9.5,0.5,___\n'
				);
			}
		});
		const file = { path: 'F:/MOVIES/a.mp4', size: 5, mtimeMs: 7, durationSeconds: 10 };
		expect(await indexer.forPlayback(file)).toBeNull();
		await queue.idle();
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain('packet=pts_time,duration_time,flags');
		expect(await readCachedIndex(cacheDir, file)).toEqual({
			version: 1,
			method: 'ffprobe',
			keyframes: [0, 4.004, 8.008],
			videoEnd: 10
		});
		expect(await indexer.forPlayback(file)).toMatchObject({ method: 'ffprobe' });
		await queue.idle();
		expect(calls).toHaveLength(1);
	});

	it('does not cache a failed scan', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		const indexer = new KeyframeIndexer({
			cacheDir,
			ffprobePath: 'ffprobe',
			queue,
			run: async () => fail()
		});
		const file = { path: 'F:/MOVIES/b.mp4', size: 5, mtimeMs: 7, durationSeconds: 10 };
		expect(await indexer.scan(file)).toBeNull();
		expect(await readCachedIndex(cacheDir, file)).toBeNull();
	});
});

describe('chapters', () => {
	it('parses, clamps and sorts ffprobe chapters', () => {
		const json = JSON.stringify({
			chapters: [
				{ start_time: '600.5', end_time: '1200', tags: { title: ' La Disparue ' } },
				{ start_time: '0.000000', end_time: '600.5', tags: {} },
				{ start_time: '1200', end_time: '9999' },
				{ start_time: 'x', end_time: '1' }
			]
		});
		expect(parseChapters(json, 1500)).toEqual([
			{ start: 0, end: 600.5, title: null },
			{ start: 600.5, end: 1200, title: 'La Disparue' },
			{ start: 1200, end: 1500, title: null }
		]);
		expect(parseChapters('nope', 10)).toEqual([]);
		// Names generated by authoring tools carry no meaning: they come back without a title.
		const generated = JSON.stringify({
			chapters: [
				{ start_time: '0', end_time: '207.332', tags: { title: '(01)00:00:00:000' } },
				{ start_time: '207.332', end_time: '529.278', tags: { title: '(02)00:03:27:332' } },
				{ start_time: '529.278', end_time: '900', tags: { title: 'Chapter 3' } },
				{ start_time: '900', end_time: '1000', tags: { title: 'Le signal' } }
			]
		});
		expect(parseChapters(generated, 1000).map((c) => c.title)).toEqual([
			null,
			null,
			null,
			'Le signal'
		]);
		expect(chaptersArgs('F:/a.mkv')).toEqual([
			'-v',
			'error',
			'-show_chapters',
			'-of',
			'json',
			'F:/a.mkv'
		]);
	});

	it('caches chapters per file identity', async () => {
		let calls = 0;
		const service = new ChapterService('ffprobe', async () => {
			calls++;
			return ok(JSON.stringify({ chapters: [{ start_time: '0', end_time: '5' }] }));
		});
		const file = { path: 'F:/a.mkv', size: 1, mtimeMs: 1, durationSeconds: 5 };
		await service.get(file);
		expect(await service.get(file)).toEqual([{ start: 0, end: 5, title: null }]);
		expect(calls).toBe(1);
	});
});

describe('subtitles', () => {
	const track = (p: Partial<SubtitleTrack>): SubtitleTrack => ({
		ordinal: 0,
		source: 'embedded',
		codec: 'subrip',
		language: 'fre',
		title: null,
		forced: false,
		isText: true,
		...p
	});
	let cacheDir: string;
	beforeEach(async () => {
		cacheDir = await tempDir();
	});

	it('detects legacy Windows-1252 French subtitles', () => {
		expect(detectCharset(new TextEncoder().encode('Déjà vu'))).toBeNull();
		expect(detectCharset(Uint8Array.from([0x44, 0xe9, 0x6a, 0xe0]))).toBe('CP1252');
		expect(detectCharset(Uint8Array.from([0xff, 0xfe, 0x41, 0]))).toBe('UTF-16LE');
	});

	it('builds read-only conversion commands', () => {
		expect(embeddedSubtitleArgs('F:/a.mkv', [{ streamOrdinal: 2, path: 'C:/c/2.vtt' }])).toEqual([
			'-hide_banner',
			'-nostdin',
			'-loglevel',
			'error',
			'-y',
			'-i',
			'F:/a.mkv',
			'-map',
			'0:s:2',
			'-c:s',
			'webvtt',
			'-f',
			'webvtt',
			'C:/c/2.vtt'
		]);
		const ext = externalSubtitleArgs('F:/a.fr.srt', 'CP1252', 'C:/c/3.vtt');
		expect(ext.slice(ext.indexOf('-sub_charenc'), ext.indexOf('-sub_charenc') + 4)).toEqual([
			'-sub_charenc',
			'CP1252',
			'-i',
			'F:/a.fr.srt'
		]);
	});

	it('extracts every embedded text track in one pass and refuses image subtitles', async () => {
		const calls: string[][] = [];
		const service = new SubtitleService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			run: async (_cmd, args) => {
				calls.push(args);
				for (const out of args.filter((a) => a.endsWith('.tmp.vtt')))
					await writeFile(out, 'WEBVTT\n');
				return ok();
			}
		});
		const file = {
			id: 'f1',
			path: 'F:/MOVIES/a.mkv',
			mtimeMs: 42,
			subtitleTracks: [
				track({ ordinal: 0 }),
				track({ ordinal: 1, codec: 'hdmv_pgs_subtitle', isText: false }),
				track({ ordinal: 2, language: 'eng' })
			]
		};
		const [first, second] = await Promise.all([
			service.get(file, 0, null),
			service.get(file, 2, null)
		]);
		expect(first).toBe(subtitleCachePath(cacheDir, 'f1', 42, 0));
		expect(await readFile(second, 'utf8')).toBe('WEBVTT\n');
		expect(calls).toHaveLength(1);
		expect(calls[0].filter((a) => a.startsWith('0:s:'))).toEqual(['0:s:0', '0:s:2']);
		await expect(service.get(file, 1, null)).rejects.toMatchObject({ status: 415 });
		await expect(service.get(file, 9, null)).rejects.toMatchObject({ status: 404 });
		await service.get(file, 0, null);
		expect(calls).toHaveLength(1);
	});

	it('converts an external sidecar with the detected charset', async () => {
		const sidecar = join(cacheDir, 'a.fr.srt');
		await writeFile(sidecar, Uint8Array.from([0x31, 0x0a, 0xe9]));
		const calls: string[][] = [];
		const service = new SubtitleService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			run: async (_cmd, args) => {
				calls.push(args);
				await writeFile(args[args.length - 1], 'WEBVTT\n');
				return ok();
			}
		});
		const file = {
			id: 'f2',
			path: 'F:/MOVIES/a.mkv',
			mtimeMs: 1,
			subtitleTracks: [track({ ordinal: 3, source: 'external' })]
		};
		const out = await service.get(file, 3, sidecar);
		expect(existsSync(out)).toBe(true);
		expect(calls[0]).toContain('CP1252');
		await expect(service.get({ ...file, id: 'f3' }, 3, null)).rejects.toMatchObject({
			status: 404
		});
	});

	it('prefetches embedded text tracks in the background once, and skips files without them', async () => {
		const calls: string[][] = [];
		const service = new SubtitleService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			run: async (_cmd, args) => {
				calls.push(args);
				for (const out of args.filter((a) => a.endsWith('.tmp.vtt')))
					await writeFile(out, 'WEBVTT\n');
				return ok();
			}
		});
		const queue = new BackgroundQueue(() => undefined);
		const file = {
			id: 'p1',
			path: 'F:/a.mkv',
			mtimeMs: 3,
			subtitleTracks: [track({ ordinal: 0 })]
		};
		expect(service.prefetch(file, queue)).toBe(true);
		await queue.idle();
		expect(existsSync(subtitleCachePath(cacheDir, 'p1', 3, 0))).toBe(true);
		service.prefetch(file, queue);
		await queue.idle();
		expect(calls).toHaveLength(1); // already extracted
		await service.get(file, 0, null);
		expect(calls).toHaveLength(1);
		const imageOnly = { ...file, id: 'p2', subtitleTracks: [track({ ordinal: 0, isText: false })] };
		expect(service.prefetch(imageOnly, queue)).toBe(false);
	});

	it('extracts through the background queue: after playback, with paced reads, cancellable', async () => {
		let open = false;
		const queue = new BackgroundQueue(() => undefined, { gate: () => open, pollMs: 5 });
		const calls: Array<{ args: string[]; stdinFile?: string; signal?: AbortSignal }> = [];
		const service = new SubtitleService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			queue,
			gate: () => open,
			run: async (_cmd, args, options) => {
				calls.push({ args, ...options });
				for (const out of args.filter((a) => a.endsWith('.tmp.vtt')))
					await writeFile(out, 'WEBVTT\n');
				return ok();
			}
		});
		const mkv = { id: 'q1', path: 'F:/MOVIES/a.mkv', mtimeMs: 5, subtitleTracks: [track({})] };
		const asked = service.get(mkv, 0, null);
		await new Promise((r) => setTimeout(r, 30));
		expect(calls).toHaveLength(0); // a session is still starting: the disk is the player's
		open = true;
		expect(await asked).toBe(subtitleCachePath(cacheDir, 'q1', 5, 0));
		// Matroska is piped through the paced reader; the input is never opened by ffmpeg itself.
		expect(calls[0].args[calls[0].args.indexOf('-i') + 1]).toBe('pipe:0');
		expect(calls[0].stdinFile).toBe('F:/MOVIES/a.mkv');
		expect(calls[0].signal).toBeInstanceOf(AbortSignal);
		const mp4 = { id: 'q2', path: 'F:/MOVIES/b.mp4', mtimeMs: 5, subtitleTracks: [track({})] };
		await service.get(mp4, 0, null);
		expect(calls[1].args[calls[1].args.indexOf('-i') + 1]).toBe('F:/MOVIES/b.mp4');
		expect(calls[1].stdinFile).toBeUndefined();

		// The owner left the film: its extraction is cancelled and the request answers 503.
		open = false;
		const left = { id: 'q3', path: 'F:/MOVIES/c.mkv', mtimeMs: 5, subtitleTracks: [track({})] };
		const pending = service.get(left, 0, null);
		await vi.waitFor(() => expect(queue.size).toBe(1));
		queue.cancelFile('q3');
		await expect(pending).rejects.toMatchObject({ status: 503 });
	});

	it('reports a failed conversion as 502', async () => {
		const service = new SubtitleService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			run: async () => fail()
		});
		const file = {
			id: 'f4',
			path: 'F:/a.mkv',
			mtimeMs: 1,
			subtitleTracks: [track({ ordinal: 0 })]
		};
		await expect(service.get(file, 0, null)).rejects.toMatchObject({ status: 502 });
	});
});

describe('trickplay', () => {
	const video = (p: Partial<VideoInfo> = {}): VideoInfo => ({
		codec: 'hevc',
		profile: 'Main 10',
		pixFmt: 'yuv420p10le',
		width: 3840,
		height: 1600,
		hdr: 'hdr10',
		...p
	});

	it('samples keyframes every 10 s into 480 px tiles of the picture shape, tone-mapping HDR', () => {
		// Sharp on a 460 ppi screen: a 216 CSS px preview needs 648 device px.
		expect(tileHeight(video())).toBe(200);
		expect(tileHeight(video({ width: 3840, height: 1744 }))).toBe(218);
		expect(tileHeight(video({ width: 1920, height: 1080 }))).toBe(270);
		const args = trickplayArgs('pipe:0', 'C:/t/sheet-%d.webp', video(), true);
		expect(args.slice(args.indexOf('-hwaccel'), args.indexOf('-hwaccel') + 6)).toEqual([
			'-hwaccel',
			'cuda',
			'-skip_frame',
			'nokey',
			'-i',
			'pipe:0'
		]);
		const vf = args[args.indexOf('-vf') + 1];
		expect(vf).toBe(
			'fps=fps=1/10:start_time=0,scale=w=480:h=200:flags=lanczos,format=yuv420p10le,zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,tile=6x6'
		);
		expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp');
		expect(args[args.indexOf('-quality') + 1]).toBe('72');
		const sdr = trickplayArgs('F:/a.mkv', 'x', video({ hdr: 'sdr' }), false);
		expect(sdr).not.toContain('-hwaccel');
		expect(sdr[sdr.indexOf('-vf') + 1]).not.toContain('tonemap');
	});

	it('reports pending, generates in the background, then ready with sheet URLs', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		const service = new TrickplayService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			queue,
			gpu: true,
			run: async (_cmd, args, options) => {
				inputs.push([args[args.indexOf('-i') + 1], options.stdinFile]);
				const pattern = args[args.length - 1];
				await writeFile(pattern.replace('%d', '0'), 'a');
				await writeFile(pattern.replace('%d', '1'), 'b');
				return ok();
			}
		});
		const inputs: Array<[string, string | undefined]> = [];
		const file = {
			id: 'f',
			path: 'F:/a.mkv',
			size: 1,
			mtimeMs: 1,
			durationSeconds: 1500,
			video: video()
		};
		const url = (n: number) => `/api/media/files/f/trickplay/${n}.webp`;
		expect(await service.manifest(file, url)).toMatchObject({ status: 'pending', sheets: [] });
		await queue.idle();
		expect(await service.manifest(file, url)).toEqual({
			status: 'ready',
			intervalSeconds: 10,
			tileWidth: 480,
			tileHeight: 200,
			columns: 6,
			rows: 6,
			sheets: [url(0), url(1)]
		});
		expect(await readFile(service.sheetPath(file, 1), 'utf8')).toBe('b');
		// Matroska goes through the paced reader.
		expect(inputs).toEqual([['pipe:0', 'F:/a.mkv']]);
	});

	it('regenerates sheets cached by an older version (240 px tiles)', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		let runs = 0;
		const service = new TrickplayService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			queue,
			gpu: false,
			run: async (_cmd, args) => {
				runs++;
				await writeFile(args[args.length - 1].replace('%d', '0'), 'new');
				return ok();
			}
		});
		const file = {
			id: 'f',
			path: 'F:/old.mkv',
			size: 1,
			mtimeMs: 1,
			durationSeconds: 100,
			video: video()
		};
		const dir = dirname(service.sheetPath(file, 0));
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'sheet-0.webp'), 'old');
		await writeFile(
			join(dir, 'manifest.json'),
			JSON.stringify({ tileWidth: 240, tileHeight: 100, sheets: 1 })
		);
		expect((await service.manifest(file, String)).status).toBe('pending');
		await queue.idle();
		expect(runs).toBe(1);
		expect(await service.manifest(file, String)).toMatchObject({ status: 'ready', tileWidth: 480 });
		expect(await readFile(service.sheetPath(file, 0), 'utf8')).toBe('new');
	});

	it('does not give up on a file whose generation was cancelled (the owner left)', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		const service = new TrickplayService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			queue,
			gpu: false,
			run: (_cmd, _args, { signal }) =>
				new Promise((resolve) =>
					signal?.aborted
						? resolve(fail())
						: signal?.addEventListener('abort', () => resolve(fail()))
				)
		});
		const file = {
			id: 'gone',
			path: 'F:/c.mkv',
			size: 1,
			mtimeMs: 1,
			durationSeconds: 100,
			video: video()
		};
		await service.manifest(file, String);
		await vi.waitFor(() => expect(queue.active).not.toBeNull());
		queue.cancelFile('gone');
		await queue.idle();
		expect((await service.manifest(file, String)).status).toBe('pending');
		queue.cancelFile('gone');
		await queue.idle();
	});

	it('marks a file unavailable after a failed generation or without video', async () => {
		const cacheDir = await tempDir();
		const queue = new BackgroundQueue(() => undefined);
		const service = new TrickplayService({
			cacheDir,
			ffmpegPath: 'ffmpeg',
			queue,
			gpu: false,
			run: async () => fail()
		});
		const file = {
			id: 'f',
			path: 'F:/b.mkv',
			size: 1,
			mtimeMs: 1,
			durationSeconds: 100,
			video: video()
		};
		await service.manifest(file, String);
		await queue.idle();
		expect((await service.manifest(file, String)).status).toBe('unavailable');
		expect((await service.manifest({ ...file, video: null }, String)).status).toBe('unavailable');
	});
});
