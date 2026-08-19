import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { toggleWatchlist } from '$lib/server/services/interaction.service';

export async function load() {
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
			topRated
		};
	} catch (err: any) {
		console.error('LOAD ERROR:', err);
		return {
			top10: [],
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
