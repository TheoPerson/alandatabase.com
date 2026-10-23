import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSleepTimer, SLEEP_FADE_MS, sleepEndsAt, sleepVolumeFactor } from './sleep';

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe('sleep timer', () => {
	it('computes the end of timed modes only', () => {
		expect(sleepEndsAt(15, 0)).toBe(900_000);
		expect(sleepEndsAt(60, 1000)).toBe(3_601_000);
		expect(sleepEndsAt('off', 0)).toBeNull();
		expect(sleepEndsAt('end-of-item', 0)).toBeNull();
	});

	it('fades the volume linearly over the last 10 s', () => {
		const end = 100_000;
		expect(sleepVolumeFactor(end - 20_000, end)).toBe(1);
		expect(sleepVolumeFactor(end - SLEEP_FADE_MS, end)).toBe(1);
		expect(sleepVolumeFactor(end - 5_000, end)).toBe(0.5);
		expect(sleepVolumeFactor(end, end)).toBe(0);
	});

	it('fades once per second during the last 10 s, then expires', () => {
		const fade = vi.fn();
		const expire = vi.fn();
		const timer = createSleepTimer({ now: () => Date.now(), fade, expire });
		timer.start(Date.now() + 60_000);
		vi.advanceTimersByTime(49_999);
		expect(fade).not.toHaveBeenCalled();
		vi.advanceTimersByTime(5_001);
		expect(fade.mock.calls.map(([f]) => f)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5]);
		vi.advanceTimersByTime(5_000);
		expect(expire).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(60_000);
		expect(expire).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('clear cancels everything; start replaces a running timer', () => {
		const fade = vi.fn();
		const expire = vi.fn();
		const timer = createSleepTimer({ now: () => Date.now(), fade, expire });
		timer.start(Date.now() + 15_000);
		timer.start(Date.now() + 30_000);
		vi.advanceTimersByTime(20_000);
		expect(fade).toHaveBeenCalled();
		timer.clear();
		vi.advanceTimersByTime(60_000);
		expect(expire).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});
