// Pure helpers for the Library page: which tab is open and the numbers on the Stats tab.

export const LIBRARY_TABS = [
	// The owner's own files (Alan's HQP); never offered to anyone else.
	{ key: 'local', label: 'On this PC', ownerOnly: true },
	{ key: 'watchlist', label: 'Watchlist', ownerOnly: false },
	{ key: 'favorites', label: 'Favourites', ownerOnly: false },
	{ key: 'watched', label: 'Watched', ownerOnly: false },
	{ key: 'stats', label: 'Stats', ownerOnly: false }
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

/** The tabs a person may open: "On this PC" only for the owner. */
export function libraryTabsFor(owner: boolean) {
	return LIBRARY_TABS.filter((tab) => owner || !tab.ownerOnly);
}

export function parseLibraryTab(value: string | null, owner = false): LibraryTab {
	return libraryTabsFor(owner).find((tab) => tab.key === value)?.key ?? 'watchlist';
}

/** "On this PC" grids grow by this many titles per "Load more". */
export const LOCAL_PAGE_SIZE = 48;
export const MAX_LOCAL_PAGES = 20;

/** How many pages of a local grid to show (`?films=3`): 1..MAX_LOCAL_PAGES, else 1. */
export function parseLocalPages(value: string | null): number {
	if (value === null || !/^\d{1,3}$/u.test(value)) return 1;
	return Math.min(Math.max(Number(value), 1), MAX_LOCAL_PAGES);
}

export interface WatchedFilm {
	runtime: number | null;
	genres: string[];
	releaseDate: string | null;
}

export interface LibraryStats {
	watchedCount: number;
	hours: number;
	topGenres: Array<{ name: string; count: number }>;
	decades: Array<{ decade: number; count: number }>;
}

export function libraryStats(watched: WatchedFilm[]): LibraryStats {
	let minutes = 0;
	const genres = new Map<string, number>();
	const decades = new Map<number, number>();

	for (const film of watched) {
		if (film.runtime && film.runtime > 0) minutes += film.runtime;
		for (const genre of film.genres) genres.set(genre, (genres.get(genre) ?? 0) + 1);
		const year = /^(\d{4})-/u.exec(film.releaseDate ?? '')?.[1];
		if (year) {
			const decade = Math.floor(Number(year) / 10) * 10;
			decades.set(decade, (decades.get(decade) ?? 0) + 1);
		}
	}

	return {
		watchedCount: watched.length,
		hours: Math.round((minutes / 60) * 10) / 10,
		topGenres: [...genres]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
			.slice(0, 5),
		decades: [...decades]
			.map(([decade, count]) => ({ decade, count }))
			.sort((a, b) => b.decade - a.decade)
	};
}
