// Playback position writes, at most one database write per user and file every 5 seconds. A write
// arriving inside the window is not lost: the newest position is kept and written when the window
// ends (trailing write), so the position saved on pause or close is always the last one sent.

import type { ProgressEntry } from '$lib/media/types';

export interface ProgressInput {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
}

type Save = (userId: string, entry: ProgressInput) => Promise<ProgressEntry | null>;

interface Slot {
	lastWrite: number;
	pending: ProgressInput | null;
	timer: ReturnType<typeof setTimeout> | null;
}

export type SubmitOutcome = 'written' | 'deferred' | 'unknown-file';

export class ProgressWriter {
	private readonly slots = new Map<string, Slot>();

	constructor(
		private readonly save: Save,
		private readonly options: {
			intervalMs?: number;
			now?: () => number;
			log?: (message: string) => void;
		} = {}
	) {}

	private get interval(): number {
		return this.options.intervalMs ?? 5000;
	}

	private now(): number {
		return (this.options.now ?? Date.now)();
	}

	async submit(userId: string, entry: ProgressInput): Promise<SubmitOutcome> {
		const key = `${userId}:${entry.fileId}`;
		const slot = this.slots.get(key);
		const now = this.now();
		if (slot && now - slot.lastWrite < this.interval) {
			slot.pending = entry;
			if (!slot.timer) {
				slot.timer = setTimeout(
					() => void this.flush(userId, key),
					slot.lastWrite + this.interval - now
				);
				slot.timer.unref?.();
			}
			return 'deferred';
		}
		const fresh: Slot = slot ?? { lastWrite: now, pending: null, timer: null };
		fresh.lastWrite = now;
		this.slots.set(key, fresh);
		const saved = await this.save(userId, entry);
		if (!saved) {
			this.slots.delete(key);
			return 'unknown-file';
		}
		this.prune();
		return 'written';
	}

	/** Writes every deferred position now (server shutdown, tests). */
	async flushAll(): Promise<void> {
		await Promise.all(
			[...this.slots.entries()].map(([key]) => this.flush(key.slice(0, key.indexOf(':')), key))
		);
	}

	private async flush(userId: string, key: string): Promise<void> {
		const slot = this.slots.get(key);
		if (!slot) return;
		if (slot.timer) clearTimeout(slot.timer);
		slot.timer = null;
		const entry = slot.pending;
		slot.pending = null;
		if (!entry) return;
		slot.lastWrite = this.now();
		try {
			await this.save(userId, entry);
		} catch (error) {
			this.options.log?.(`progress write failed: ${String(error)}`);
		}
	}

	private prune(): void {
		if (this.slots.size < 1000) return;
		const cutoff = this.now() - 10 * this.interval;
		for (const [key, slot] of this.slots) {
			if (!slot.pending && !slot.timer && slot.lastWrite < cutoff) this.slots.delete(key);
		}
	}
}
