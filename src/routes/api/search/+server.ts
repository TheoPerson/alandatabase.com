import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchMovies } from '$lib/server/services/movie.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const limit = parseInt(url.searchParams.get('limit') || '5', 10);
	let results: any[] = [];

	if (query.trim()) {
		try {
			results = await searchMovies(query.trim(), Math.min(limit, 20));
		} catch (err) {
			console.error('API Search Error:', err);
			results = [];
		}
	}

	return json({
		query,
		results: results.map((m) => ({
			id: m.id,
			title: m.title,
			releaseDate: m.releaseDate,
			posterPath: m.posterPath,
			voteAverage: m.voteAverage
		}))
	});
};
