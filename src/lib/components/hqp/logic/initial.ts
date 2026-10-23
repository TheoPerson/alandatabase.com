// The state the player shows before its engine exists (SSR and the first client frame): the
// opening state of section 8 (black, the still, the title). Pure.
import type { HqpClock, HqpLaunchPayload, HqpState } from '$lib/player/hqp/types';

export const EMPTY_CLOCK: HqpClock = Object.freeze({
	position: 0,
	duration: 0,
	bufferedEnd: 0,
	ranges: []
}) as HqpClock;

export function openingSnapshot(launch: HqpLaunchPayload): HqpState {
	const index = Math.min(Math.max(0, launch.index), Math.max(0, launch.queue.length - 1));
	const item = launch.queue[index] ?? null;
	return {
		status: 'starting',
		autoplayBlocked: false,
		queue: launch.queue,
		index,
		item,
		session: null,
		delivery: null,
		caps: null,
		quality: { choice: 'auto', active: null, available: [] },
		audio: { options: [], mode: null },
		subtitles: { options: [], selected: null, forced: null, offsetSeconds: 0 },
		chapters: [],
		chapterIndex: -1,
		skipIntro: null,
		trickplay: null,
		rate: 1,
		held: false,
		volume: 1,
		muted: false,
		frameMode: 'fit',
		aspect: null,
		hdrShown: false,
		resume: null,
		upNext: null,
		stillWatching: false,
		sleep: { mode: 'off', endsAt: null },
		pip: false,
		airplay: { available: false, active: false },
		fullscreen: false,
		online: true,
		toasts: [],
		error: null,
		announcement: null
	};
}

/** Duration known before the engine reports one: the file's probed duration. */
export function initialClock(launch: HqpLaunchPayload): HqpClock {
	const item = launch.queue[launch.index];
	const duration = item?.file.durationSeconds ?? 0;
	return { ...EMPTY_CLOCK, duration: duration > 0 ? duration : 0, ranges: [] };
}
