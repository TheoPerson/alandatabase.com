import { describe, expect, it } from 'vitest';
import { railScrollTarget } from './scroll';

describe('railScrollTarget', () => {
	it('moves by 90% of the viewport in the requested direction', () => {
		expect(railScrollTarget(0, 1000, 5000, 1)).toBe(900);
		expect(railScrollTarget(1800, 1000, 5000, -1)).toBe(900);
	});

	it('clamps at both ends', () => {
		expect(railScrollTarget(3800, 1000, 5000, 1)).toBe(4000);
		expect(railScrollTarget(100, 1000, 5000, -1)).toBe(0);
	});

	it('never goes negative when content fits', () => {
		expect(railScrollTarget(0, 1000, 800, 1)).toBe(0);
	});
});
