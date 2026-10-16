import { redirect } from '@sveltejs/kit';
import type { PosterItem } from '$lib/catalogue/items';
import { libraryStats, parseLibraryTab } from '$lib/catalogue/library';
import {
	getUserFavorites,
	getUserWatchedHistory,
	getUserWatchlist
} from '$lib/server/services/interaction.service';
import type { PageServerLoad } from './$types';

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

// Personal library: the session guard in hooks covers /my, and this loader re-checks it.
export const load = (async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent('/my/films')}`);
	}
	const user = locals.user;

	const [watchlistRows, favoriteRows, watchedRows] = await Promise.all([
		getUserWatchlist(user.id),
		getUserFavorites(user.id),
		getUserWatchedHistory(user.id)
	]);
	const watchlist = films(watchlistRows);
	const favorites = films(favoriteRows);
	const watched = films(watchedRows);

	return {
		user: { username: user.username, displayName: user.displayName ?? null },
		tab: parseLibraryTab(url.searchParams.get('tab')),
		counts: { watchlist: watchlist.length, favorites: favorites.length, watched: watched.length },
		watchlist: watchlist.map(toPoster),
		favorites: favorites.map(toPoster),
		watched: watched.map(toPoster),
		stats: libraryStats(
			watched.map((movie) => ({
				runtime: movie.runtime ?? null,
				genres: genreNames(movie),
				releaseDate: movie.releaseDate ?? null
			}))
		)
	};
}) satisfies PageServerLoad;
