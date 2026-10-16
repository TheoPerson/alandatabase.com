// Pure helpers for the Library page: which tab is open and the numbers on the Stats tab.

export const LIBRARY_TABS = [
	{ key: 'watchlist', label: 'Watchlist' },
	{ key: 'favorites', label: 'Favourites' },
	{ key: 'watched', label: 'Watched' },
	{ key: 'stats', label: 'Stats' }
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

export function parseLibraryTab(value: string | null): LibraryTab {
	return LIBRARY_TABS.find((tab) => tab.key === value)?.key ?? 'watchlist';
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
