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
	let applied: PlayerPrefs | null = null;

	function seekTo(seconds: number) {
		const { duration } = source.getState();
		source.seek(clamp(seconds, 0, duration > 0 ? duration : Number.POSITIVE_INFINITY));
	}

	return {
		get state() {
			return source.getState();
		},
		/** Pushes preferences to the source; after the first call only changed fields are sent. */
		applyPrefs(next: PlayerPrefs = current) {
			const previous = applied;
			current = next;
			applied = next;
			if (!previous || previous.speed !== next.speed) source.setRate(next.speed);
			if (!previous || previous.volume !== next.volume) source.setVolume(next.volume);
			if (!previous || previous.muted !== next.muted) source.setMuted(next.muted);
			if (!previous || previous.captions !== next.captions) source.setCaptions(next.captions);
			if (!previous || previous.captionSize !== next.captionSize) {
				source.setCaptionSize(next.captionSize);
			}
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
