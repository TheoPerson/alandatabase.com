// Timeline helpers: fractions, chapter lookup, the chapter-cut mask and the speed ladder. Pure.
import type { Chapter } from '$lib/media/types';
import type { HqpClock } from '$lib/player/hqp/types';
import { SPEEDS } from '$lib/player/prefs';
import { meaningfulChapterTitle } from './format';

export function fraction(value: number, duration: number): number {
	if (!(duration > 0) || !Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value / duration));
}

/** Index of the chapter containing `seconds` (binary search); -1 without one. */
export function chapterIndexAt(chapters: Chapter[], seconds: number): number {
	let lo = 0;
	let hi = chapters.length - 1;
	let found = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (chapters[mid].start <= seconds) {
			found = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return found;
}

function pct(value: number): string {
	return `${Math.round(value * 1e6) / 1e4}%`;
}

/** Cuts closer than this to each other (or to either end) of the track are dropped. */
export const MIN_CUT_PX = 24;

/**
 * One mask-image for the 5 px track: opaque everywhere except a `gapPx` transparent cut at every
 * inner chapter start. Only alpha matters in a mask, so named keywords are enough. Files whose
 * chapters are all generated ("(05)00:08:49:278", "Chapter 1") get no cuts; with the track width
 * known, cuts closer than 24 px are dropped so dense chapter lists never read as Morse code.
 */
export function chapterMask(
	chapters: Chapter[],
	duration: number,
	trackPx = 0,
	gapPx = 3
): string | null {
	if (!(duration > 0)) return null;
	if (!chapters.some((chapter) => meaningfulChapterTitle(chapter.title))) return null;
	const half = gapPx / 2;
	const sorted = chapters
		.map((chapter) => chapter.start / duration)
		.filter((f) => f > 0.002 && f < 0.998)
		.sort((a, b) => a - b);
	const min = trackPx > 0 ? MIN_CUT_PX / trackPx : 0;
	const cuts: number[] = [];
	for (const cut of sorted) {
		if (cut - (cuts.at(-1) ?? 0) < min || 1 - cut < min) continue;
		cuts.push(cut);
	}
	if (cuts.length === 0) return null;
	const stops: string[] = [];
	for (const cut of cuts) {
		const at = pct(cut);
		stops.push(
			`black calc(${at} - ${half}px)`,
			`transparent calc(${at} - ${half}px)`,
			`transparent calc(${at} + ${half}px)`,
			`black calc(${at} + ${half}px)`
		);
	}
	return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Next speed on the ladder (0.5 .. 2) in `direction`, from the nearest current step. */
export function speedStep(rate: number, direction: 1 | -1): number {
	const ladder = [...SPEEDS] as number[];
	if (direction > 0) return ladder.find((s) => s > rate + 1e-6) ?? ladder[ladder.length - 1];
	return [...ladder].reverse().find((s) => s < rate - 1e-6) ?? ladder[0];
}

export function bufferAhead(clock: HqpClock): number {
	return Math.max(0, clock.bufferedEnd - clock.position);
}
