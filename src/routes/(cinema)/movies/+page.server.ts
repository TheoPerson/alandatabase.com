import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';
import { toggleWatchlist } from '$lib/server/services/interaction.service';

export async function load({ setHeaders }) {
	setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
	});

	try {
		const [trending, topRated, allTV] = await Promise.all([
			getTrendingMovies(20),
			getTopRatedMovies(12),
			getTop50IMDbTVShows().catch(() => [])
		]);

		return {
			trending,
			topRated,
			topTV: allTV.slice(0, 10)
		};
	} catch (err: any) {
		console.error('LOAD ERROR:', err);
		return {
			trending: [],
			topRated: [],
			topTV: [],
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
