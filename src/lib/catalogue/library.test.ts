import { describe, expect, it } from 'vitest';
import { LIBRARY_TABS, libraryStats, parseLibraryTab } from './library';

const film = (runtime: number | null, genres: string[], releaseDate: string | null) => ({
	runtime,
	genres,
	releaseDate
});

describe('libraryStats', () => {
	it('counts films and hours, rounding hours to one decimal', () => {
		const stats = libraryStats([film(120, [], null), film(95, [], null), film(null, [], null)]);
		expect(stats.watchedCount).toBe(3);
		expect(stats.hours).toBe(3.6);
	});

	it('ranks the five most watched genres, ties broken by name', () => {
		const stats = libraryStats([
			film(1, ['Drama', 'Crime'], null),
			film(1, ['Drama'], null),
			film(1, ['Comedy', 'Crime'], null),
			film(1, ['Action'], null),
			film(1, ['Western'], null),
			film(1, ['Horror'], null)
		]);
		expect(stats.topGenres).toEqual([
			{ name: 'Crime', count: 2 },
			{ name: 'Drama', count: 2 },
			{ name: 'Action', count: 1 },
			{ name: 'Comedy', count: 1 },
			{ name: 'Horror', count: 1 }
		]);
	});

	it('groups by decade, newest first, ignoring missing or malformed dates', () => {
		const stats = libraryStats([
			film(1, [], '1999-12-31'),
			film(1, [], '1994-01-01'),
			film(1, [], '2014-06-01'),
			film(1, [], null),
			film(1, [], 'soon')
		]);
		expect(stats.decades).toEqual([
			{ decade: 2010, count: 1 },
			{ decade: 1990, count: 2 }
		]);
	});

	it('is all zeros and empty lists for an empty library', () => {
		expect(libraryStats([])).toEqual({ watchedCount: 0, hours: 0, topGenres: [], decades: [] });
	});
});

describe('parseLibraryTab', () => {
	it('accepts the known tabs and falls back to the watchlist', () => {
		for (const tab of LIBRARY_TABS) expect(parseLibraryTab(tab.key)).toBe(tab.key);
		expect(parseLibraryTab(null)).toBe('watchlist');
		expect(parseLibraryTab('admin')).toBe('watchlist');
	});
});
