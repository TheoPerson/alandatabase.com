// Progress sync (spec 13.3): pure scheduling rules plus a small sender that remembers the last
// save per file and retries one failed PUT when the device is back online.
import type { ProgressEntry } from '$lib/media/types';

export const PROGRESS_INTERVAL_MS = 10_000;
const MIN_GAP_MS = 5_000;

export type ProgressReason = 'tick' | 'pause' | 'seek' | 'ended' | 'hide' | 'close' | 'item';

/**
 * At most one PUT per 5 s per file, except the final close, item-change and hide flushes: nothing
 * can follow them (the page may be frozen or gone) and the server coalesces writes to one per 5 s
 * with a trailing write. Under 2 s of movement is skipped except on pause, ended and close.
 */
export function shouldSaveProgress(input: {
	now: number;
	lastSavedAt: number;
	lastSavedPosition: number;
	position: number;
	reason: ProgressReason;
}): boolean {
	const { reason } = input;
	const final = reason === 'close' || reason === 'item' || reason === 'hide';
	if (!final && input.now - input.lastSavedAt < MIN_GAP_MS) return false;
	const always = reason === 'pause' || reason === 'ended' || reason === 'close';
	if (!always && Math.abs(input.position - input.lastSavedPosition) < 2) return false;
	return reason !== 'tick' || input.now - input.lastSavedAt >= PROGRESS_INTERVAL_MS;
}

/** Resume when not completed, at least 30 s in and at least 180 s left. Null = start at 0. */
export function resumePoint(
	progress: ProgressEntry | null,
	durationSeconds: number | null,
	prefsResume: boolean
): number | null {
	if (!prefsResume || !progress || progress.completed) return null;
	const position = progress.positionSeconds;
	const duration = durationSeconds ?? progress.durationSeconds;
	if (!(position >= 30)) return null;
	if (duration && duration - position < 180) return null;
	return position;
}

/** Same rule as the server: at least 92% watched, or within the last 3 minutes. */
export function isCompletedPosition(position: number, duration: number | null): boolean {
	if (!duration || !(position > 0)) return false;
	return position >= duration * 0.92 || duration - position <= 180;
}

export interface ProgressPayload {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
}

const DEFERRABLE = new Set<ProgressReason>(['pause', 'seek', 'ended']);

export function createProgressTracker(deps: {
	send: (entry: ProgressPayload, keepalive: boolean) => Promise<boolean>;
	now: () => number;
}) {
	const last = new Map<string, { at: number; position: number }>();
	let pending: ProgressPayload | null = null;
	let trailing: ReturnType<typeof setTimeout> | null = null;
	const cancel = () => {
		if (trailing) clearTimeout(trailing);
		trailing = null;
	};
	return {
		/** Drops a scheduled trailing save (item change, destroy). */
		cancel,
		/** A new start: the first tick waits a full interval, moves are measured from here. */
		reset(fileId: string, position: number) {
			last.set(fileId, { at: deps.now(), position });
		},
		async save(
			reason: ProgressReason,
			fileId: string,
			position: number,
			duration: number | null,
			keepalive = false
		): Promise<boolean> {
			if (!Number.isFinite(position) || position < 0) return false;
			const prev = last.get(fileId) ?? { at: 0, position: -1 };
			const now = deps.now();
			const input = {
				now,
				lastSavedAt: prev.at,
				lastSavedPosition: prev.position,
				position,
				reason
			};
			if (!shouldSaveProgress(input)) {
				// A pause, seek or end inside the 5 s window is written when the window closes.
				const wait = prev.at + MIN_GAP_MS - now;
				if (
					DEFERRABLE.has(reason) &&
					wait > 0 &&
					shouldSaveProgress({ ...input, now: now + wait })
				) {
					cancel();
					trailing = setTimeout(() => {
						trailing = null;
						void this.save(reason, fileId, position, duration);
					}, wait);
				}
				return false;
			}
			cancel();
			const entry: ProgressPayload = {
				fileId,
				positionSeconds: Math.round(position * 10) / 10,
				durationSeconds:
					duration && Number.isFinite(duration) ? Math.round(duration * 10) / 10 : null
			};
			last.set(fileId, { at: now, position: prev.position });
			const ok = await deps.send(entry, keepalive);
			if (ok) {
				last.set(fileId, { at: now, position });
				if (pending?.fileId === fileId) pending = null;
			} else pending = entry;
			return ok;
		},
		/** One retry of the last failed save (called when the browser is back online). */
		async retryPending(): Promise<void> {
			const entry = pending;
			pending = null;
			if (entry && (await deps.send(entry, false))) {
				last.set(entry.fileId, { at: deps.now(), position: entry.positionSeconds });
			}
		}
	};
}
