import { redirect } from '@sveltejs/kit';
import type { PosterItem } from '$lib/catalogue/items';
import {
	LOCAL_PAGE_SIZE,
	libraryStats,
	parseLibraryTab,
	parseLocalPages
} from '$lib/catalogue/library';
import { isOwnerUser } from '$lib/server/auth/owner';
import { listUnmatchedFiles, type UnmatchedFile } from '$lib/server/hqp/catalogue';
import { toContinueCardItem } from '$lib/server/hqp/launch';
import {
	getLibrarySummary,
	listContinueWatching,
	listLocalMovies,
	listLocalShows,
	type LibrarySummary,
	type LocalPosterItem
} from '$lib/server/media/repository';
import { logServerError } from '$lib/server/security/logging';
import {
	getUserFavorites,
	getUserWatchedHistory,
	getUserWatchlist
} from '$lib/server/services/interaction.service';
import type { PageServerLoad } from './$types';

const CONTINUE_RAIL_LIMIT = 12;
const RECENT_WATCHED_LIMIT = 6;

interface LibraryMovie {
	id: string;
	title: string;
	posterPath?: string | null;
	releaseDate?: string | null;
	voteAverage?: number | string | null;
	runtime?: number | null;
	genres?: Array<{ genre?: { name?: string | null } | null }> | null;
}

function genreNames(movie: LibraryMovie): string[] {
	return (movie.genres ?? [])
		.map((relation) => relation.genre?.name)
		.filter((name): name is string => Boolean(name));
}

function films(rows: Array<{ movie?: LibraryMovie | null }>): LibraryMovie[] {
	return rows.map((row) => row.movie).filter((movie): movie is LibraryMovie => Boolean(movie));
}

function toPoster(movie: LibraryMovie): PosterItem {
	return {
		id: String(movie.id),
		href: `/movies/${movie.id}`,
		title: movie.title,
		posterPath: movie.posterPath ?? null,
		releaseDate: movie.releaseDate ?? null,
		rating: movie.voteAverage ?? null,
		genre: genreNames(movie)[0] ?? null
	};
}

/** A poster for the "On this PC" grids, with the best copy's quality (ids and labels only). */
export interface LocalPoster extends PosterItem {
	quality: string | null; // "4K · HDR10", "1080p"
	episodeCount: number | null; // series only
}

const RESOLUTION_LABEL: Record<string, string> = {
	'2160p': '4K',
	'1080p': '1080p',
	'720p': '720p',
	SD: 'SD'
};
const HDR_LABEL: Record<string, string> = {
	hdr10: 'HDR10',
	hlg: 'HLG',
	'dolby-vision': 'Dolby Vision'
};

function toLocalPoster(item: LocalPosterItem & { episodeCount?: number }): LocalPoster {
	const quality = [
		item.resolution ? RESOLUTION_LABEL[item.resolution] : null,
		HDR_LABEL[item.hdr] ?? null
	]
		.filter(Boolean)
		.join(' · ');
	return {
		id: item.id,
		href: item.href,
		title: item.title,
		posterPath: item.posterPath,
		releaseDate: item.releaseDate ?? null,
		rating: item.rating ?? null,
		genre: item.genre ?? null,
		quality: quality || null,
		episodeCount: typeof item.episodeCount === 'number' ? item.episodeCount : null
	};
}

// Pages are read one after the other (each bounded), so "Load more" stays a plain link.
async function pagesOf<T>(
	read: (limit: number, offset: number) => Promise<T[]>,
	pages: number
): Promise<{ items: T[]; full: boolean }> {
	const items: T[] = [];
	for (let index = 0; index < pages; index += 1) {
		const page = await read(LOCAL_PAGE_SIZE, index * LOCAL_PAGE_SIZE);
		items.push(...page);
		if (page.length < LOCAL_PAGE_SIZE) return { items, full: false };
	}
	return { items, full: true };
}

export interface LocalLibrary {
	summary: LibrarySummary | null;
	films: LocalPoster[];
	shows: LocalPoster[];
	filmPages: number;
	showPages: number;
	moreFilms: boolean;
	moreShows: boolean;
	unmatched: UnmatchedFile[];
}

async function readLocal(
	summary: LibrarySummary | null,
	filmPages: number,
	showPages: number
): Promise<LocalLibrary> {
	const [movies, shows, unmatched] = await Promise.all([
		pagesOf(listLocalMovies, filmPages),
		pagesOf(listLocalShows, showPages),
		listUnmatchedFiles()
	]);
	return {
		summary,
		films: movies.items.map(toLocalPoster),
		shows: shows.items.map(toLocalPoster),
		filmPages,
		showPages,
		moreFilms: summary ? summary.films > movies.items.length : movies.full,
		moreShows: summary ? summary.shows > shows.items.length : shows.full,
		unmatched
	};
}

async function attempt<T>(read: () => Promise<T>, fallback: T, context: string): Promise<T> {
	try {
		return await read();
	} catch (err) {
		logServerError(context, err);
		return fallback;
	}
}

// Personal library: the session guard in hooks covers /my, and this loader re-checks it.
export const load = (async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent('/my/films')}`);
	}
	const user = locals.user;
	// The owner's own files (Alan's HQP): never read for anyone else.
	const owner = isOwnerUser(user);
	const tab = parseLibraryTab(url.searchParams.get('tab'), owner);

	const [watchlistRows, favoriteRows, watchedRows, continueRows, summary] = await Promise.all([
		getUserWatchlist(user.id),
		getUserFavorites(user.id),
		getUserWatchedHistory(user.id),
		owner
			? attempt(
					() => listContinueWatching(user.id, CONTINUE_RAIL_LIMIT),
					[],
					'Library continue watching failed'
				)
			: Promise.resolve([]),
		owner
			? attempt<LibrarySummary | null>(getLibrarySummary, null, 'Library summary failed')
			: Promise.resolve(null)
	]);

	let local: LocalLibrary | null = null;
	let localError = false;
	if (owner && tab === 'local') {
		try {
			local = await readLocal(
				summary,
				parseLocalPages(url.searchParams.get('films')),
				parseLocalPages(url.searchParams.get('shows'))
			);
		} catch (err) {
			logServerError('Library local files failed', err);
			localError = true;
		}
	}

	const watchlist = films(watchlistRows);
	const favorites = films(favoriteRows);
	const watched = films(watchedRows);

	return {
		user: { username: user.username, displayName: user.displayName ?? null },
		owner,
		tab,
		counts: {
			watchlist: watchlist.length,
			favorites: favorites.length,
			watched: watched.length,
			local: summary ? summary.films + summary.shows : null
		},
		watchlist: watchlist.map(toPoster),
		favorites: favorites.map(toPoster),
		watched: watched.map(toPoster),
		stats: {
			...libraryStats(
				watched.map((movie) => ({
					runtime: movie.runtime ?? null,
					genres: genreNames(movie),
					releaseDate: movie.releaseDate ?? null
				}))
			),
			// Exact total, so Stats can say "20 h 12 min" rather than a rounded decimal.
			minutes: watched.reduce(
				(total, movie) => total + (movie.runtime && movie.runtime > 0 ? movie.runtime : 0),
				0
			)
		},
		recentWatched: watched.slice(0, RECENT_WATCHED_LIMIT).map(toPoster),
		continueWatching: continueRows.map(toContinueCardItem),
		local,
		localError
	};
}) satisfies PageServerLoad;
