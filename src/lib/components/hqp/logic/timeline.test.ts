import { describe, expect, it } from 'vitest';
import type { Chapter } from '$lib/media/types';
import { bufferAhead, chapterIndexAt, chapterMask, fraction, speedStep } from './timeline';

const chapters: Chapter[] = [
	{ start: 0, end: 600, title: 'Opening' },
	{ start: 600, end: 1800, title: 'Middle' },
	{ start: 1800, end: 3600, title: 'Credits' }
];

describe('fraction', () => {
	it('clamps to 0..1 and survives a zero or missing duration', () => {
		expect(fraction(30, 60)).toBe(0.5);
		expect(fraction(-5, 60)).toBe(0);
		expect(fraction(90, 60)).toBe(1);
		expect(fraction(10, 0)).toBe(0);
		expect(fraction(Number.NaN, 60)).toBe(0);
	});
});

describe('chapterIndexAt', () => {
	it('finds the chapter by binary search and returns -1 without chapters', () => {
		expect(chapterIndexAt(chapters, 0)).toBe(0);
		expect(chapterIndexAt(chapters, 599.9)).toBe(0);
		expect(chapterIndexAt(chapters, 600)).toBe(1);
		expect(chapterIndexAt(chapters, 3599)).toBe(2);
		expect(chapterIndexAt(chapters, 9999)).toBe(2);
		expect(chapterIndexAt([], 10)).toBe(-1);
	});

	it('returns -1 before the first chapter start', () => {
		expect(chapterIndexAt([{ start: 30, end: 60, title: null }], 10)).toBe(-1);
	});
});

describe('chapterMask', () => {
	it('cuts a 3 px gap at every chapter start except 0 and the end', () => {
		const mask = chapterMask(chapters, 3600);
		expect(mask).toContain('linear-gradient(90deg');
		expect(mask).toContain('calc(16.6667% - 1.5px)');
		expect(mask).toContain('calc(50% + 1.5px)');
		expect(mask).not.toContain('calc(0%');
		expect(mask?.match(/transparent/g)).toHaveLength(4);
	});

	it('returns null without inner cuts or duration', () => {
		expect(chapterMask([], 100)).toBeNull();
		expect(chapterMask([{ start: 0, end: 100, title: null }], 100)).toBeNull();
		expect(chapterMask(chapters, 0)).toBeNull();
	});

	it('never uses a raw colour', () => {
		expect(chapterMask(chapters, 3600)).not.toMatch(/#[0-9a-f]{3,8}/i);
	});

	it('draws no cuts when no chapter has a meaningful name (timecodes, "Chapter 1")', () => {
		const generated: Chapter[] = Array.from({ length: 33 }, (_, i) => ({
			start: i * 200,
			end: (i + 1) * 200,
			title: `(${String(i + 1).padStart(2, '0')})00:0${i % 10}:00:000`
		}));
		expect(chapterMask(generated, 6600, 900)).toBeNull();
		const numbered: Chapter[] = [
			{ start: 0, end: 600, title: 'Chapter 1' },
			{ start: 600, end: 1200, title: 'Chapter 2' }
		];
		expect(chapterMask(numbered, 1200, 900)).toBeNull();
		expect(
			chapterMask(
				[
					{ start: 0, end: 60, title: null },
					{ start: 60, end: 120, title: null }
				],
				120
			)
		).toBeNull();
	});

	it('drops cuts closer than 24 px of track width', () => {
		const named: Chapter[] = [
			{ start: 0, end: 100, title: 'Intro' },
			{ start: 100, end: 110, title: 'Too close' },
			{ start: 110, end: 2000, title: 'Story' },
			{ start: 2000, end: 3590, title: 'Finale' },
			{ start: 3590, end: 3600, title: 'Sting' }
		];
		// 400 px track: 1 s = 0.111 px; cuts at 100 s (11 px from 0, dropped), 110 s (12 px, dropped),
		// 2000 s (kept), 3590 s (1 px from the end, dropped).
		const mask = chapterMask(named, 3600, 400);
		expect(mask?.match(/transparent/g)).toHaveLength(2);
		expect(mask).toContain('calc(55.5556% - 1.5px)');
		// Without a known width every inner cut stays.
		expect(chapterMask(named, 3600)?.match(/transparent/g)).toHaveLength(8);
	});
});

describe('speedStep', () => {
	it('moves along the speed ladder and stops at the ends', () => {
		expect(speedStep(1, 1)).toBe(1.25);
		expect(speedStep(1, -1)).toBe(0.75);
		expect(speedStep(2, 1)).toBe(2);
		expect(speedStep(0.5, -1)).toBe(0.5);
		expect(speedStep(1.1, 1)).toBe(1.25);
	});
});

describe('bufferAhead', () => {
	it('is the buffered end minus the position, never negative', () => {
		expect(bufferAhead({ position: 10, duration: 100, bufferedEnd: 58, ranges: [] })).toBe(48);
		expect(bufferAhead({ position: 10, duration: 100, bufferedEnd: 5, ranges: [] })).toBe(0);
	});
});
