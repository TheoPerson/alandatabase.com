import { describe, expect, it } from 'vitest';
import type { Chapter } from '$lib/media/types';
import {
	absoluteScrubTarget,
	isCancel,
	magnet,
	panFineRate,
	relativeScrubTarget,
	scrubWindow,
	trackFineRate
} from './scrub';

describe('relativeScrubTarget', () => {
	it('maps the picture width to 25% of the duration, at most 600 s', () => {
		// 40 min: window 600 s (25% = 600); half the width = 300 s.
		expect(relativeScrubTarget(1000, 391, 782, 2400, 1)).toBeCloseTo(1300, 5);
		// 72 min: 25% = 1080 s, capped at 600 s.
		expect(relativeScrubTarget(1000, 782, 782, 4320, 1)).toBeCloseTo(1600, 5);
		// 20 min: 25% = 300 s.
		expect(relativeScrubTarget(100, 782, 782, 1200, 1)).toBeCloseTo(400, 5);
	});

	it('slows down with the fine rate', () => {
		expect(relativeScrubTarget(1000, 391, 782, 2400, 0.5)).toBeCloseTo(1150, 5);
		expect(relativeScrubTarget(1000, -391, 782, 2400, 0.25)).toBeCloseTo(925, 5);
	});

	it('clamps to the media', () => {
		expect(relativeScrubTarget(10, -782, 782, 2400, 1)).toBe(0);
		expect(relativeScrubTarget(2390, 782, 782, 2400, 1)).toBe(2400);
	});

	it('is safe with a zero width or duration', () => {
		expect(relativeScrubTarget(5, 100, 0, 2400, 1)).toBe(5);
		expect(relativeScrubTarget(0, 100, 400, 0, 1)).toBe(0);
	});

	it('exposes the scrub window', () => {
		expect(scrubWindow(4320)).toBe(600);
		expect(scrubWindow(1200)).toBe(300);
	});
});

describe('fine rates', () => {
	it('pans: 48 px half speed, 120 px quarter speed, in both directions', () => {
		expect(panFineRate(0)).toBe(1);
		expect(panFineRate(47)).toBe(1);
		expect(panFineRate(48)).toBe(0.5);
		expect(panFineRate(-60)).toBe(0.5);
		expect(panFineRate(119)).toBe(0.5);
		expect(panFineRate(-120)).toBe(0.25);
	});

	it('track: 40 px above half speed, 100 px quarter speed', () => {
		expect(trackFineRate(-20)).toBe(1);
		expect(trackFineRate(39)).toBe(1);
		expect(trackFineRate(40)).toBe(0.5);
		expect(trackFineRate(99)).toBe(0.5);
		expect(trackFineRate(100)).toBe(0.25);
	});
});

describe('absoluteScrubTarget', () => {
	const track = { left: 16, width: 408 };

	it('maps the x position on the track', () => {
		expect(absoluteScrubTarget(16, track, 3600)).toBe(0);
		expect(absoluteScrubTarget(220, track, 3600)).toBeCloseTo(1800, 5);
		expect(absoluteScrubTarget(424, track, 3600)).toBe(3600);
	});

	it('clamps outside the track', () => {
		expect(absoluteScrubTarget(-50, track, 3600)).toBe(0);
		expect(absoluteScrubTarget(900, track, 3600)).toBe(3600);
	});
});

describe('magnet', () => {
	const chapters: Chapter[] = [
		{ start: 0, end: 600, title: 'Intro' },
		{ start: 600, end: 1800, title: 'Hawkins' },
		{ start: 1800, end: 3600, title: 'Upside Down' }
	];

	it('snaps to a chapter start within 6 px', () => {
		// 0.2 px per second: 25 s = 5 px.
		expect(magnet(1825, chapters, 0.2)).toBe(1800);
		expect(magnet(575, chapters, 0.2)).toBe(600);
	});

	it('leaves the target alone beyond the threshold', () => {
		expect(magnet(1835, chapters, 0.2)).toBe(1835);
		expect(magnet(1835, chapters, 0.2, 8)).toBe(1800);
	});

	it('ignores missing chapters', () => {
		expect(magnet(100, [], 1)).toBe(100);
	});
});

describe('isCancel', () => {
	it('cancels within 8 px of the origin', () => {
		expect(isCancel(1010, 1000, 0.5)).toBe(true);
		expect(isCancel(1016, 1000, 0.5)).toBe(true);
		expect(isCancel(1017, 1000, 0.5)).toBe(false);
		expect(isCancel(990, 1000, 1, 12)).toBe(true);
	});
});
