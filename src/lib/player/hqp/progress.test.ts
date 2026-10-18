import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createProgressTracker,
	isCompletedPosition,
	PROGRESS_INTERVAL_MS,
	resumePoint,
	shouldSaveProgress
} from './progress';
import type { ProgressEntry } from '$lib/media/types';

const T = 1_000_000;

describe('shouldSaveProgress', () => {
	const base = { now: T, lastSavedAt: T - 20_000, lastSavedPosition: 100, position: 120 };

	it('saves on a 10 s cadence while playing', () => {
		expect(PROGRESS_INTERVAL_MS).toBe(10_000);
		expect(shouldSaveProgress({ ...base, reason: 'tick' })).toBe(true);
		expect(shouldSaveProgress({ ...base, lastSavedAt: T - 9_000, reason: 'tick' })).toBe(false);
	});

	it('skips a save when the position moved under 2 s, except pause, ended and close', () => {
		const still = { ...base, position: 101.5 };
		expect(shouldSaveProgress({ ...still, reason: 'tick' })).toBe(false);
		expect(shouldSaveProgress({ ...still, reason: 'seek' })).toBe(false);
		expect(shouldSaveProgress({ ...still, reason: 'hide' })).toBe(false);
		expect(shouldSaveProgress({ ...still, reason: 'item' })).toBe(false);
		expect(shouldSaveProgress({ ...still, reason: 'pause' })).toBe(true);
		expect(shouldSaveProgress({ ...still, reason: 'ended' })).toBe(true);
		expect(shouldSaveProgress({ ...still, reason: 'close' })).toBe(true);
	});

	it('never sends more than one PUT per 5 s, except the final close, item and hide flushes', () => {
		const recent = { ...base, lastSavedAt: T - 4_000 };
		for (const reason of ['tick', 'pause', 'seek', 'ended'] as const) {
			expect(shouldSaveProgress({ ...recent, reason }), reason).toBe(false);
		}
		// Nothing may follow these (the page can be frozen or gone); the server coalesces anyway.
		expect(shouldSaveProgress({ ...recent, reason: 'close' })).toBe(true);
		expect(shouldSaveProgress({ ...recent, reason: 'item' })).toBe(true);
		expect(shouldSaveProgress({ ...recent, reason: 'hide' })).toBe(true);
		expect(shouldSaveProgress({ ...base, lastSavedAt: T - 5_000, reason: 'pause' })).toBe(true);
	});
});

describe('resumePoint', () => {
	const entry = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
		fileId: 'f',
		positionSeconds: 600,
		durationSeconds: 3600,
		completed: false,
		updatedAt: '2026-10-16T20:00:00Z',
		...over
	});

	it('resumes an unfinished position', () => {
		expect(resumePoint(entry(), 3600, true)).toBe(600);
		expect(resumePoint(entry({ durationSeconds: null }), null, true)).toBe(600);
		expect(resumePoint(entry(), null, true)).toBe(600);
	});

	it('starts over when completed, under 30 s, in the last 180 s, prefs off or no progress', () => {
		expect(resumePoint(entry({ completed: true }), 3600, true)).toBeNull();
		expect(resumePoint(entry({ positionSeconds: 29 }), 3600, true)).toBeNull();
		expect(resumePoint(entry({ positionSeconds: 30 }), 3600, true)).toBe(30);
		expect(resumePoint(entry({ positionSeconds: 3421 }), 3600, true)).toBeNull();
		expect(resumePoint(entry({ positionSeconds: 3420 }), 3600, true)).toBe(3420);
		expect(resumePoint(entry(), 3600, false)).toBeNull();
		expect(resumePoint(null, 3600, true)).toBeNull();
	});

	it('marks completion at 92% or within the last 3 minutes', () => {
		expect(isCompletedPosition(3312, 3600)).toBe(true);
		expect(isCompletedPosition(3000, 3600)).toBe(false);
		expect(isCompletedPosition(1150, 1320)).toBe(true);
		expect(isCompletedPosition(0, 100)).toBe(false);
		expect(isCompletedPosition(500, null)).toBe(false);
	});
});

describe('createProgressTracker', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(T);
	});
	afterEach(() => vi.useRealTimers());

	it('sends throttled saves, flushes the final one and retries a failure once online', async () => {
		const send = vi.fn(async () => true);
		const tracker = createProgressTracker({ send, now: () => Date.now() });
		tracker.reset('file-1', 100);
		// The first tick waits a full interval after the start.
		expect(await tracker.save('tick', 'file-1', 105, 3600)).toBe(false);
		vi.advanceTimersByTime(10_000);
		expect(await tracker.save('tick', 'file-1', 105, 3600)).toBe(true);
		expect(send).toHaveBeenLastCalledWith(
			{ fileId: 'file-1', positionSeconds: 105, durationSeconds: 3600 },
			false
		);
		expect(await tracker.save('tick', 'file-1', 109, 3600)).toBe(false);
		vi.advanceTimersByTime(10_000);
		expect(await tracker.save('tick', 'file-1', 119, 3600)).toBe(true);
		expect(await tracker.save('close', 'file-1', 120, 3600, true)).toBe(true);
		expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 120 }), true);

		send.mockResolvedValueOnce(false);
		vi.advanceTimersByTime(6_000);
		expect(await tracker.save('pause', 'file-1', 140, 3600)).toBe(false);
		await tracker.retryPending();
		expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 140 }), false);
		const calls = send.mock.calls.length;
		await tracker.retryPending();
		expect(send.mock.calls.length).toBe(calls);
	});

	it('writes a pause, seek or end blocked by the 5 s window when the window closes', async () => {
		const send = vi.fn(async () => true);
		const tracker = createProgressTracker({ send, now: () => Date.now() });
		tracker.reset('file-1', 0);
		vi.advanceTimersByTime(10_000);
		await tracker.save('tick', 'file-1', 100, 3600);
		vi.advanceTimersByTime(3_000);
		expect(await tracker.save('pause', 'file-1', 103, 3600)).toBe(false);
		expect(send).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1_999);
		expect(send).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(send).toHaveBeenCalledTimes(2);
		expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 103 }), false);
		// A newer blocked save replaces the scheduled one; cancel() drops it.
		vi.advanceTimersByTime(1_000);
		await tracker.save('seek', 'file-1', 400, 3600);
		await tracker.save('seek', 'file-1', 500, 3600);
		tracker.cancel();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(send).toHaveBeenCalledTimes(2);
		// A blocked tick is simply skipped (the next tick follows).
		await tracker.save('tick', 'file-1', 520, 3600);
		await tracker.save('tick', 'file-1', 523, 3600);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(send).toHaveBeenCalledTimes(3);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('ignores invalid positions', async () => {
		const send = vi.fn(async () => true);
		const tracker = createProgressTracker({ send, now: () => Date.now() });
		tracker.reset('file-1', 0);
		expect(await tracker.save('close', 'file-1', Number.NaN, 3600)).toBe(false);
		expect(await tracker.save('close', 'file-1', -1, 3600)).toBe(false);
		expect(send).not.toHaveBeenCalled();
	});
});
