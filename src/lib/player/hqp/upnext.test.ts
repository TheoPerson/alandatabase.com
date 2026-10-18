import { describe, expect, it } from 'vitest';
import { creditsStart, openingChapter } from './upnext';
import type { Chapter } from '$lib/media/types';

const ch = (start: number, end: number, title: string | null): Chapter => ({ start, end, title });

describe('creditsStart', () => {
	it('uses the last credits chapter that starts at 85% or later', () => {
		const chapters = [
			ch(0, 60, 'Opening'),
			ch(60, 3000, 'Chapter 2'),
			ch(3100, 3400, 'Générique de fin'),
			ch(3400, 3600, 'End Credits')
		];
		expect(creditsStart(chapters, 3600, null)).toBe(3400);
		expect(creditsStart([ch(3100, 3600, 'Crédits')], 3600, null)).toBe(3100);
		expect(creditsStart([ch(3060, 3600, 'Closing credits')], 3600, null)).toBe(3060);
		expect(creditsStart([ch(3500, 3600, 'generique de fin')], 3600, null)).toBe(3500);
	});

	it('falls back to duration - max(45 s, 2%) when no credits chapter qualifies', () => {
		expect(creditsStart([ch(2000, 3600, 'Credits')], 3600, null)).toBe(3600 - 72);
		expect(creditsStart([], 1320, null)).toBe(1320 - 45);
		expect(creditsStart([ch(0, 1320, 'Chapitre 1')], 1320, null)).toBe(1275);
	});

	it('prefers the session credits start, and never triggers without a duration', () => {
		expect(creditsStart([ch(3400, 3600, 'Credits')], 3600, 3300)).toBe(3300);
		expect(creditsStart([], 0, null)).toBe(Number.POSITIVE_INFINITY);
		expect(creditsStart([], Number.NaN, null)).toBe(Number.POSITIVE_INFINITY);
	});
});

describe('openingChapter', () => {
	it('finds an opening chapter early in the file and at most 4 minutes long', () => {
		const opening = ch(90, 180, 'Générique');
		expect(openingChapter([ch(0, 90, 'Cold open'), opening, ch(180, 3600, 'Act 1')], 3600)).toBe(
			opening
		);
		for (const title of [
			'Opening',
			'Intro',
			'generique',
			"Générique d'ouverture",
			'Previously',
			'Précédemment',
			'Recap',
			'Résumé'
		]) {
			expect(openingChapter([ch(0, 60, title)], 3600)?.title).toBe(title);
		}
	});

	it('rejects late, long, or unrelated chapters', () => {
		expect(openingChapter([ch(1000, 1100, 'Intro')], 3600)).toBeNull();
		expect(openingChapter([ch(0, 241, 'Opening')], 3600)).toBeNull();
		expect(openingChapter([ch(0, 60, 'Chapter 1'), ch(60, 120, null)], 3600)).toBeNull();
		expect(openingChapter([ch(3300, 3400, 'Générique de fin')], 3600)).toBeNull();
	});
});
