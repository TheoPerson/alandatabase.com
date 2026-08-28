import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { toggleWatchlist } from '$lib/server/services/interaction.service';
import { logServerError } from '$lib/server/security/logging';
import { hasPermission } from '$lib/server/auth/permissions';
import { fail } from '@sveltejs/kit';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function load({ locals }) {
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;

	try {
		// Zero duplicate guarantee:
		// top10 = #1 to #10
		// trending = #11 to #22
		// topRated = top 12 by vote average
		const [top10, trending, topRated] = await Promise.all([
			getTrendingMovies(10, 0),
			getTrendingMovies(12, 10),
			getTopRatedMovies(12, 0)
		]);

		return {
			top10,
			trending,
			topRated,
			user
		};
	} catch (err: unknown) {
		logServerError('Movie catalogue load failed', err);
		return {
			top10: [],
			trending: [],
			topRated: [],
			user,
			error: 'The catalogue is temporarily unavailable.'
		};
	}
}

export const actions = {
	toggleWatchlist: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Sign in to update your watchlist.' });
		}
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal watchlists are owner-only.' });
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
