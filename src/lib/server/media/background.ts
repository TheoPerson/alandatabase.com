// One-at-a-time queue for every whole-file job on the library disk: keyframe scans, subtitle
// extraction (prefetched or asked by the player) and trickplay sheets. Running them in parallel
// would only thrash the HDD and starve playback, so:
// - one job runs at a time, higher priority first, deduplicated by key;
// - a job starts only while the gate is open (no playback session is starting, seeking or
//   producing: see MediaSessionManager.busy), and the jobs pace their own reads with the same gate;
// - a more urgent job preempts a running preemptible one, which runs again afterwards;
// - jobs of a file the owner has left (Close, next episode) are cancelled.

export interface QueueJob {
	key: string;
	priority: number;
	/** The job is aborted through `signal` when cancelled or preempted. */
	run: (signal: AbortSignal) => Promise<void>;
	/** The media file the job reads; cancelFile() stops its jobs. */
	fileId?: string;
	/** May be aborted for a more urgent job and run again later (default false). */
	preemptible?: boolean;
}

export class JobCancelledError extends Error {
	constructor(key: string) {
		super(`Background job ${key} was cancelled`);
		this.name = 'JobCancelledError';
	}
}

interface Entry extends QueueJob {
	controller: AbortController;
	waiters: Array<{ resolve: () => void; reject: (error: Error) => void }>;
}

export interface QueueOptions {
	/** Whether background reads may start now; polled every `pollMs` while closed. */
	gate?: () => boolean;
	pollMs?: number;
}

export class BackgroundQueue {
	private readonly pending: Entry[] = [];
	private running: Entry | null = null;
	private gate: () => boolean;
	private readonly pollMs: number;
	private gateTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly log: (message: string) => void = (m) => console.warn(`[media] ${m}`),
		options: QueueOptions = {}
	) {
		this.gate = options.gate ?? (() => true);
		this.pollMs = options.pollMs ?? 250;
	}

	/** Replaces the gate (the session manager is created after the queue). */
	setGate(gate: () => boolean): void {
		this.gate = gate;
	}

	has(key: string): boolean {
		return this.running?.key === key || this.pending.some((job) => job.key === key);
	}

	get active(): string | null {
		return this.running?.key ?? null;
	}

	get size(): number {
		return this.pending.length;
	}

	/** Adds a job unless one with the same key is queued or running. Returns whether it was added. */
	enqueue(job: QueueJob): boolean {
		return this.add(job, null);
	}

	/** Like enqueue, and resolves once that job (or the one already under this key) has finished. */
	schedule(job: QueueJob): Promise<void> {
		return new Promise((resolve, reject) => {
			this.add(job, { resolve, reject });
		});
	}

	/** Drops the queued jobs of a file and aborts its running one. */
	cancelFile(fileId: string): void {
		for (let i = this.pending.length - 1; i >= 0; i--) {
			const entry = this.pending[i];
			if (entry.fileId !== fileId) continue;
			this.pending.splice(i, 1);
			this.settle(entry, new JobCancelledError(entry.key));
		}
		const running = this.running;
		if (running?.fileId === fileId && !running.controller.signal.aborted) {
			running.controller.abort('cancelled');
		}
	}

	/** Resolves once the queue is idle (tests and the CLI). */
	async idle(): Promise<void> {
		while (this.running || this.pending.length) {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}

	private add(job: QueueJob, waiter: Entry['waiters'][number] | null): boolean {
		const existing =
			this.running?.key === job.key ? this.running : this.pending.find((j) => j.key === job.key);
		if (existing) {
			if (waiter) existing.waiters.push(waiter);
			if (job.priority > existing.priority) {
				existing.priority = job.priority;
				// A waited-for job is no longer a background chore.
				if (!job.preemptible) existing.preemptible = false;
				this.sort();
			}
			return false;
		}
		const entry: Entry = {
			...job,
			controller: new AbortController(),
			waiters: waiter ? [waiter] : []
		};
		this.pending.push(entry);
		this.sort();
		const running = this.running;
		if (running?.preemptible && entry.priority > running.priority) {
			running.controller.abort('preempted');
		}
		void this.pump();
		return true;
	}

	private sort(): void {
		this.pending.sort((a, b) => b.priority - a.priority);
	}

	private settle(entry: Entry, error: Error | null): void {
		for (const waiter of entry.waiters) {
			if (error) waiter.reject(error);
			else waiter.resolve();
		}
		entry.waiters = [];
	}

	private async pump(): Promise<void> {
		if (this.running || this.gateTimer || this.pending.length === 0) return;
		if (!this.gate()) {
			this.gateTimer = setTimeout(() => {
				this.gateTimer = null;
				void this.pump();
			}, this.pollMs);
			this.gateTimer.unref?.();
			return;
		}
		const entry = this.pending.shift()!;
		this.running = entry;
		let error: Error | null = null;
		try {
			await entry.run(entry.controller.signal);
		} catch (cause) {
			error = cause instanceof Error ? cause : new Error(String(cause));
		}
		this.running = null;
		const reason = entry.controller.signal.aborted ? entry.controller.signal.reason : null;
		if (reason === 'preempted') {
			// Runs again from the start once the more urgent job is done.
			entry.controller = new AbortController();
			this.pending.push(entry);
			this.sort();
		} else if (reason === 'cancelled') {
			this.settle(entry, new JobCancelledError(entry.key));
		} else {
			if (error) this.log(`background job ${entry.key} failed: ${String(error)}`);
			this.settle(entry, error);
		}
		void this.pump();
	}
}
