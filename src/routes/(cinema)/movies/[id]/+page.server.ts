import { error, isHttpError } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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
	} catch (e: unknown) {
		if (isHttpError(e)) throw e;
		console.error('Error fetching movie details:', e);
		throw error(500, 'Failed to load movie details');
	}
};
