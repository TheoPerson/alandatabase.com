import { db } from '../db/index.js';
import { movies, genres, movieGenres, people, movieCast, movieCrew, collections, movieVideos } from '../db/schema.js';
import { eq, desc, sql, ilike, and, inArray } from 'drizzle-orm';
import { ensureTablesExist } from '../db/migrate.js';
import { TMDBClient, ingestMovie } from '../tmdb.js';

export interface MovieFilters {
	query?: string;
	genreId?: number;
	year?: number;
	sortBy?: 'popularity' | 'voteAverage' | 'releaseDate';
	limit?: number;
	offset?: number;
}

let dbInitialized = false;

async function checkDbReady() {
	if (!dbInitialized) {
		await ensureTablesExist();
		dbInitialized = true;
	}
}

export function applyLocalOverrides(movie: any) {
	if (!movie) return movie;
	if (movie.localOverrides) {
		const overrides: any = movie.localOverrides;
		if (overrides.title) movie.title = overrides.title;
		if (overrides.originalTitle) movie.originalTitle = overrides.originalTitle;
		if (overrides.releaseDate) movie.releaseDate = overrides.releaseDate;
		if (overrides.overview) movie.overview = overrides.overview;
	}
	return movie;
}

export async function getTrendingMovies(limit = 12, offset = 0) {
	await checkDbReady();
	const results = await db.query.movies.findMany({
		orderBy: [desc(movies.popularity)],
		limit,
		offset,
		with: {
			genres: {
				with: {
					genre: true
				}
			}
		}
	});
	return results.map(applyLocalOverrides);
}

export async function getTopRatedMovies(limit = 12, offset = 0) {
	await checkDbReady();
	const results = await db.query.movies.findMany({
		orderBy: [desc(movies.voteAverage)],
		limit,
		offset,
		with: {
			genres: {
				with: {
					genre: true
				}
			}
		}
	});
	return results.map(applyLocalOverrides);
}

export async function countMovies() {
	await checkDbReady();
	const result = await db.select({ count: sql<number>`count(*)` }).from(movies);
	return Number(result[0].count);
}

export async function getMovieById(id: string) {
	await checkDbReady();

	// Check by UUID or TMDB ID
	const isNumeric = /^\d+$/.test(id);

	let found = await db.query.movies.findFirst({
		where: isNumeric ? eq(movies.tmdbId, parseInt(id, 10)) : eq(movies.id, id),
		with: {
			collection: true,
			genres: {
				with: {
					genre: true
				}
			},
			cast: {
				orderBy: (cast: any, { asc }: any) => [asc(cast.castOrder)],
				limit: 15,
				with: {
					person: true
				}
			},
			crew: {
				limit: 10,
				with: {
					person: true
				}
			},
			videos: true
		}
	});

	// Automatic TMDB fallback ingestion if missing
	if (!found && isNumeric) {
		const tmdbId = parseInt(id, 10);
		console.log(`🎬 Movie TMDB #${tmdbId} not found locally. Auto-ingesting...`);
		try {
			const newUuid = await ingestMovie(tmdbId);
			if (newUuid) {
				found = await db.query.movies.findFirst({
					where: eq(movies.id, newUuid),
					with: {
						collection: true,
						genres: {
							with: {
								genre: true
							}
						},
						cast: {
							orderBy: (cast: any, { asc }: any) => [asc(cast.castOrder)],
							limit: 15,
							with: {
								person: true
							}
						},
						crew: {
							limit: 10,
							with: {
								person: true
							}
						},
						videos: true
					}
				});
			}
		} catch (err) {
			console.warn(`⚠️ Ingestion failed for TMDB #${tmdbId}, trying live API fallback:`, err);
		}

		// Instant Live API fallback if DB record is not ready yet
		if (!found) {
			try {
				const client = new TMDBClient();
				const details = await client.getMovieDetails(tmdbId);
				found = {
					id: String(details.id),
					tmdbId: details.id,
					imdbId: details.imdb_id,
					title: details.title,
					originalTitle: details.original_title,
					originalLanguage: details.original_language,
					overview: details.overview,
					tagline: details.tagline,
					posterPath: details.poster_path,
					backdropPath: details.backdrop_path,
					releaseDate: details.release_date,
					runtime: details.runtime,
					status: details.status,
					budget: details.budget,
					revenue: details.revenue,
					popularity: String(details.popularity),
					voteAverage: String(details.vote_average),
					voteCount: details.vote_count,
					adult: details.adult,
					collection: details.belongs_to_collection ? {
						id: String(details.belongs_to_collection.id),
						tmdbId: details.belongs_to_collection.id,
						name: details.belongs_to_collection.name,
						overview: null,
						posterPath: details.belongs_to_collection.poster_path,
						backdropPath: details.belongs_to_collection.backdrop_path,
						createdAt: new Date(),
						updatedAt: new Date()
					} : null,
					genres: (details.genres || []).map((g: any) => ({ genre: g })),
					cast: (details.credits?.cast || []).slice(0, 15).map((c: any) => ({
						character: c.character,
						castOrder: c.order,
						person: {
							name: c.name,
							profilePath: c.profile_path
						}
					})),
					crew: (details.credits?.crew || []).slice(0, 10).map((c: any) => ({
						job: c.job,
						department: c.department,
						person: {
							name: c.name,
							profilePath: c.profile_path
						}
					})),
					videos: (details.videos?.results || []).map((v: any) => ({
						key: v.key,
						site: v.site,
						type: v.type,
						name: v.name,
						official: v.official
					}))
				} as any;
			} catch (err) {
				console.error(`❌ Live TMDB lookup failed for TMDB #${tmdbId}:`, err);
			}
		}
	}

	return applyLocalOverrides(found);
}

export async function getPersonById(id: string) {
	await checkDbReady();
	return db.query.people.findFirst({
		where: eq(people.id, id),
		with: {
			castRoles: {
				limit: 20,
				with: {
					movie: true
				}
			},
			crewRoles: {
				limit: 10,
				with: {
					movie: true
				}
			}
		}
	});
}

export async function searchMovies(q: string, limit = 20) {
	await checkDbReady();
	if (!q) return [];

	// 1. Check local DB first
	const localResults = await db.query.movies.findMany({
		where: ilike(movies.title, `%${q}%`),
		orderBy: [desc(movies.popularity)],
		limit,
		with: {
			genres: {
				with: {
					genre: true
				}
			}
		}
	});

	if (localResults.length >= 5) return localResults.map(applyLocalOverrides);

	// 2. Query TMDB API directly and return results immediately
	try {
		const client = new TMDBClient();
		const searchRes = await client.searchMovies(q, 1);
		const tmdbResults = searchRes.results.slice(0, limit);

		// Convert TMDB results to display-ready format matching our schema shape
		const tmdbFormatted = tmdbResults.map((m: any) => ({
			id: String(m.id), // Use TMDB ID as string for linking
			tmdbId: m.id,
			title: m.title,
			originalTitle: m.original_title,
			originalLanguage: m.original_language,
			overview: m.overview,
			posterPath: m.poster_path,
			backdropPath: m.backdrop_path,
			releaseDate: m.release_date,
			popularity: String(m.popularity),
			voteAverage: String(m.vote_average),
			voteCount: m.vote_count,
			adult: m.adult,
			genres: [] // No genre join data from search endpoint
		}));

		// Merge: local results first, then TMDB results not already in local
		const localTmdbIds = new Set(localResults.map((m: any) => m.tmdbId));
		const newFromTmdb = tmdbFormatted.filter((m: any) => !localTmdbIds.has(m.tmdbId));
		const merged = [...localResults, ...newFromTmdb].slice(0, limit);

		// Fire-and-forget: ingest top results in background (don't await)
		Promise.resolve().then(async () => {
			for (const m of tmdbResults.slice(0, 5)) {
				await ingestMovie(m.id).catch(() => null);
			}
		});

		return merged.map(applyLocalOverrides);
	} catch (err) {
		console.warn('⚠️ TMDB search fallback failed:', err);
		return localResults.map(applyLocalOverrides);
	}
}

