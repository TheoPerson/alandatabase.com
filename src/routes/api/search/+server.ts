import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchLocalMovies } from '$lib/server/queries/local-movie-search';
import { parseSearchParameters } from '$lib/server/security/request-bounds';

export const GET: RequestHandler = async ({ url }) => {
	const parsedParameters = parseSearchParameters(url, {
		defaultLimit: 5,
		maximumLimit: 20
	});
	if (!parsedParameters.ok) {
		return json({ error: parsedParameters.error }, { status: 400 });
	}

	const { query, limit } = parsedParameters.value;
	let results: Awaited<ReturnType<typeof searchLocalMovies>> = [];

	if (query) {
		try {
			results = await searchLocalMovies(query, limit);
		} catch {
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
