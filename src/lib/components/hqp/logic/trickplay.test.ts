import { describe, expect, it } from 'vitest';
import type { TrickplayManifest } from '$lib/media/types';
import { lruTouch, sheetsAround, tileAt } from './trickplay';

const manifest: TrickplayManifest = {
	status: 'ready',
	intervalSeconds: 10,
	tileWidth: 480,
	tileHeight: 270,
	columns: 5,
	rows: 5,
	sheets: ['/t/0.jpg', '/t/1.jpg', '/t/2.jpg']
};

describe('tileAt', () => {
	it('finds the first tile', () => {
		expect(tileAt(manifest, 0)).toEqual({
			url: '/t/0.jpg',
			x: 0,
			y: 0,
			tileWidth: 480,
			tileHeight: 270,
			sheetWidth: 2400,
			sheetHeight: 1350
		});
	});

	it('walks columns, rows and sheets', () => {
		// 67 s -> tile 6 -> row 1, column 1.
		expect(tileAt(manifest, 67)).toMatchObject({ url: '/t/0.jpg', x: 480, y: 270 });
		// 249 s -> tile 24 -> last tile of sheet 0.
		expect(tileAt(manifest, 249)).toMatchObject({ url: '/t/0.jpg', x: 1920, y: 1080 });
		// 250 s -> tile 25 -> first tile of sheet 1.
		expect(tileAt(manifest, 250)).toMatchObject({ url: '/t/1.jpg', x: 0, y: 0 });
		// 512 s -> tile 51 -> sheet 2, tile 1.
		expect(tileAt(manifest, 512)).toMatchObject({ url: '/t/2.jpg', x: 480, y: 0 });
	});

	it('clamps past the last sheet and before zero', () => {
		expect(tileAt(manifest, 99_999)).toMatchObject({ url: '/t/2.jpg', x: 1920, y: 1080 });
		expect(tileAt(manifest, -5)).toMatchObject({ url: '/t/0.jpg', x: 0, y: 0 });
	});

	it('returns null unless ready', () => {
		expect(tileAt({ ...manifest, status: 'pending' }, 30)).toBeNull();
		expect(tileAt({ ...manifest, status: 'unavailable' }, 30)).toBeNull();
		expect(tileAt({ ...manifest, sheets: [] }, 30)).toBeNull();
		expect(tileAt({ ...manifest, intervalSeconds: 0 }, 30)).toBeNull();
	});
});

describe('sheetsAround', () => {
	it('lists the current sheet first, then its neighbours', () => {
		expect(sheetsAround(manifest, 300)).toEqual(['/t/1.jpg', '/t/0.jpg', '/t/2.jpg']);
		expect(sheetsAround(manifest, 0)).toEqual(['/t/0.jpg', '/t/1.jpg']);
		expect(sheetsAround(manifest, 600)).toEqual(['/t/2.jpg', '/t/1.jpg']);
	});

	it('is empty unless ready', () => {
		expect(sheetsAround({ ...manifest, status: 'pending' }, 0)).toEqual([]);
	});
});

describe('lruTouch', () => {
	it('keeps the 3 most recent sheets and reports evictions', () => {
		let list: string[] = [];
		let evicted: string[];
		[list] = lruTouch(list, 'a');
		[list] = lruTouch(list, 'b');
		[list, evicted] = lruTouch(list, 'c');
		expect(evicted).toEqual([]);
		[list] = lruTouch(list, 'a');
		expect(list).toEqual(['a', 'c', 'b']);
		[list, evicted] = lruTouch(list, 'd');
		expect(list).toEqual(['d', 'a', 'c']);
		expect(evicted).toEqual(['b']);
	});
});
