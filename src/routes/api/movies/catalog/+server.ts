import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { prepareStandardMovies } from '$lib/server/queries/local-movie-search';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';

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
		const genreMovieIds = await db
			.select({ movieId: movieGenres.movieId })
			.from(movieGenres)
			.where(eq(movieGenres.genreId, genreId))
			.catch(() => []);

		const ids = genreMovieIds.map((g) => g.movieId);
		if (ids.length > 0) {
			whereClause = and(whereClause, inArray(movies.id, ids)) as any;
		} else {
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

	let orderByClause = desc(movies.popularity);
	if (sortBy === 'rating') {
		orderByClause = desc(movies.voteAverage);
	} else if (sortBy === 'release') {
		orderByClause = desc(movies.releaseDate);
	}

	const [localMovies, totalCountResult] = await Promise.all([
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
			.catch(() => [{ count: 0 }])
	]);

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
