import { error } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';

export async function load({ params }) {
	const movieId = params.id;
	
	try {
		const movie = await getMovieById(movieId);

		if (!movie) {
			throw error(404, 'Movie not found');
		}

		return {
			movie,
			credits: [] as any[]
		};
	} catch (e) {
		console.error('Error fetching movie details:', e);
		throw error(500, 'Failed to load movie details');
	}
}
