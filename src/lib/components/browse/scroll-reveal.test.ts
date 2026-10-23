import { describe, expect, it } from 'vitest';
import { nextReveal, type RevealState } from './scroll-reveal';

const shown: RevealState = { hidden: false, anchorY: 0 };

describe('nextReveal', () => {
	it('keeps the bar while the page is above the point where it may tuck away', () => {
		expect(nextReveal(shown, 300, 400)).toEqual({ hidden: false, anchorY: 300 });
		expect(nextReveal({ hidden: true, anchorY: 900 }, 380, 400)).toEqual({
			hidden: false,
			anchorY: 380
		});
	});

	it('tucks the bar away once the visitor scrolls down past that point', () => {
		expect(nextReveal({ hidden: false, anchorY: 500 }, 540, 400)).toEqual({
			hidden: true,
			anchorY: 540
		});
	});

	it('brings it back as soon as the visitor scrolls up', () => {
		expect(nextReveal({ hidden: true, anchorY: 1200 }, 1170, 400)).toEqual({
			hidden: false,
			anchorY: 1170
		});
	});

	it('ignores small jitters, such as the momentum bounce, until they add up', () => {
		const state = { hidden: false, anchorY: 1000 };
		expect(nextReveal(state, 1006, 400)).toBe(state);
		expect(nextReveal(state, 995, 400)).toBe(state);
		expect(nextReveal(state, 1013, 400).hidden).toBe(true);
	});

	it('a jump straight past the point (restored scroll, deep link) tucks the bar too', () => {
		expect(nextReveal(shown, 1200, 400).hidden).toBe(true);
	});
});
