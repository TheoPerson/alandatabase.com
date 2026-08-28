import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { desc, and, sql } from 'drizzle-orm';
import { prepareStandardMovies } from '$lib/server/queries/local-movie-search';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';
import { logServerError } from '$lib/server/security/logging';

export async function GET({ url }) {
	const parsedParameters = parseCatalogParameters(url);
	if (!parsedParameters.ok) {
		return json({ error: parsedParameters.error }, { status: 400 });
	}

	const { page, genreId, decade, sortBy } = parsedParameters.value;
	const limit = 24;
	const offset = (page - 1) * limit;

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

	let orderByClause = desc(movies.popularity);
	if (sortBy === 'rating') {
		orderByClause = desc(movies.voteAverage);
	} else if (sortBy === 'release') {
		orderByClause = desc(movies.releaseDate);
	}

	let localMovies;
	let totalCountResult;
	try {
		[localMovies, totalCountResult] = await Promise.all([
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
				.where(whereClause)
		]);
	} catch (err) {
		logServerError('Catalog API read failed', err);
		return json({ error: 'The catalogue is temporarily unavailable.' }, { status: 503 });
	}

	const formattedMovies = prepareStandardMovies(localMovies);
	const totalCount = Number(totalCountResult[0]?.count || 0);

	const totalPages = Math.ceil(totalCount / limit) || 1;
	const hasMore = page < totalPages && formattedMovies.length > 0;

	return json({
		movies: formattedMovies,
		page,
		hasMore,
		totalPages,
		totalCount
	});
}
