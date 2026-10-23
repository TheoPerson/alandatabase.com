// Scrub maths for the timeline (absolute) and the picture pan (relative). Pure.
import type { Chapter } from '$lib/media/types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Seconds covered by one picture width during a relative pan: min(25% of duration, 600 s). */
export function scrubWindow(duration: number): number {
	return Math.min(Math.max(0, duration) * 0.25, 600);
}

export function relativeScrubTarget(
	origin: number,
	dx: number,
	frameWidth: number,
	duration: number,
	rate: 1 | 0.5 | 0.25
): number {
	if (!(duration > 0)) return 0;
	if (!(frameWidth > 0)) return clamp(origin, 0, duration);
	return clamp(origin + (dx / frameWidth) * scrubWindow(duration) * rate, 0, duration);
}

/** Vertical drift during a picture pan: abs(dy) >= 48 px half speed, >= 120 px quarter speed. */
export function panFineRate(dy: number): 1 | 0.5 | 0.25 {
	const d = Math.abs(dy);
	if (d >= 120) return 0.25;
	if (d >= 48) return 0.5;
	return 1;
}

/** Finger height above the track: >= 40 px half speed, >= 100 px quarter speed. */
export function trackFineRate(heightAboveTrack: number): 1 | 0.5 | 0.25 {
	if (heightAboveTrack >= 100) return 0.25;
	if (heightAboveTrack >= 40) return 0.5;
	return 1;
}

export function absoluteScrubTarget(
	x: number,
	track: { left: number; width: number },
	duration: number
): number {
	if (!(track.width > 0) || !(duration > 0)) return 0;
	return clamp((x - track.left) / track.width, 0, 1) * duration;
}

/** Snaps to the nearest chapter start within `thresholdPx` (default 6). */
export function magnet(
	target: number,
	chapters: Chapter[],
	pxPerSecond: number,
	thresholdPx = 6
): number {
	if (!(pxPerSecond > 0)) return target;
	let best = target;
	let bestPx = thresholdPx;
	for (const chapter of chapters) {
		const px = Math.abs(chapter.start - target) * pxPerSecond;
		if (px <= bestPx) {
			best = chapter.start;
			bestPx = px;
		}
	}
	return best;
}

/** Releasing within `thresholdPx` (default 8) of the origin tick cancels the seek. */
export function isCancel(
	target: number,
	origin: number,
	pxPerSecond: number,
	thresholdPx = 8
): boolean {
	return Math.abs(target - origin) * pxPerSecond <= thresholdPx;
}
