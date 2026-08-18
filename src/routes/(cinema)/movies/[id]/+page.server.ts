import { error } from '@sveltejs/kit';
import { getMovieById, getMovieCredits } from '$lib/server/services/tmdb.service';

export async function load({ params }) {
	const movieId = parseInt(params.id);
	
	if (isNaN(movieId)) {
		throw error(404, 'Invalid movie ID');
	}

	try {
		const [movie, credits] = await Promise.all([
			getMovieById(movieId),
			getMovieCredits(movieId)
		]);

		if (!movie) {
			throw error(404, 'Movie not found');
		}

		return {
			movie,
			credits: credits?.cast?.slice(0, 10) || []
		};
	} catch (e) {
		console.error('Error fetching movie details:', e);
		throw error(500, 'Failed to load movie details');
	}
}
