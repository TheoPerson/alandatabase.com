// Screen Wake Lock (spec 7.12): held while playing, released 5 minutes after a pause, at the end,
// and when the page is hidden (the system drops it then anyway); taken again when visible.

export const WAKE_LOCK_RELEASE_MS = 5 * 60_000;

export function createWakeLock(nav: { wakeLock?: WakeLock } | null | undefined) {
	const api = nav?.wakeLock ?? null;
	let sentinel: WakeLockSentinel | null = null;
	let wanted = false;
	let requesting = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const cancelTimer = () => {
		if (timer) clearTimeout(timer);
		timer = null;
	};

	function acquire() {
		wanted = true;
		cancelTimer();
		if (!api || requesting || (sentinel && !sentinel.released)) return;
		requesting = true;
		api
			.request('screen')
			.then((lock) => {
				if (!wanted) return void lock.release().catch(() => undefined);
				sentinel = lock;
				lock.addEventListener('release', () => {
					if (sentinel === lock) sentinel = null;
				});
			})
			.catch(() => undefined)
			.finally(() => (requesting = false));
	}

	function release() {
		wanted = false;
		cancelTimer();
		const lock = sentinel;
		sentinel = null;
		lock?.release().catch(() => undefined);
	}

	return {
		playing: acquire,
		paused() {
			cancelTimer();
			if (wanted || sentinel) timer = setTimeout(release, WAKE_LOCK_RELEASE_MS);
		},
		ended: release,
		hidden: release,
		visible(playing: boolean) {
			if (playing) acquire();
		},
		release
	};
}

export type WakeLockController = ReturnType<typeof createWakeLock>;
