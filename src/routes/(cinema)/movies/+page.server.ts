import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { getOrCreateDefaultUser, toggleWatchlist } from '$lib/server/services/interaction.service';

export async function load() {
	try {
		const [trending, topRated] = await Promise.all([getTrendingMovies(12), getTopRatedMovies(12)]);

		return {
			trending,
			topRated
		};
	} catch (err: any) {
		console.error('LOAD ERROR:', err);
		// Fallback empty list if DB is not connected yet
		return {
			trending: [],
			topRated: [],
			error: err?.message || String(err)
		};
	}
}

export const actions = {
	toggleWatchlist: async ({ request, locals }) => {
		if (!locals.user) {
			return { success: false, error: 'Unauthorized' };
		}
		const data = await request.formData();
		const movieId = data.get('movieId') as string;
		if (!movieId) return { success: false };

		const interaction = await toggleWatchlist(locals.user.id, movieId);
		return { success: true, watchlist: interaction.watchlist };
	}
};
