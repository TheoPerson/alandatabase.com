import { error } from '@sveltejs/kit';
import type { PosterItem } from '$lib/catalogue/items';
import { searchLocalMovies } from '$lib/server/queries/local-movie-search';
import { parseSearchParameters } from '$lib/server/security/request-bounds';
import { logServerError } from '$lib/server/security/logging';
import { getGenres, getTrendingMovies, toPosterItem } from '$lib/server/services/movie.service';

const SEARCH_LIMIT = 30;
const TRENDING_LIMIT = 12;

interface GenreOption {
	id: number;
	name: string;
}

// The loader only reads: a GET never writes, and the empty-state reads below are best effort.
export async function load({ url }) {
	const parsedParameters = parseSearchParameters(url, {
		defaultLimit: SEARCH_LIMIT,
		maximumLimit: SEARCH_LIMIT
	});
	if (!parsedParameters.ok) {
		throw error(400, parsedParameters.error);
	}

	const { query, limit } = parsedParameters.value;

	if (query) {
		let results: PosterItem[] = [];
		let searchError = false;
		try {
			results = (await searchLocalMovies(query, limit)).map(toPosterItem);
		} catch (err) {
			logServerError('Local movie search failed', err);
			searchError = true;
		}
		return {
			query,
			limit,
			results,
			searchError,
			trending: [] as PosterItem[],
			genres: [] as GenreOption[]
		};
	}

	// No query: the page offers something to open instead. Each read may fail on its own.
	const [trending, genres] = await Promise.allSettled([
		getTrendingMovies(TRENDING_LIMIT),
		getGenres()
	]);
	if (trending.status === 'rejected')
		logServerError('Search trending films failed', trending.reason);
	if (genres.status === 'rejected') logServerError('Search genre list failed', genres.reason);

	return {
		query,
		limit,
		results: [] as PosterItem[],
		searchError: false,
		trending: trending.status === 'fulfilled' ? trending.value.map(toPosterItem) : [],
		genres: genres.status === 'fulfilled' ? (genres.value as GenreOption[]) : []
	};
}
