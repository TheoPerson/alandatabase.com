import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { FakeWakeLock } from './testing/fake-media';
import { createWakeLock, WAKE_LOCK_RELEASE_MS } from './wake-lock';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('wake lock', () => {
	it('acquires on playing, once', async () => {
		const api = new FakeWakeLock();
		const lock = createWakeLock({ wakeLock: api as unknown as WakeLock });
		lock.playing();
		lock.playing();
		await flush();
		expect(api.requests).toBe(1);
		expect(api.active).toBe(1);
	});

	it('releases 5 minutes after a pause, unless playback resumes', async () => {
		const api = new FakeWakeLock();
		const lock = createWakeLock({ wakeLock: api as unknown as WakeLock });
		lock.playing();
		await flush();
		lock.paused();
		await vi.advanceTimersByTimeAsync(WAKE_LOCK_RELEASE_MS - 1);
		expect(api.active).toBe(1);
		lock.playing();
		await vi.advanceTimersByTimeAsync(WAKE_LOCK_RELEASE_MS);
		expect(api.active).toBe(1);
		lock.paused();
		await vi.advanceTimersByTimeAsync(WAKE_LOCK_RELEASE_MS);
		expect(api.active).toBe(0);
		expect(WAKE_LOCK_RELEASE_MS).toBe(300_000);
	});

	it('releases on ended and when hidden; re-acquires when visible and playing', async () => {
		const api = new FakeWakeLock();
		const lock = createWakeLock({ wakeLock: api as unknown as WakeLock });
		lock.playing();
		await flush();
		lock.ended();
		await flush();
		expect(api.active).toBe(0);
		lock.playing();
		await flush();
		lock.hidden();
		await flush();
		expect(api.active).toBe(0);
		lock.visible(false);
		await flush();
		expect(api.active).toBe(0);
		lock.visible(true);
		await flush();
		expect(api.active).toBe(1);
	});

	it('forgets a lock the system released, and survives refusals and missing API', async () => {
		const api = new FakeWakeLock();
		const lock = createWakeLock({ wakeLock: api as unknown as WakeLock });
		lock.playing();
		await flush();
		await api.sentinels[0].release();
		lock.playing();
		await flush();
		expect(api.requests).toBe(2);
		api.fail = true;
		lock.release();
		lock.playing();
		await flush();
		expect(api.active).toBe(0);
		const none = createWakeLock(null);
		expect(() => {
			none.playing();
			none.release();
		}).not.toThrow();
	});

	it('drops a lock granted after release was asked', async () => {
		const api = new FakeWakeLock();
		const lock = createWakeLock({ wakeLock: api as unknown as WakeLock });
		lock.playing();
		lock.release();
		await flush();
		expect(api.active).toBe(0);
	});
});
