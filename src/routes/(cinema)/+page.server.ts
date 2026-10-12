import { fail } from '@sveltejs/kit';
import { hasPermission } from '$lib/server/auth/permissions';
import { logServerError } from '$lib/server/security/logging';
import { toggleWatchlist, getUserWatchlist } from '$lib/server/services/interaction.service';
import {
	getFeaturedMovies,
	getGenres,
	getTopRatedMovies,
	getTrendingMovies,
	toHeroItem,
	toPosterItem
} from '$lib/server/services/movie.service';
import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function settled<T>(result: PromiseSettledResult<T>, fallback: T, context: string): T {
	if (result.status === 'fulfilled') return result.value;
	logServerError(context, result.reason);
	return fallback;
}

export async function load({ locals }) {
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;

	// Every rail is independent: one failing query must not blank the page.
	const [featured, top10, trending, topRated, genres, tv, watchlist] = await Promise.allSettled([
		getFeaturedMovies(5),
		getTrendingMovies(10, 0),
		getTrendingMovies(12, 10),
		getTopRatedMovies(12, 0),
		getGenres(),
		getTop50IMDbTVShows(),
		user ? getUserWatchlist(user.id) : Promise.resolve([])
	]);

	const tvItems = settled(tv, [], 'Home TV rail failed')
		.slice(0, 10)
		.map((show) => ({
			id: `tv-${show.tmdbId}`,
			href: `/tv/${show.tmdbId}`,
			title: show.title,
			posterPath: show.posterPath,
			releaseDate: show.firstAirDate,
			rating: show.imdbRating,
			genre: show.genres[0] ?? null
		}));

	return {
		user,
		featured: settled(featured, [], 'Home featured failed').map(toHeroItem),
		top10: settled(top10, [], 'Home top 10 failed').map(toPosterItem),
		trending: settled(trending, [], 'Home trending failed').map(toPosterItem),
		topRated: settled(topRated, [], 'Home top rated failed').map(toPosterItem),
		genres: settled(genres, [], 'Home genres failed'),
		tv: tvItems,
		watchlist: settled(watchlist, [], 'Home watchlist failed')
			.map((item: { movie?: unknown }) => item.movie)
			.filter(Boolean)
			.map(toPosterItem),
		catalogueEmpty:
			featured.status === 'fulfilled' &&
			featured.value.length === 0 &&
			top10.status === 'fulfilled' &&
			top10.value.length === 0,
		error: [featured, top10, trending, topRated].every((result) => result.status === 'rejected')
	};
}

export const actions = {
	toggleWatchlist: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to update your watchlist.' });
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal watchlists need a signed-in account.' });
		}
		const data = await request.formData();
		const movieId = data.get('movieId')?.toString();
		if (!movieId || !UUID_PATTERN.test(movieId)) {
			return fail(400, { error: 'Movie identifier is invalid.' });
		}
		try {
			const interaction = await toggleWatchlist(locals.user.id, movieId);
			return { success: true, watchlist: interaction.watchlist };
		} catch (err) {
			logServerError('Watchlist update failed', err);
			return fail(500, { error: 'Watchlist could not be updated.' });
		}
	}
};
