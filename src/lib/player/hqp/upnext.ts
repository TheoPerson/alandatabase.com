// Up next and Skip intro detection from chapter titles (spec 7.4 and 7.8).
import type { Chapter } from '$lib/media/types';

const CREDITS = /cr[ée]dits|g[ée]n[ée]rique de fin|end credits|closing credits/i;
const OPENING =
	/^(opening|intro|générique|generique|g[ée]n[ée]rique d'ouverture|previously|pr[ée]c[ée]demment|recap|r[ée]sum[ée])/i;

/**
 * When Up next appears: the session's credits start when known, else the last credits chapter
 * starting at 85% of the duration or later, else duration - max(45 s, 2%). Infinity without a
 * duration (Up next then waits for `ended`).
 */
export function creditsStart(
	chapters: Chapter[],
	duration: number,
	sessionCredits: number | null
): number {
	if (!(duration > 0)) return Number.POSITIVE_INFINITY;
	if (sessionCredits !== null && sessionCredits > 0 && sessionCredits < duration)
		return sessionCredits;
	const credits = chapters.findLast((c) => !!c.title && CREDITS.test(c.title));
	if (credits && credits.start >= duration * 0.85) return credits.start;
	return Math.max(0, duration - Math.max(45, duration * 0.02));
}

/** An opening chapter worth skipping: starts before 25% of the file and lasts at most 4 min. */
export function openingChapter(chapters: Chapter[], duration: number): Chapter | null {
	return (
		chapters.find(
			(c) =>
				!!c.title &&
				OPENING.test(c.title.trim()) &&
				c.start < duration * 0.25 &&
				c.end - c.start <= 240 &&
				c.end > c.start
		) ?? null
	);
}
