import { error } from '@sveltejs/kit';
import { searchLocalMovies } from '$lib/server/queries/local-movie-search';
import { parseSearchParameters } from '$lib/server/security/request-bounds';
import { logServerError } from '$lib/server/security/logging';

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
	let searchError = false;

	if (query) {
		try {
			results = await searchLocalMovies(query, limit);
		} catch (err) {
			logServerError('Local movie search failed', err);
			results = [];
			searchError = true;
		}
	}

	return {
		query,
		results,
		searchError
	};
}
