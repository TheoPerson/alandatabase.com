import { describe, expect, it } from 'vitest';
import { createSheetCache } from './sheet-cache';

describe('createSheetCache', () => {
	it('keeps at most three sheets, most recent first, releasing the evicted', () => {
		const loaded: string[] = [];
		const released: string[] = [];
		const cache = createSheetCache((url) => {
			loaded.push(url);
			return { release: () => released.push(url) };
		});
		cache.touch(['b', 'a', 'c']); // current b, neighbours a and c
		expect(cache.held()).toEqual(['b', 'a', 'c']);
		cache.touch(['d', 'c']);
		expect(cache.held()).toEqual(['d', 'c', 'b']);
		expect(released).toEqual(['a']);
		expect(loaded).toEqual(['b', 'a', 'c', 'd']);
	});

	it('does not reload a held sheet and releases everything on clear', () => {
		const released: string[] = [];
		let loads = 0;
		const cache = createSheetCache(() => {
			loads += 1;
			return { release: () => released.push('x') };
		});
		cache.touch(['a']);
		cache.touch(['a']);
		expect(loads).toBe(1);
		cache.clear();
		expect(released).toHaveLength(1);
		expect(cache.held()).toEqual([]);
	});
});
