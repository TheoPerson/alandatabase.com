import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { getOrCreateDefaultUser, toggleWatchlist } from '$lib/server/services/interaction.service';

export async function load() {
	try {
		const [trending, topRated] = await Promise.all([
			getTrendingMovies(12),
			getTopRatedMovies(12)
		]);

		return {
			trending,
			topRated
		};
	} catch (err) {
		// Fallback empty list if DB is not connected yet
		return {
			trending: [],
			topRated: []
		};
	}
}

export const actions = {
	toggleWatchlist: async ({ request }) => {
		const data = await request.formData();
		const movieId = data.get('movieId') as string;
		if (!movieId) return { success: false };

		const user = await getOrCreateDefaultUser();
		const interaction = await toggleWatchlist(user.id, movieId);
		return { success: true, watchlist: interaction.watchlist };
	}
};
