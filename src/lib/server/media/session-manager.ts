// Playback sessions: one ffmpeg run per session producing keyframe-aligned HLS segments on demand.
//
// A segment request is served from disk when ready, waits when the current run will reach it soon,
// and otherwise restarts the run at that segment (seek). Production pauses (stdout backpressure,
// which blocks ffmpeg) when it is far ahead of the player. Idle sessions free their process and
// disk space but keep their init segment, so a long pause resumes seamlessly.

import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { buildStreamArgs, TIMELINE_OFFSET, type RunInput } from './ffmpeg-args';
import { codecsFromInit, masterPlaylist, mediaPlaylist, type MasterVariant } from './playlist';
import { SegmentAssembler, type AssembledSegment } from './segment-assembler';
import type { StreamPlan } from './stream-plan';

export interface RunProcess {
	stdout: Readable;
	stderr: Readable;
	kill(): void;
	on(event: 'close', listener: (code: number | null) => void): unknown;
	on(event: 'error', listener: (error: Error) => void): unknown;
}

export type RunSpawner = (args: string[]) => RunProcess;

export class SessionError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export interface SessionSpec {
	ownerId: string;
	fileId: string;
	inputPath: string;
	plan: StreamPlan;
	boundaries: number[];
	durationSeconds: number;
	startSegment: number;
	variant: Omit<MasterVariant, 'codecs'>;
}

export interface SegmentFile {
	path: string;
	size: number;
}

export interface SessionManagerOptions {
	cacheDir: string;
	spawn: RunSpawner;
	buildArgs?: (input: RunInput) => string[];
	now?: () => number;
	idleMs?: number;
	dormantMs?: number;
	maxPerOwner?: number;
	segmentTimeoutMs?: number;
	initTimeoutMs?: number;
	lookahead?: number;
	restartAhead?: number;
	keepBehind?: number;
	maxSessionBytes?: number;
	log?: (message: string) => void;
	/** Called once the last session of a file is gone (its background jobs can stop). */
	onRemoved?: (fileId: string) => void;
	/** This process id, and whether another server process is still running (tests inject). */
	pid?: number;
	isAlive?: (pid: number) => boolean;
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the process exists but belongs to someone else.
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

const PROCESS_DIR = /^(\d+)-[0-9a-f]{8}$/u;

interface Waiter {
	resolve: (file: SegmentFile) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

interface InitWaiter {
	resolve: (init: Uint8Array) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

interface Run {
	child: RunProcess;
	start: number;
	assembler: SegmentAssembler;
	paused: boolean;
	exited: boolean;
	killed: boolean;
	stderr: string;
	writes: Promise<void>;
	pending: Set<number>; // assembled, being written to disk
	missing: Set<number>;
}

interface Session {
	id: string;
	spec: SessionSpec;
	dir: string;
	createdAt: number;
	lastActivity: number;
	lastRequested: number;
	state: 'active' | 'dormant';
	init: Uint8Array | null;
	initWaiters: InitWaiter[];
	ready: Map<number, number>;
	bytes: number;
	waiters: Map<number, Waiter[]>;
	run: Run | null;
	playlist: string;
}

export interface SessionSummary {
	id: string;
	ownerId: string;
	fileId: string;
	state: 'active' | 'dormant';
	running: boolean;
	paused: boolean;
	runStart: number | null;
	next: number | null;
	readySegments: number[];
}

export class MediaSessionManager {
	private readonly sessions = new Map<string, Session>();
	private readonly cleaned: Promise<void>;
	private sweeper: ReturnType<typeof setInterval> | null = null;
	private readonly o: Required<SessionManagerOptions>;
	/** This process's own folder: sessions/<pid>-<random>. Other servers may share the cache. */
	readonly root: string;

	constructor(options: SessionManagerOptions) {
		this.o = {
			buildArgs: buildStreamArgs,
			now: Date.now,
			idleMs: 120_000,
			dormantMs: 6 * 3600_000,
			maxPerOwner: 2,
			segmentTimeoutMs: 60_000,
			initTimeoutMs: 45_000,
			lookahead: 30,
			restartAhead: 8,
			keepBehind: 40,
			maxSessionBytes: 4 * 1024 ** 3,
			log: (message) => console.warn(`[media] ${message}`),
			onRemoved: () => undefined,
			pid: process.pid,
			isAlive: processAlive,
			...options
		};
		this.root = join(this.sessionsRoot(), `${this.o.pid}-${randomBytes(4).toString('hex')}`);
		this.cleaned = this.removeStaleFolders().catch(() => undefined);
	}

	private sessionsRoot(): string {
		return join(this.o.cacheDir, 'sessions');
	}

	/**
	 * Deletes only what no running server uses: folders of processes that are gone, and any folder
	 * (including the older one-folder-per-session layout) untouched for longer than the dormant TTL.
	 */
	private async removeStaleFolders(): Promise<void> {
		const base = this.sessionsRoot();
		const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
		const now = Date.now();
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const path = join(base, entry.name);
			const owner = PROCESS_DIR.exec(entry.name);
			let stale = owner !== null && !this.o.isAlive(Number(owner[1]));
			if (!stale) {
				const info = await stat(path).catch(() => null);
				stale = !!info && now - info.mtimeMs > this.o.dormantMs;
			}
			if (stale) await rm(path, { recursive: true, force: true }).catch(() => undefined);
		}
	}

	/**
	 * Whether a session is reading the library right now: starting (no init segment yet), waiting
	 * for a segment (start, seek, switch) or producing ahead and not yet paused by backpressure.
	 * Background whole-file jobs read only while this is false.
	 */
	busy(): boolean {
		for (const session of this.sessions.values()) {
			if (session.state !== 'active') continue;
			const run = session.run && !session.run.exited ? session.run : null;
			if (!session.init && run) return true;
			if (session.waiters.size > 0 || session.initWaiters.length > 0) return true;
			if (run && !run.paused) return true;
		}
		return false;
	}

	startSweeper(intervalMs = 15_000): void {
		if (this.sweeper) return;
		this.sweeper = setInterval(() => void this.sweep(), intervalMs);
		this.sweeper.unref?.();
	}

	async create(spec: SessionSpec): Promise<{ id: string }> {
		await this.cleaned;
		const mine = [...this.sessions.values()]
			.filter((s) => s.spec.ownerId === spec.ownerId)
			.sort((a, b) => a.createdAt - b.createdAt);
		while (mine.length >= this.o.maxPerOwner) {
			const oldest = mine.shift()!;
			await this.remove(oldest, 'Replaced by a newer session');
		}
		const id = randomBytes(16).toString('hex');
		const now = this.o.now();
		const start = Math.min(Math.max(0, spec.startSegment), spec.boundaries.length - 1);
		const session: Session = {
			id,
			spec,
			dir: join(this.root, id),
			createdAt: now,
			lastActivity: now,
			lastRequested: start,
			state: 'active',
			init: null,
			initWaiters: [],
			ready: new Map(),
			bytes: 0,
			waiters: new Map(),
			run: null,
			playlist: mediaPlaylist(spec.boundaries, spec.durationSeconds)
		};
		await mkdir(session.dir, { recursive: true });
		this.sessions.set(id, session);
		this.startRun(session, start);
		return { id };
	}

	private get(id: string, ownerId: string): Session {
		const session = this.sessions.get(id);
		if (!session || session.spec.ownerId !== ownerId) {
			throw new SessionError(404, 'Playback session not found');
		}
		session.lastActivity = this.o.now();
		return session;
	}

	summary(id: string): SessionSummary | null {
		const s = this.sessions.get(id);
		if (!s) return null;
		const live = s.run && !s.run.exited ? s.run : null;
		return {
			id: s.id,
			ownerId: s.spec.ownerId,
			fileId: s.spec.fileId,
			state: s.state,
			running: !!live,
			paused: live?.paused ?? false,
			runStart: live?.start ?? null,
			next: live?.assembler.next ?? null,
			readySegments: [...s.ready.keys()].sort((a, b) => a - b)
		};
	}

	playlist(id: string, ownerId: string): string {
		return this.get(id, ownerId).playlist;
	}

	async master(id: string, ownerId: string): Promise<string> {
		const session = this.get(id, ownerId);
		const init = await this.init(id, ownerId);
		return masterPlaylist({ ...session.spec.variant, codecs: codecsFromInit(init) });
	}

	async init(id: string, ownerId: string): Promise<Uint8Array> {
		const session = this.get(id, ownerId);
		if (session.init) return session.init;
		if (session.state === 'dormant') await this.activate(session);
		if (!session.run || session.run.exited) this.startRun(session, session.lastRequested);
		return new Promise((resolve, reject) => {
			const waiter: InitWaiter = {
				resolve,
				reject,
				timer: setTimeout(() => {
					session.initWaiters = session.initWaiters.filter((w) => w !== waiter);
					reject(new SessionError(504, 'The stream did not start in time'));
				}, this.o.initTimeoutMs)
			};
			session.initWaiters.push(waiter);
		});
	}

	async segment(id: string, ownerId: string, index: number): Promise<SegmentFile> {
		const session = this.get(id, ownerId);
		if (!Number.isInteger(index) || index < 0 || index >= session.spec.boundaries.length) {
			throw new SessionError(404, 'Segment not found');
		}
		session.lastRequested = index;
		if (session.state === 'dormant') await this.activate(session);

		const size = session.ready.get(index);
		if (size !== undefined) {
			this.evict(session, index);
			this.resumeIfNeeded(session);
			return { path: this.segmentPath(session, index), size };
		}

		const run = session.run;
		const live = run && !run.exited ? run : null;
		if (live?.missing.has(index)) throw new SessionError(502, 'Segment unavailable');
		const reachable =
			!!live &&
			(live.pending.has(index) ||
				(index >= live.assembler.next && index <= live.assembler.next + this.o.restartAhead));
		if (!reachable) this.startRun(session, index);
		this.resumeIfNeeded(session);
		this.evict(session, index);
		return this.waitFor(session, index);
	}

	stop(id: string, ownerId: string): boolean {
		const session = this.sessions.get(id);
		if (!session || session.spec.ownerId !== ownerId) return false;
		void this.remove(session, 'Playback session stopped');
		return true;
	}

	/** Frees idle sessions (process + segments) and forgets long-dormant ones. */
	async sweep(now = this.o.now()): Promise<void> {
		for (const session of [...this.sessions.values()]) {
			const idle = now - session.lastActivity;
			if (idle > this.o.dormantMs) {
				await this.remove(session, 'Playback session expired');
			} else if (session.state === 'active' && idle > this.o.idleMs) {
				this.stopRun(session);
				this.rejectAll(session, new SessionError(410, 'Playback session idle'));
				session.state = 'dormant';
				session.ready.clear();
				session.bytes = 0;
				await rm(session.dir, { recursive: true, force: true }).catch(() => undefined);
			}
		}
	}

	/** Kills every ffmpeg child (process exit). Synchronous on purpose. */
	shutdown(): void {
		if (this.sweeper) clearInterval(this.sweeper);
		for (const session of this.sessions.values()) this.stopRun(session);
	}

	private async activate(session: Session): Promise<void> {
		session.state = 'active';
		await mkdir(session.dir, { recursive: true });
	}

	private async remove(session: Session, reason: string): Promise<void> {
		this.sessions.delete(session.id);
		this.stopRun(session);
		this.rejectAll(session, new SessionError(410, reason));
		const fileId = session.spec.fileId;
		if (![...this.sessions.values()].some((s) => s.spec.fileId === fileId)) {
			try {
				this.o.onRemoved(fileId);
			} catch (error) {
				this.o.log(`session ${session.id}: onRemoved failed (${String(error)})`);
			}
		}
		await rm(session.dir, { recursive: true, force: true }).catch(() => undefined);
	}

	private segmentPath(session: Session, index: number): string {
		return join(session.dir, `seg-${index}.m4s`);
	}

	private waitFor(session: Session, index: number): Promise<SegmentFile> {
		return new Promise((resolve, reject) => {
			const list = session.waiters.get(index) ?? [];
			const waiter: Waiter = {
				resolve,
				reject,
				timer: setTimeout(() => {
					const remaining = (session.waiters.get(index) ?? []).filter((w) => w !== waiter);
					if (remaining.length) session.waiters.set(index, remaining);
					else session.waiters.delete(index);
					reject(new SessionError(504, 'Segment not ready in time'));
				}, this.o.segmentTimeoutMs)
			};
			list.push(waiter);
			session.waiters.set(index, list);
		});
	}

	private settle(session: Session, index: number, outcome: SegmentFile | Error): void {
		const list = session.waiters.get(index);
		if (!list) return;
		session.waiters.delete(index);
		for (const waiter of list) {
			clearTimeout(waiter.timer);
			if (outcome instanceof Error) waiter.reject(outcome);
			else waiter.resolve(outcome);
		}
	}

	private rejectAll(session: Session, error: Error, below?: number): void {
		for (const index of [...session.waiters.keys()]) {
			if (below === undefined || index < below) this.settle(session, index, error);
		}
		if (below === undefined) {
			for (const waiter of session.initWaiters) {
				clearTimeout(waiter.timer);
				waiter.reject(error);
			}
			session.initWaiters = [];
		}
	}

	private stopRun(session: Session): void {
		const run = session.run;
		session.run = null;
		if (!run || run.exited) return;
		run.killed = true;
		try {
			run.child.kill();
		} catch {
			// already gone
		}
		run.child.stdout.destroy();
	}

	private startRun(session: Session, start: number): void {
		this.stopRun(session);
		// Requests before the new start belong to an abandoned position (the player moved on).
		this.rejectAll(session, new SessionError(409, 'Superseded by a seek'), start);
		const args = this.o.buildArgs({
			inputPath: session.spec.inputPath,
			startSeconds: session.spec.boundaries[start],
			plan: session.spec.plan
		});
		const child = this.o.spawn(args);
		const run: Run = {
			child,
			start,
			paused: false,
			exited: false,
			killed: false,
			stderr: '',
			writes: Promise.resolve(),
			pending: new Set(),
			missing: new Set(),
			assembler: null as unknown as SegmentAssembler
		};
		run.assembler = new SegmentAssembler({
			boundaries: session.spec.boundaries,
			startIndex: start,
			offset: TIMELINE_OFFSET,
			onInit: (init) => this.onInit(session, run, init),
			onSegment: (segment) => {
				run.pending.add(segment.index);
				run.writes = run.writes
					.then(() => this.store(session, run, segment))
					.finally(() => run.pending.delete(segment.index));
			},
			onMissing: (from, to) => {
				for (let k = from; k <= to; k++) {
					run.missing.add(k);
					this.settle(session, k, new SessionError(502, 'Segment unavailable'));
				}
			}
		});
		session.run = run;
		child.stdout.on('data', (chunk: Uint8Array) => {
			if (run.killed) return;
			try {
				run.assembler.push(chunk);
			} catch (error) {
				this.o.log(`session ${session.id}: unreadable ffmpeg output (${String(error)})`);
				this.fail(session, run);
			}
		});
		child.stderr.on('data', (chunk: Uint8Array) => {
			run.stderr = (run.stderr + Buffer.from(chunk).toString('utf8')).slice(-4000);
		});
		child.on('error', (error) => {
			run.stderr += `\n${error.message}`;
		});
		child.on('close', (code) => this.onClose(session, run, code));
	}

	private fail(session: Session, run: Run): void {
		if (session.run === run) this.stopRun(session);
		this.rejectAll(session, new SessionError(502, 'Streaming failed'));
	}

	private onInit(session: Session, run: Run, init: Uint8Array): void {
		if (!session.init) {
			session.init = init;
			for (const waiter of session.initWaiters) {
				clearTimeout(waiter.timer);
				waiter.resolve(init);
			}
			session.initWaiters = [];
		} else if (Buffer.compare(Buffer.from(session.init), Buffer.from(init)) !== 0) {
			this.o.log(
				`session ${session.id}: run at segment ${run.start} wrote a different init segment`
			);
		}
	}

	private async store(session: Session, run: Run, segment: AssembledSegment): Promise<void> {
		if (run.killed || this.sessions.get(session.id) !== session || session.state !== 'active') {
			return;
		}
		const path = this.segmentPath(session, segment.index);
		if (!session.ready.has(segment.index)) {
			const temp = `${path}.tmp`;
			try {
				await writeFile(temp, segment.bytes);
				await rename(temp, path);
			} catch (error) {
				if (!run.killed)
					this.o.log(`session ${session.id}: cannot store segment (${String(error)})`);
				return;
			}
			session.ready.set(segment.index, segment.bytes.length);
			session.bytes += segment.bytes.length;
		}
		this.settle(session, segment.index, { path, size: session.ready.get(segment.index)! });
		if (
			session.run === run &&
			!run.paused &&
			segment.index - session.lastRequested >= this.o.lookahead
		) {
			run.paused = true;
			run.child.stdout.pause();
		}
	}

	private resumeIfNeeded(session: Session): void {
		const run = session.run;
		if (!run || !run.paused || run.exited) return;
		if (run.assembler.next - session.lastRequested < this.o.lookahead) {
			run.paused = false;
			run.child.stdout.resume();
		}
	}

	private evict(session: Session, current: number): void {
		const drop = (index: number) => {
			const size = session.ready.get(index) ?? 0;
			session.ready.delete(index);
			session.bytes -= size;
			void rm(this.segmentPath(session, index), { force: true }).catch(() => undefined);
		};
		for (const index of [...session.ready.keys()]) {
			if (index < current - this.o.keepBehind) drop(index);
		}
		if (session.bytes > this.o.maxSessionBytes) {
			const byDistance = [...session.ready.keys()]
				.filter((index) => Math.abs(index - current) > 2)
				.sort((a, b) => Math.abs(b - current) - Math.abs(a - current));
			for (const index of byDistance) {
				if (session.bytes <= this.o.maxSessionBytes) break;
				drop(index);
			}
		}
	}

	private onClose(session: Session, run: Run, code: number | null): void {
		run.exited = true;
		if (run.killed) return;
		if (code === 0) run.assembler.finish();
		void run.writes.then(() => {
			if (session.run !== run) return;
			if (code !== 0) {
				const detail = run.stderr.trim().split(/\r?\n/u).slice(-3).join(' | ');
				this.o.log(`session ${session.id}: ffmpeg exited with ${code} (${detail})`);
			}
			this.rejectAll(
				session,
				new SessionError(502, code === 0 ? 'Segment unavailable' : 'Streaming failed')
			);
		});
	}
}
