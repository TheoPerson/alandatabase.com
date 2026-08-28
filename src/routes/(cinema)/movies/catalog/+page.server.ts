import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { desc, and, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { prepareStandardMovies } from '$lib/server/queries/local-movie-search';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
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

	const { page, genreId, decade, sortBy } = parsedParameters.value;
	const limit = 24;
	const offset = (page - 1) * limit;

	// Build the local SQL where clause
	let whereClause = standardMovieVisibilityWhere();
	if (genreId) {
		whereClause = and(
			whereClause,
			sql`exists (select 1 from ${movieGenres} where ${movieGenres.movieId} = ${movies.id} and ${movieGenres.genreId} = ${genreId})`
		) as any;
	}

	if (decade) {
		const startYear = decade;
		const endYear = decade + 9;
		whereClause = and(
			whereClause,
			sql`EXTRACT(YEAR FROM ${movies.releaseDate}) >= ${startYear}`,
			sql`EXTRACT(YEAR FROM ${movies.releaseDate}) <= ${endYear}`
		) as any;
	}

	// Build order by
	let orderByClause = desc(movies.popularity);
	if (sortBy === 'rating') {
		orderByClause = desc(movies.voteAverage);
	} else if (sortBy === 'release') {
		orderByClause = desc(movies.releaseDate);
	}

	// 1. Fetch from local PostgreSQL
	let localMovies;
	let totalCountResult;
	let dbGenres;
	try {
		[localMovies, totalCountResult, dbGenres] = await Promise.all([
			db.query.movies.findMany({
				where: whereClause,
				orderBy: [orderByClause, desc(movies.id)],
				limit,
				offset,
				with: { keywords: true, genres: { with: { genre: true } } }
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(movies)
				.where(whereClause),
			db.query.genres.findMany().catch(() => [])
		]);
	} catch (err) {
		logServerError('Catalog read failed', err);
		throw error(503, 'The catalogue is temporarily unavailable.');
	}

	const formattedMovies = prepareStandardMovies(localMovies);
	const totalCount = Number(totalCountResult[0]?.count || 0);

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
