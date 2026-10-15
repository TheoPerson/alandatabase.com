import { db } from '$lib/server/db/index.js';
import { error } from '@sveltejs/kit';
import { listCatalogue } from '$lib/server/services/catalogue.service';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';
import { logServerError } from '$lib/server/security/logging';

const STANDARD_GENRES = [
	{ id: 28, name: 'Action' },
	{ id: 12, name: 'Adventure' },
	{ id: 16, name: 'Animation' },
	{ id: 35, name: 'Comedy' },
	{ id: 80, name: 'Crime' },
	{ id: 99, name: 'Documentary' },
	{ id: 18, name: 'Drama' },
	{ id: 10751, name: 'Family' },
	{ id: 14, name: 'Fantasy' },
	{ id: 36, name: 'History' },
	{ id: 27, name: 'Horror' },
	{ id: 10402, name: 'Music' },
	{ id: 9648, name: 'Mystery' },
	{ id: 10749, name: 'Romance' },
	{ id: 878, name: 'Science Fiction' },
	{ id: 10770, name: 'TV Movie' },
	{ id: 53, name: 'Thriller' },
	{ id: 10752, name: 'War' },
	{ id: 37, name: 'Western' }
];

export async function load({ url }) {
	const parsedParameters = parseCatalogParameters(url);
	if (!parsedParameters.ok) {
		throw error(400, parsedParameters.error);
	}

	const { page, genreId, decade, minRating, sortBy } = parsedParameters.value;
	const limit = 24;

	// 1. Fetch from local PostgreSQL
	let catalogue;
	let dbGenres;
	try {
		[catalogue, dbGenres] = await Promise.all([
			listCatalogue({ page, limit, genreId, decade, minRating, sortBy }),
			db.query.genres.findMany().catch(() => [])
		]);
	} catch (err) {
		logServerError('Catalog read failed', err);
		throw error(503, 'The catalogue is temporarily unavailable.');
	}

	const formattedMovies = catalogue.movies;
	const totalCount = catalogue.totalCount;

	const totalPages = Math.ceil(totalCount / limit);
	const genreList = dbGenres && dbGenres.length > 0 ? dbGenres : STANDARD_GENRES;

	return {
		movies: formattedMovies,
		genreList,
		pagination: {
			page,
			limit,
			totalCount,
			totalPages
		},
		filters: {
			genreId,
			decade,
			sortBy
		}
	};
}
