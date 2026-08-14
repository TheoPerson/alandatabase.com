import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';
import { toggleWatchlist } from '$lib/server/services/interaction.service';

const REACHER_HERO = {
	id: 'reacher',
	tmdbId: 108978,
	title: 'REACHER',
	originalTitle: 'Reacher',
	voteAverage: 8.1,
	releaseDate: '2022-02-04',
	genres: [{ name: 'Action & Adventure' }, { name: 'Drama' }, { name: 'Crime' }],
	overview:
		'Jack Reacher, a veteran military police investigator, has just recently entered civilian life. Reacher is a drifter, carrying no phone and the barest of essentials as he travels the country and explores the nation he once served.',
	backdropPath: 'https://image.tmdb.org/t/p/original/pF0qkRsrHkdYadPWY9AMeFZfcwk.jpg',
	posterPath: 'https://image.tmdb.org/t/p/w500/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg',
	isTV: true
};

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
			featuredHero: REACHER_HERO,
			trending,
			topRated,
			topTV: allTV.slice(0, 10)
		};
	} catch (err: any) {
		console.error('LOAD ERROR:', err);
		return {
			featuredHero: REACHER_HERO,
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
