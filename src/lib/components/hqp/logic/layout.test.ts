import { describe, expect, it } from 'vitest';
import {
	aspectClass,
	chromeEdges,
	fillCrop,
	frameRect,
	glideTop,
	intersects,
	islandRects,
	layoutFor,
	type Rect
} from './layout';

const PORTRAIT = { width: 440, height: 956 };
const LANDSCAPE = { width: 956, height: 440 };
const DESKTOP = { width: 1440, height: 900 };
const SIM18_PORTRAIT = { top: 62, right: 0, bottom: 34, left: 0 };
const SIM18_LANDSCAPE = { top: 0, right: 62, bottom: 21, left: 62 };

describe('layoutFor', () => {
	it('mirrors the CSS breakpoints', () => {
		expect(layoutFor(440, 956)).toBe('phone-portrait');
		expect(layoutFor(428, 926)).toBe('phone-portrait');
		expect(layoutFor(375, 667)).toBe('phone-portrait-short');
		expect(layoutFor(320, 693)).toBe('phone-portrait-short');
		expect(layoutFor(956, 440)).toBe('phone-landscape');
		expect(layoutFor(693, 320)).toBe('phone-landscape');
		expect(layoutFor(1440, 900)).toBe('large');
		expect(layoutFor(820, 1180)).toBe('large');
		expect(layoutFor(1180, 820)).toBe('large');
	});

	it('treats a square viewport as portrait, like the orientation media query', () => {
		expect(layoutFor(500, 500)).toBe('phone-portrait-short');
	});

	it('switches exactly at 599/600 wide and 499/500 tall', () => {
		expect(layoutFor(599, 900)).toBe('phone-portrait');
		expect(layoutFor(600, 900)).toBe('large');
		expect(layoutFor(900, 499)).toBe('phone-landscape');
		expect(layoutFor(900, 500)).toBe('large');
		expect(layoutFor(440, 759)).toBe('phone-portrait-short');
		expect(layoutFor(440, 760)).toBe('phone-portrait');
	});
});

describe('chromeEdges', () => {
	it('gives 53/16/38 in portrait with the simulated iPhone 18 insets', () => {
		expect(chromeEdges('phone-portrait', SIM18_PORTRAIT)).toEqual({ top: 53, x: 16, bottom: 38 });
	});

	it('gives 12/48/25 in landscape', () => {
		expect(chromeEdges('phone-landscape', SIM18_LANDSCAPE)).toEqual({ top: 12, x: 48, bottom: 25 });
	});

	it('uses 13 Pro Max-like insets, never the island shape', () => {
		const notch = { top: 47, right: 0, bottom: 34, left: 0 };
		expect(chromeEdges('phone-portrait', notch)).toEqual({ top: 53, x: 16, bottom: 38 });
		const landscape13 = { top: 0, right: 47, bottom: 21, left: 47 };
		expect(chromeEdges('phone-landscape', landscape13).x).toBe(33);
	});

	it('falls back to 16 px sides and 18 px bottom without insets', () => {
		const none = { top: 0, right: 0, bottom: 0, left: 0 };
		expect(chromeEdges('phone-portrait', none)).toEqual({ top: 6, x: 16, bottom: 18 });
	});

	it('uses fixed 24/48/24 edges on large layouts', () => {
		expect(chromeEdges('large', { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({
			top: 24,
			x: 48,
			bottom: 24
		});
	});
});

describe('glideTop', () => {
	it('caps the island inset at the 47 px island-free edge (iPhone 18 Pro Max, top 62)', () => {
		expect(glideTop(SIM18_PORTRAIT)).toBe(47);
	});

	it('keeps a 13 Pro Max inset and never goes above 12 px', () => {
		expect(glideTop({ top: 47, right: 0, bottom: 34, left: 0 })).toBe(47);
		expect(glideTop({ top: 20, right: 0, bottom: 0, left: 0 })).toBe(20);
		expect(glideTop({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(12);
	});

	it('shares its top line with the portrait chrome edge', () => {
		expect(glideTop(SIM18_PORTRAIT)).toBe(chromeEdges('phone-portrait', SIM18_PORTRAIT).top - 6);
	});
});

describe('frameRect', () => {
	it('places a 16:9 picture full width centred at 39% in portrait (less dead band above)', () => {
		const r = frameRect('phone-portrait', PORTRAIT, 16 / 9, 'fit');
		expect(r.x).toBe(0);
		expect(r.width).toBe(440);
		expect(r.height).toBeCloseTo(247.5, 1);
		expect(Math.round(r.y)).toBe(249);
		expect(Math.round(r.y + r.height)).toBe(497);
	});

	it('keeps the portrait picture top at 118 px or lower', () => {
		const r = frameRect('phone-portrait', PORTRAIT, 4 / 5, 'fit');
		expect(r.y).toBeGreaterThanOrEqual(118);
		expect(r.y + r.height).toBeLessThanOrEqual(956);
	});

	it('moves the centre to 36% on short portrait screens', () => {
		const r = frameRect('phone-portrait-short', { width: 320, height: 693 }, 16 / 9, 'fit');
		expect(r.width).toBe(320);
		expect(r.y).toBeCloseTo(0.36 * 693 - 90, 1);
	});

	it('fills the height for 16:9 in landscape (782 x 440, never smaller)', () => {
		const r = frameRect('phone-landscape', LANDSCAPE, 16 / 9, 'fit');
		expect(Math.round(r.width)).toBe(782);
		expect(r.height).toBe(440);
		expect(Math.round(r.x)).toBe(87);
		expect(r.y).toBe(0);
	});

	it('fills the width for 2.39:1 in landscape', () => {
		const r = frameRect('phone-landscape', LANDSCAPE, 2.39, 'fit');
		expect(r.width).toBe(956);
		expect(Math.round(r.height)).toBe(400);
		expect(Math.round(r.y)).toBe(20);
	});

	it('pillarboxes 4:3', () => {
		const r = frameRect('large', DESKTOP, 4 / 3, 'fit');
		expect(r.height).toBe(900);
		expect(r.width).toBe(1200);
		expect(r.x).toBe(120);
	});

	it('covers the viewport in Fill', () => {
		expect(frameRect('phone-landscape', LANDSCAPE, 16 / 9, 'fill')).toEqual({
			x: 0,
			y: 0,
			width: 956,
			height: 440
		});
		expect(frameRect('large', DESKTOP, 2.39, 'fill')).toEqual({
			x: 0,
			y: 0,
			width: 1440,
			height: 900
		});
	});

	it('survives a missing or broken aspect', () => {
		const r = frameRect('phone-landscape', LANDSCAPE, Number.NaN, 'fit');
		expect(Math.round(r.width)).toBe(782);
	});
});

describe('fillCrop', () => {
	it('crops 18% of a 16:9 picture on 956 x 440', () => {
		const crop = fillCrop(LANDSCAPE, 16 / 9);
		expect(crop.cropPercent).toBe(18);
		expect(crop.scale).toBeCloseTo(956 / 782.22, 2);
	});

	it('crops nothing when the aspects match', () => {
		expect(fillCrop({ width: 1600, height: 900 }, 16 / 9)).toEqual({ scale: 1, cropPercent: 0 });
	});

	it('crops a scope picture vertically on a 16:10 screen', () => {
		const crop = fillCrop(DESKTOP, 2.39);
		expect(crop.cropPercent).toBe(33);
		expect(crop.scale).toBeCloseTo(2.39 / 1.6, 3);
	});
});

describe('aspectClass', () => {
	it('splits at 1.85 and 2.2', () => {
		expect(aspectClass(16 / 9)).toBe('standard');
		expect(aspectClass(1.85)).toBe('standard');
		expect(aspectClass(2)).toBe('wide');
		expect(aspectClass(2.2)).toBe('wide');
		expect(aspectClass(2.39)).toBe('scope');
	});
});

describe('islandRects', () => {
	it('returns the portrait island', () => {
		expect(islandRects(PORTRAIT)).toEqual([{ x: 157, y: 11, width: 126, height: 37 }]);
	});

	it('returns both landscape positions', () => {
		expect(islandRects(LANDSCAPE)).toEqual([
			{ x: 11, y: 157, width: 37, height: 126 },
			{ x: 908, y: 157, width: 37, height: 126 }
		]);
	});

	it('returns nothing on large layouts', () => {
		expect(islandRects(DESKTOP)).toEqual([]);
	});
});

describe('intersects', () => {
	const island: Rect = { x: 157, y: 11, width: 126, height: 37 };

	it('detects overlap and ignores touching edges', () => {
		expect(intersects({ x: 150, y: 40, width: 20, height: 20 }, island)).toBe(true);
		expect(intersects({ x: 0, y: 48, width: 440, height: 44 }, island)).toBe(false);
		expect(intersects({ x: 283, y: 11, width: 10, height: 10 }, island)).toBe(false);
	});

	it('keeps the portrait top bar (y 53..97) clear of the island', () => {
		const edges = chromeEdges('phone-portrait', SIM18_PORTRAIT);
		const close: Rect = { x: edges.x, y: edges.top, width: 44, height: 44 };
		const group: Rect = {
			x: 440 - edges.x - 3 * 44 - 8,
			y: edges.top,
			width: 3 * 44 + 8,
			height: 44
		};
		for (const rect of [close, group]) {
			for (const isle of islandRects(PORTRAIT)) expect(intersects(rect, isle)).toBe(false);
		}
	});

	it('keeps landscape controls inside the 48 px sides clear of both island positions', () => {
		const edges = chromeEdges('phone-landscape', SIM18_LANDSCAPE);
		const timeline: Rect = { x: edges.x, y: 440 - 75 - 44, width: 956 - 2 * edges.x, height: 44 };
		const side: Rect = { x: edges.x, y: 150, width: 44, height: 140 };
		const right: Rect = { x: 956 - edges.x - 44, y: 150, width: 44, height: 140 };
		for (const isle of islandRects(LANDSCAPE)) {
			expect(intersects(timeline, isle)).toBe(false);
			expect(intersects(side, isle)).toBe(false);
			expect(intersects(right, isle)).toBe(false);
		}
	});
});
