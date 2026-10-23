import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunInput } from './ffmpeg-args';
import {
	MediaSessionManager,
	SessionError,
	type RunProcess,
	type SessionSpec
} from './session-manager';
import type { StreamPlan } from './stream-plan';
import { concat, fragment, initSegment } from './testing/fmp4-fixtures';

class FakeChild extends EventEmitter {
	stdout = new PassThrough();
	stderr = new PassThrough();
	killed = false;
	constructor(readonly start: number) {
		super();
	}
	kill() {
		this.killed = true;
		setImmediate(() => this.emit('close', null));
	}
	/** Writes the init segment and fragments of segments [from, to) (one 4 s fragment each). */
	produce(from: number, to: number, extra: Uint8Array[] = []) {
		const parts: Uint8Array[] = [];
		if (!this.wroteInit) parts.push(INIT);
		this.wroteInit = true;
		parts.push(...extra);
		for (let k = from; k < to; k++) parts.push(frag(k * 4));
		this.stdout.write(concat(parts));
	}
	finish(code = 0) {
		this.stdout.end();
		setImmediate(() => this.emit('close', code));
	}
	wroteInit = false;
}

const INIT = initSegment([
	{ id: 1, kind: 'vide', timescale: 1000 },
	{ id: 2, kind: 'soun', timescale: 1000 }
]);

function frag(t: number, length = 4, sequence = 1) {
	// ffmpeg adds TIMELINE_OFFSET (1 s) to every timestamp.
	return fragment(sequence, [
		{ trackId: 1, decodeTime: (t + 1) * 1000, durations: [length * 1000] },
		{ trackId: 2, decodeTime: (t + 1) * 1000, durations: [length * 1000] }
	]);
}

const BOUNDARIES = Array.from({ length: 100 }, (_, k) => k * 4);
const PLAN = { video: { mode: 'copy' } } as unknown as StreamPlan;

function spec(partial: Partial<SessionSpec> = {}): SessionSpec {
	return {
		ownerId: 'owner',
		fileId: 'file-1',
		inputPath: 'F:/MOVIES/a.mkv',
		plan: PLAN,
		boundaries: BOUNDARIES,
		durationSeconds: 400,
		startSegment: 0,
		variant: { bandwidth: 1e6, width: 1920, height: 1080, frameRate: 24, videoRange: 'SDR' },
		...partial
	};
}

let dir: string;
let children: FakeChild[];
let clock: number;
let manager: MediaSessionManager;
let logs: string[];

function makeManager(overrides: Record<string, unknown> = {}) {
	return new MediaSessionManager({
		cacheDir: dir,
		spawn: (args: string[]) => {
			const child = new FakeChild(Number(args[0]));
			children.push(child);
			return child as unknown as RunProcess;
		},
		buildArgs: (input: RunInput) => [String(BOUNDARIES.indexOf(input.startSeconds))],
		now: () => clock,
		segmentTimeoutMs: 2000,
		initTimeoutMs: 2000,
		log: (m: string) => logs.push(m),
		...overrides
	});
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 40));

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'sessions-'));
	children = [];
	clock = 1_000_000;
	logs = [];
	manager = makeManager();
});

afterEach(async () => {
	manager.shutdown();
	await rm(dir, { recursive: true, force: true });
});

describe('MediaSessionManager', () => {
	it('starts one run at the requested segment and serves the VOD playlist', async () => {
		const { id } = await manager.create(spec({ startSegment: 3 }));
		expect(id).toMatch(/^[0-9a-f]{32}$/u);
		expect(children.map((c) => c.start)).toEqual([3]);
		const playlist = manager.playlist(id, 'owner');
		expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
		expect(playlist.match(/seg-\d+\.m4s/gu)).toHaveLength(100);
		expect(() => manager.playlist(id, 'someone-else')).toThrowError(SessionError);
	});

	it('waits for the init segment and then for a completed segment', async () => {
		const { id } = await manager.create(spec());
		const init = manager.init(id, 'owner');
		const seg0 = manager.segment(id, 'owner', 0);
		children[0].produce(0, 1);
		expect(await init).toEqual(INIT);
		let done = false;
		void seg0.then(() => (done = true));
		await tick();
		expect(done).toBe(false); // segment 0 completes when segment 1 starts
		children[0].produce(1, 2);
		const file = await seg0;
		const bytes = new Uint8Array(await readFile(file.path));
		expect(file.size).toBe(bytes.length);
		// mfhd sequence renumbered to segment*1000 + n
		const expected = frag(0, 4, 1);
		expect(bytes).toEqual(expected);
		expect(existsSync(`${file.path}.tmp`)).toBe(false);
	});

	it('drops pre-roll fragments before the run start segment', async () => {
		const { id } = await manager.create(spec({ startSegment: 5 }));
		const seg = manager.segment(id, 'owner', 5);
		// ffmpeg landed one GOP early (16.0 s instead of 20.0 s)
		children[0].produce(5, 7, [frag(16)]);
		const file = await seg;
		const bytes = new Uint8Array(await readFile(file.path));
		expect(bytes).toEqual(frag(20, 4, 5001));
	});

	it('restarts at a requested segment far ahead of production or before the run', async () => {
		const { id } = await manager.create(spec());
		children[0].produce(0, 3);
		await tick();
		void manager.segment(id, 'owner', 50).catch(() => undefined);
		await tick();
		expect(children.map((c) => c.start)).toEqual([0, 50]);
		expect(children[0].killed).toBe(true);
		void manager.segment(id, 'owner', 10).catch(() => undefined);
		await tick();
		expect(children.map((c) => c.start)).toEqual([0, 50, 10]);
		// a request a few segments ahead of production waits for the same run
		void manager.segment(id, 'owner', 15).catch(() => undefined);
		await tick();
		expect(children).toHaveLength(3);
	});

	it('serves a ready segment from disk without restarting', async () => {
		const { id } = await manager.create(spec());
		children[0].produce(0, 4);
		// Segment files are written asynchronously: wait for them instead of a fixed tick (flaky
		// under a loaded test run).
		await vi.waitFor(() => expect(manager.summary(id)?.readySegments).toEqual([0, 1, 2]));
		const file = await manager.segment(id, 'owner', 1);
		expect(file.size).toBeGreaterThan(0);
		expect(children).toHaveLength(1);
	});

	it('pauses production far ahead of the player and resumes on demand', async () => {
		manager.shutdown();
		manager = makeManager({ lookahead: 3 });
		const { id } = await manager.create(spec());
		const first = manager.segment(id, 'owner', 0);
		children[0].produce(0, 6);
		await first;
		await vi.waitFor(() => expect(manager.summary(id)?.paused).toBe(true));
		expect(children[0].stdout.isPaused()).toBe(true);
		await manager.segment(id, 'owner', 3);
		expect(manager.summary(id)?.paused).toBe(false);
		expect(children[0].stdout.isPaused()).toBe(false);
	});

	it('times out a segment that never arrives', async () => {
		manager.shutdown();
		manager = makeManager({ segmentTimeoutMs: 40 });
		const { id } = await manager.create(spec());
		await expect(manager.segment(id, 'owner', 0)).rejects.toMatchObject({ status: 504 });
	});

	it('rejects waiters with 502 when ffmpeg fails', async () => {
		const { id } = await manager.create(spec());
		const seg = manager.segment(id, 'owner', 2);
		children[0].stderr.write('Error opening input');
		children[0].finish(1);
		await expect(seg).rejects.toMatchObject({ status: 502 });
		expect(logs.join('\n')).toContain('ffmpeg exited with 1');
	});

	it('flushes the final segment when ffmpeg reaches the end of the file', async () => {
		const { id } = await manager.create(
			spec({ boundaries: [0, 4, 8], durationSeconds: 12, startSegment: 0 })
		);
		const last = manager.segment(id, 'owner', 2);
		children[0].produce(0, 3);
		children[0].finish(0);
		expect((await last).size).toBeGreaterThan(0);
	});

	it('reports segments a run skips as unavailable', async () => {
		const { id } = await manager.create(spec());
		const missing = manager.segment(id, 'owner', 1);
		// no keyframe at 4 s: the stream jumps from segment 0 to segment 2
		children[0].stdout.write(concat([INIT, frag(0, 8), frag(8)]));
		await expect(missing).rejects.toMatchObject({ status: 502 });
	});

	it('goes dormant when idle, freeing the process and disk, then resumes', async () => {
		const { id } = await manager.create(spec());
		children[0].produce(0, 3);
		const sessionDir = join(manager.root, id);
		// Files are written asynchronously: wait for them rather than a fixed tick.
		await vi.waitFor(() => expect(existsSync(join(sessionDir, 'seg-0.m4s'))).toBe(true));
		clock += 121_000;
		await manager.sweep();
		expect(children[0].killed).toBe(true);
		expect(existsSync(sessionDir)).toBe(false);
		expect(manager.summary(id)?.state).toBe('dormant');
		// the init segment is kept in memory; a segment request restarts at that segment
		expect(await manager.init(id, 'owner')).toEqual(INIT);
		void manager.segment(id, 'owner', 2).catch(() => undefined);
		await vi.waitFor(() => {
			expect(children.map((c) => c.start)).toEqual([0, 2]);
			expect(existsSync(sessionDir)).toBe(true);
		});
	});

	it('forgets sessions dormant for hours', async () => {
		const { id } = await manager.create(spec());
		clock += 7 * 3600_000;
		await manager.sweep();
		expect(manager.summary(id)).toBeNull();
		expect(() => manager.playlist(id, 'owner')).toThrowError(SessionError);
	});

	it('keeps at most two sessions per owner, stopping the oldest', async () => {
		const a = await manager.create(spec());
		clock += 1;
		const b = await manager.create(spec());
		clock += 1;
		await manager.create(spec({ ownerId: 'other' }));
		clock += 1;
		const c = await manager.create(spec());
		expect(manager.summary(a.id)).toBeNull();
		expect(children[0].killed).toBe(true);
		expect(manager.summary(b.id)).not.toBeNull();
		expect(manager.summary(c.id)).not.toBeNull();
	});

	it('stops a session on DELETE and only for its owner', async () => {
		const { id } = await manager.create(spec());
		const pending = manager.segment(id, 'owner', 0);
		expect(manager.stop(id, 'intruder')).toBe(false);
		expect(manager.stop(id, 'owner')).toBe(true);
		await expect(pending).rejects.toMatchObject({ status: 410 });
		expect(children[0].killed).toBe(true);
		await expect(manager.segment(id, 'owner', 0)).rejects.toMatchObject({ status: 404 });
	});

	it('rejects out-of-range segment numbers', async () => {
		const { id } = await manager.create(spec());
		await expect(manager.segment(id, 'owner', 100)).rejects.toMatchObject({ status: 404 });
		await expect(manager.segment(id, 'owner', -1)).rejects.toMatchObject({ status: 404 });
		await expect(manager.segment(id, 'owner', 1.5)).rejects.toMatchObject({ status: 404 });
	});

	it('logs a run that writes a different init segment', async () => {
		const { id } = await manager.create(spec());
		children[0].produce(0, 1);
		await manager.init(id, 'owner');
		void manager.segment(id, 'owner', 60).catch(() => undefined);
		await tick();
		children[1].stdout.write(
			concat([initSegment([{ id: 1, kind: 'vide', timescale: 90000 }]), frag(240)])
		);
		await tick();
		expect(logs.join('\n')).toContain('different init segment');
	});

	it('kills every child on shutdown', async () => {
		await manager.create(spec());
		await manager.create(spec({ ownerId: 'b' }));
		manager.shutdown();
		expect(children.every((c) => c.killed)).toBe(true);
	});

	it('keeps its segments in a folder of its own process', async () => {
		const { id } = await manager.create(spec());
		children[0].produce(0, 2);
		await manager.segment(id, 'owner', 0);
		expect(manager.root).toMatch(/[\\/]sessions[\\/]\d+-[0-9a-f]{8}$/u);
		expect(existsSync(join(manager.root, id, 'seg-0.m4s'))).toBe(true);
	});

	it('never deletes the sessions of another live server sharing the cache', async () => {
		// Another dev server (pid 4242, alive) is streaming from the same cache folder.
		const other = makeManager({ pid: 4242, isAlive: (pid: number) => pid === 4242 });
		const { id: theirs } = await other.create(spec());
		children[0].produce(0, 2);
		await other.segment(theirs, 'owner', 0);
		const theirFile = join(other.root, theirs, 'seg-0.m4s');
		// A dead server left its folder behind; a legacy layout folder is hours old.
		const dead = join(dir, 'sessions', '999999-deadbeef');
		await mkdir(join(dead, 'x'), { recursive: true });
		const legacy = join(dir, 'sessions', 'a'.repeat(32));
		await mkdir(legacy, { recursive: true });
		const old = new Date(Date.now() - 7 * 3600_000);
		await utimes(legacy, old, old);
		const recentLegacy = join(dir, 'sessions', 'b'.repeat(32));
		await mkdir(recentLegacy, { recursive: true });

		// This server starts (pid 5151) and creates its first session.
		const mine = makeManager({ pid: 5151, isAlive: (pid: number) => pid === 4242 || pid === 5151 });
		await mine.create(spec({ ownerId: 'me' }));
		expect(existsSync(theirFile)).toBe(true);
		expect(existsSync(dead)).toBe(false);
		expect(existsSync(legacy)).toBe(false);
		expect(existsSync(recentLegacy)).toBe(true);
		expect(mine.root).not.toBe(other.root);
		other.shutdown();
		mine.shutdown();
	});

	it('reports when a session is reading the library (starting, waiting or producing)', async () => {
		manager.shutdown();
		manager = makeManager({ lookahead: 3 });
		expect(manager.busy()).toBe(false);
		const { id } = await manager.create(spec());
		expect(manager.busy()).toBe(true); // starting: no init segment yet
		const first = manager.segment(id, 'owner', 0);
		children[0].produce(0, 6);
		await first;
		await vi.waitFor(() => expect(manager.summary(id)?.paused).toBe(true));
		expect(manager.busy()).toBe(false); // far ahead, production paused
		const far = manager.segment(id, 'owner', 50).catch(() => undefined);
		await tick();
		expect(manager.busy()).toBe(true); // a seek: new run, a waiter
		manager.stop(id, 'owner');
		await far;
		expect(manager.busy()).toBe(false);
	});

	it('tells when the last session of a file is gone', async () => {
		const removed: string[] = [];
		manager.shutdown();
		manager = makeManager({ onRemoved: (fileId: string) => removed.push(fileId) });
		const a = await manager.create(spec({ fileId: 'f-a' }));
		clock += 1;
		const b = await manager.create(spec({ fileId: 'f-a' }));
		manager.stop(a.id, 'owner');
		await tick();
		expect(removed).toEqual([]); // another session still plays that file (a quality switch)
		manager.stop(b.id, 'owner');
		await tick();
		expect(removed).toEqual(['f-a']);
	});

	it('builds a master playlist with codecs from the init segment', async () => {
		const { id } = await manager.create(spec());
		const master = manager.master(id, 'owner');
		children[0].produce(0, 1);
		const text = await master;
		expect(text).toContain('#EXT-X-STREAM-INF:BANDWIDTH=1000000');
		expect(text).toContain('index.m3u8');
	});

	it('ignores output from a killed run', async () => {
		const { id } = await manager.create(spec());
		void manager.segment(id, 'owner', 40).catch(() => undefined);
		await tick();
		children[0].produce(0, 3);
		await tick();
		expect(manager.summary(id)?.readySegments).toEqual([]);
		vi.clearAllTimers();
	});
});
