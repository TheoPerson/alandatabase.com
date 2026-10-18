import { describe, expect, it } from 'vitest';
import {
	LIBRARY_TABS,
	MAX_LOCAL_PAGES,
	libraryStats,
	libraryTabsFor,
	parseLibraryTab,
	parseLocalPages
} from './library';

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
	it('accepts the known tabs for the owner and falls back to the watchlist', () => {
		for (const tab of LIBRARY_TABS) expect(parseLibraryTab(tab.key, true)).toBe(tab.key);
		expect(parseLibraryTab(null, true)).toBe('watchlist');
		expect(parseLibraryTab('admin', true)).toBe('watchlist');
	});

	it('never opens On this PC for anyone but the owner', () => {
		expect(parseLibraryTab('local')).toBe('watchlist');
		expect(parseLibraryTab('local', false)).toBe('watchlist');
		expect(parseLibraryTab('stats', false)).toBe('stats');
	});
});

describe('libraryTabsFor', () => {
	it('hides the local tab from non-owners and shows it first to the owner', () => {
		expect(libraryTabsFor(false).map((tab) => tab.key)).toEqual([
			'watchlist',
			'favorites',
			'watched',
			'stats'
		]);
		expect(libraryTabsFor(true)[0]).toMatchObject({ key: 'local', label: 'On this PC' });
	});
});

describe('parseLocalPages', () => {
	it('reads 1..max pages and falls back to 1', () => {
		expect(parseLocalPages(null)).toBe(1);
		expect(parseLocalPages('3')).toBe(3);
		expect(parseLocalPages('0')).toBe(1);
		expect(parseLocalPages('999')).toBe(MAX_LOCAL_PAGES);
		expect(parseLocalPages('2.5')).toBe(1);
		expect(parseLocalPages('-1')).toBe(1);
		expect(parseLocalPages('abc')).toBe(1);
	});
});
