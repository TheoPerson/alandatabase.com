import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service.js';

export async function load({ url }) {
	const page = Number(url.searchParams.get('page')) || 1;
	const limit = 24;
	const offset = (page - 1) * limit;
	
	const genreId = url.searchParams.get('genre') ? Number(url.searchParams.get('genre')) : null;
	const decade = url.searchParams.get('decade') ? Number(url.searchParams.get('decade')) : null;
	const sortBy = url.searchParams.get('sort') || 'popularity'; // 'popularity', 'rating', 'release'

	// Build the where clause
	let whereClause = eq(movies.adult, false);
	if (genreId) {
		// Filter by genre using an IN subquery (or joins, but this is simpler)
		const genreMovieIds = await db
			.select({ movieId: movieGenres.movieId })
			.from(movieGenres)
			.where(eq(movieGenres.genreId, genreId));
		
		const ids = genreMovieIds.map(g => g.movieId);
		if (ids.length > 0) {
			whereClause = and(whereClause, inArray(movies.id, ids)) as any;
		} else {
			// No movies found for this genre
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

	// Fetch movies
	const [allMovies, totalCountResult, genreList] = await Promise.all([
		db.query.movies.findMany({
			where: whereClause,
			orderBy: [orderByClause],
			limit,
			offset,
			with: { genres: { with: { genre: true } } }
		}),
		db.select({ count: sql<number>`count(*)` }).from(movies).where(whereClause),
		db.query.genres.findMany()
	]);

	const totalCount = Number(totalCountResult[0].count);
	const totalPages = Math.ceil(totalCount / limit);

	return {
		movies: allMovies.map(applyLocalOverrides),
		genreList,
		pagination: {
			page,
			limit,
			totalCount,
			totalPages
		},
		filters: {
			genreId,
			sortBy
		}
	};
}
