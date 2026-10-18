import { describe, expect, it } from 'vitest';
import { decadeSentence, scrollEdges, watchTime } from './library-view';

describe('watchTime', () => {
	it('reads as hours and minutes, never as a decimal', () => {
		expect(watchTime(1212)).toEqual({ hours: 20, minutes: 12, label: '20 h 12 min' });
		expect(watchTime(120)).toEqual({ hours: 2, minutes: 0, label: '2 h' });
	});

	it('stays in minutes under an hour, and is honest about nothing watched', () => {
		expect(watchTime(45).label).toBe('45 min');
		expect(watchTime(0).label).toBe('0 min');
		expect(watchTime(-5).label).toBe('0 min');
		expect(watchTime(Number.NaN).label).toBe('0 min');
	});

	it('rounds a fractional minute total', () => {
		expect(watchTime(59.6).label).toBe('1 h');
	});
});

describe('decadeSentence', () => {
	it('says it in one line when every film is from one decade', () => {
		expect(decadeSentence([{ decade: 2020, count: 12 }])).toBe('All 12 films are from the 2020s.');
		expect(decadeSentence([{ decade: 1990, count: 1 }])).toBe('Your one film is from the 1990s.');
	});

	it('leaves several decades to the chart', () => {
		expect(
			decadeSentence([
				{ decade: 2020, count: 2 },
				{ decade: 2010, count: 1 }
			])
		).toBeNull();
		expect(decadeSentence([])).toBeNull();
	});
});

describe('scrollEdges', () => {
	it('fades only the side that still has content', () => {
		expect(scrollEdges(0, 656, 440)).toEqual({ start: false, end: true });
		expect(scrollEdges(100, 656, 440)).toEqual({ start: true, end: true });
		expect(scrollEdges(216, 656, 440)).toEqual({ start: true, end: false });
	});

	it('treats a row that fits, or sub-pixel leftovers, as not scrollable', () => {
		expect(scrollEdges(0, 400, 440)).toEqual({ start: false, end: false });
		expect(scrollEdges(0.4, 440.6, 440)).toEqual({ start: false, end: false });
	});
});
