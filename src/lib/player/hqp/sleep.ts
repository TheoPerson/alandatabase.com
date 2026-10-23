// Sleep timer (spec 7.2, 13.3): timed modes fade the volume over the last 10 s (1 Hz steps, the
// battery rule) and then pause; 'end-of-item' is handled by the engine at `ended`.
import type { SleepMode } from './types';

export const SLEEP_FADE_MS = 10_000;

export function sleepEndsAt(mode: SleepMode, now: number): number | null {
	return typeof mode === 'number' ? now + mode * 60_000 : null;
}

/** 1 until the last 10 s, then linear down to 0 at the end. */
export function sleepVolumeFactor(now: number, endsAt: number): number {
	const left = endsAt - now;
	if (left >= SLEEP_FADE_MS) return 1;
	return Math.max(0, Math.round((left / SLEEP_FADE_MS) * 100) / 100);
}

export function createSleepTimer(deps: {
	now: () => number;
	fade: (factor: number) => void;
	expire: () => void;
}) {
	let wait: ReturnType<typeof setTimeout> | null = null;
	let step: ReturnType<typeof setInterval> | null = null;

	function clear() {
		if (wait) clearTimeout(wait);
		if (step) clearInterval(step);
		wait = step = null;
	}

	function start(endsAt: number) {
		clear();
		const tick = () => {
			const now = deps.now();
			if (now >= endsAt) {
				clear();
				deps.expire();
			} else deps.fade(sleepVolumeFactor(now, endsAt));
		};
		wait = setTimeout(
			() => {
				wait = null;
				tick();
				step = setInterval(tick, 1000);
			},
			Math.max(0, endsAt - SLEEP_FADE_MS - deps.now())
		);
	}

	return { start, clear };
}
