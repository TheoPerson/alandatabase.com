import { describe, expect, it } from 'vitest';
import { nextIndex, previousIndex, swipeDirection } from './rotation';

describe('carousel rotation', () => {
	it('wraps forwards and backwards', () => {
		expect(nextIndex(0, 5)).toBe(1);
		expect(nextIndex(4, 5)).toBe(0);
		expect(previousIndex(0, 5)).toBe(4);
	});

	it('is stable with zero or one item', () => {
		expect(nextIndex(0, 0)).toBe(0);
		expect(previousIndex(0, 0)).toBe(0);
		expect(nextIndex(0, 1)).toBe(0);
	});

	it('turns a horizontal drag into a direction only past the threshold', () => {
		expect(swipeDirection(-60)).toBe(1);
		expect(swipeDirection(60)).toBe(-1);
		expect(swipeDirection(-20)).toBe(0);
		expect(swipeDirection(39.9, 40)).toBe(0);
	});
});
