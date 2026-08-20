import { error } from '@sveltejs/kit';
import { searchLocalMovies } from '$lib/server/queries/local-movie-search';
import { parseSearchParameters } from '$lib/server/security/request-bounds';

export async function load({ url }) {
	const parsedParameters = parseSearchParameters(url, {
		defaultLimit: 30,
		maximumLimit: 30
	});
	if (!parsedParameters.ok) {
		throw error(400, parsedParameters.error);
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

	return {
		query,
		results
	};
}
