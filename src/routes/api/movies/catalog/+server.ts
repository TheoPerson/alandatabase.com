import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service.js';
import { TMDBClient } from '$lib/server/tmdb.js';

export async function GET({ url, setHeaders }) {
	setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
	});

	const page = Number(url.searchParams.get('page')) || 1;
	const limit = 24;
	const offset = (page - 1) * limit;

	const genreId = url.searchParams.get('genre') ? Number(url.searchParams.get('genre')) : null;
	const decade = url.searchParams.get('decade') ? Number(url.searchParams.get('decade')) : null;
	const sortBy = url.searchParams.get('sort') || 'popularity';

	let whereClause = eq(movies.adult, false);
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
				with: { genres: { with: { genre: true } } }
			})
			.catch(() => []),
		db
			.select({ count: sql<number>`count(*)` })
			.from(movies)
			.where(whereClause)
			.catch(() => [{ count: 0 }])
	]);

	let formattedMovies = localMovies.map(applyLocalOverrides);
	let totalCount = Number(totalCountResult[0]?.count || 0);

	if (formattedMovies.length < limit) {
		try {
			const client = new TMDBClient();
			const discoverParams: Record<string, string> = {
				page: String(page),
				include_adult: 'false'
			};

			if (genreId) {
				discoverParams['with_genres'] = String(genreId);
			}

			if (decade) {
				discoverParams['primary_release_date.gte'] = `${decade}-01-01`;
				discoverParams['primary_release_date.lte'] = `${decade + 9}-12-31`;
			}

			if (sortBy === 'rating') {
				discoverParams['sort_by'] = 'vote_average.desc';
				discoverParams['vote_count.gte'] = '100';
			} else if (sortBy === 'release') {
				discoverParams['sort_by'] = 'primary_release_date.desc';
			} else {
				discoverParams['sort_by'] = 'popularity.desc';
			}

			const tmdbRes = await client.discoverMovies(discoverParams);
			if (tmdbRes.results && tmdbRes.results.length > 0) {
				totalCount = Math.max(totalCount, tmdbRes.total_pages * 20);

				const existingTmdbIds = new Set(formattedMovies.map((m: any) => m.tmdbId));
				const fallbackMovies = tmdbRes.results
					.filter((m) => !existingTmdbIds.has(m.id))
					.map((m) => ({
						id: String(m.id),
						tmdbId: m.id,
						imdbId: null,
						title: m.title,
						originalTitle: m.original_title,
						tagline: null,
						overview: m.overview,
						releaseDate: m.release_date || null,
						runtime: null,
						posterPath: m.poster_path,
						backdropPath: m.backdrop_path,
						popularity: m.popularity,
						voteAverage: m.vote_average,
						voteCount: m.vote_count,
						budget: null,
						revenue: null,
						status: 'Released',
						adult: false,
						genres: []
					}));

				formattedMovies = [...formattedMovies, ...fallbackMovies].slice(0, limit);
			}
		} catch (err) {
			console.error('TMDB fallback error in catalog API:', err);
		}
	}

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
