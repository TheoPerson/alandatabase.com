// Pure glue between the UI and a PlayerSource: clamps every request, applies
// preferences, and owns the resume bookkeeping. Tested with a fake source.

import type { PlayerPrefs } from './prefs';
import { nearestSpeed, SPEEDS } from './prefs';
import { clearResume, resumeOffer, writeResume } from './resume';
import type { PlayerSource } from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function createController(
	source: PlayerSource,
	videoKey: string,
	prefs: PlayerPrefs,
	storage: Storage | null,
	now: () => number
) {
	let current = prefs;

	function seekTo(seconds: number) {
		const { duration } = source.getState();
		source.seek(clamp(seconds, 0, duration > 0 ? duration : Number.POSITIVE_INFINITY));
	}

	return {
		get state() {
			return source.getState();
		},
		applyPrefs(next: PlayerPrefs = current) {
			current = next;
			source.setRate(next.speed);
			source.setVolume(next.volume);
			source.setMuted(next.muted);
			source.setCaptions(next.captions);
		},
		toggle() {
			const { status } = source.getState();
			if (status === 'playing' || status === 'buffering') source.pause();
			else source.play();
		},
		skip(seconds: number) {
			seekTo(source.getState().position + seconds);
		},
		seek(seconds: number) {
			seekTo(seconds);
		},
		setRate(rate: number) {
			source.setRate(nearestSpeed(clamp(rate, 0.5, 2)));
		},
		/** Moves to the next (+1) or previous (-1) supported speed. */
		stepRate(direction: 1 | -1) {
			const index = SPEEDS.indexOf(nearestSpeed(source.getState().rate) as (typeof SPEEDS)[number]);
			const next = SPEEDS[clamp(index + direction, 0, SPEEDS.length - 1)];
			source.setRate(next);
		},
		setVolume(level: number) {
			source.setVolume(clamp(level, 0, 1));
		},
		toggleMute() {
			source.setMuted(!source.getState().muted);
		},
		toggleCaptions() {
			source.setCaptions(!source.getState().captions);
		},
		/** Saves the position when it is worth resuming, forgets it near the end. */
		persistPosition() {
			if (!current.resume) return;
			const { position, duration } = source.getState();
			if (resumeOffer(position, duration))
				writeResume(storage, videoKey, position, duration, now());
			else if (duration > 0) clearResume(storage, videoKey);
		},
		dispose() {
			source.destroy();
		}
	};
}

export type PlayerController = ReturnType<typeof createController>;
