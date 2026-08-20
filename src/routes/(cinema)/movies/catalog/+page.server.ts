import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { prepareStandardMovies } from '$lib/server/queries/local-movie-search';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';

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
		const genreMovieIds = await db
			.select({ movieId: movieGenres.movieId })
			.from(movieGenres)
			.where(eq(movieGenres.genreId, genreId))
			.catch(() => []);

		const ids = genreMovieIds.map((g) => g.movieId);
		if (ids.length > 0) {
			whereClause = and(whereClause, inArray(movies.id, ids)) as any;
		} else {
			// Keep the request local and return an empty page when the archive has no match.
			whereClause = and(whereClause, eq(movies.id, '00000000-0000-0000-0000-000000000000')) as any;
		}
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
	const [localMovies, totalCountResult, dbGenres] = await Promise.all([
		db.query.movies
			.findMany({
				where: whereClause,
				orderBy: [orderByClause],
				limit,
				offset,
				with: { keywords: true, genres: { with: { genre: true } } }
			})
			.catch(() => []),
		db
			.select({ count: sql<number>`count(*)` })
			.from(movies)
			.where(whereClause)
			.catch(() => [{ count: 0 }]),
		db.query.genres.findMany().catch(() => [])
	]);

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
