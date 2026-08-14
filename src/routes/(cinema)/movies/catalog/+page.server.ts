import { db } from '$lib/server/db/index.js';
import { movies, movieGenres } from '$lib/server/db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service.js';
import { TMDBClient } from '$lib/server/tmdb.js';

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
	const page = Number(url.searchParams.get('page')) || 1;
	const limit = 24;
	const offset = (page - 1) * limit;

	const genreId = url.searchParams.get('genre') ? Number(url.searchParams.get('genre')) : null;
	const decade = url.searchParams.get('decade') ? Number(url.searchParams.get('decade')) : null;
	const sortBy = url.searchParams.get('sort') || 'popularity'; // 'popularity', 'rating', 'release'

	// Build the local SQL where clause
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
			// No local DB movies with this genre tag yet -> force TMDB fallback
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
				with: { genres: { with: { genre: true } } }
			})
			.catch(() => []),
		db
			.select({ count: sql<number>`count(*)` })
			.from(movies)
			.where(whereClause)
			.catch(() => [{ count: 0 }]),
		db.query.genres.findMany().catch(() => [])
	]);

	let formattedMovies = localMovies.map(applyLocalOverrides);
	let totalCount = Number(totalCountResult[0]?.count || 0);

	// 2. Hybrid TMDB Fallback: if local results are insufficient, fetch live from TMDB Discover API
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
				discoverParams['vote_count.gte'] = '20';
			} else {
				discoverParams['sort_by'] = 'popularity.desc';
			}

			const tmdbData = await client.discoverMovies(discoverParams);
			const existingTmdbIds = new Set(formattedMovies.map((m) => m.tmdbId));

			for (const item of tmdbData.results) {
				if (!existingTmdbIds.has(item.id) && item.poster_path && item.overview) {
					formattedMovies.push({
						id: String(item.id),
						tmdbId: item.id,
						imdbId: null,
						title: item.title,
						originalTitle: item.original_title,
						originalLanguage: item.original_language,
						overview: item.overview,
						tagline: null,
						posterPath: item.poster_path,
						backdropPath: item.backdrop_path,
						releaseDate: item.release_date,
						runtime: null,
						status: 'Released',
						budget: 0,
						revenue: 0,
						popularity: String(item.popularity),
						voteAverage: String(item.vote_average),
						voteCount: item.vote_count,
						adult: item.adult || false,
						collectionId: null,
						isLocked: false,
						metadata: null,
						localOverrides: null,
						genres: item.genre_ids
							? item.genre_ids.map((gid) => ({
									genre: STANDARD_GENRES.find((g) => g.id === gid) || { id: gid, name: 'Cinema' }
								}))
							: []
					});
				}
				if (formattedMovies.length >= limit) break;
			}

			totalCount = Math.max(totalCount, (tmdbData.total_pages || 10) * limit);
		} catch (err) {
			console.warn('TMDB Discover fallback error:', err);
		}
	}

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
