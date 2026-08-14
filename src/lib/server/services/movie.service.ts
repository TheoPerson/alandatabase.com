import { db } from '../db/index.js';
import {
	movies,
	genres,
	movieGenres,
	people,
	movieCast,
	movieCrew,
	collections,
	movieVideos
} from '../db/schema.js';
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
		where: eq(movies.adult, false),
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
		where: eq(movies.adult, false),
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

	const isNumeric = /^\d+$/.test(id);
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

	if (!isNumeric && !isUuid) {
		return null;
	}

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
					collection: details.belongs_to_collection
						? {
								id: String(details.belongs_to_collection.id),
								tmdbId: details.belongs_to_collection.id,
								name: details.belongs_to_collection.name,
								overview: null,
								posterPath: details.belongs_to_collection.poster_path,
								backdropPath: details.belongs_to_collection.backdrop_path,
								createdAt: new Date(),
								updatedAt: new Date()
							}
						: null,
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
				console.error(`❌ Live TMDB lookup failed:`, err);
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

export async function searchMovies(q: string, limit = 30) {
	await checkDbReady();
	if (!q || !q.trim()) return [];
	const queryStr = q.trim();
	const queryLower = queryStr.toLowerCase();

	// 1. Query TMDB and Local DB in parallel
	try {
		const client = new TMDBClient();
		const [localResults, localActors, searchMoviesRes, searchPeopleRes] = await Promise.all([
			db.query.movies.findMany({
				where: and(ilike(movies.title, `%${queryStr}%`), eq(movies.adult, false)),
				orderBy: [desc(movies.popularity)],
				limit: 15,
				with: { genres: { with: { genre: true } } }
			}).catch(() => []),
			db.query.people.findMany({
				where: ilike(people.name, `%${queryStr}%`),
				limit: 3,
				with: {
					castRoles: {
						limit: 10,
						with: { movie: { with: { genres: { with: { genre: true } } } } }
					}
				}
			}).catch(() => []),
			client.searchMovies(queryStr, 1).catch(() => ({ results: [] })),
			client.searchPeople(queryStr, 1).catch(() => ({ results: [] }))
		]);

		// Extract actor movies from local DB
		const localActorMovies: any[] = [];
		for (const actor of localActors) {
			for (const role of actor.castRoles || []) {
				if (role.movie && !role.movie.adult) {
					localActorMovies.push(role.movie);
				}
			}
		}

		// Extract person movies from TMDB (sort people by popularity first to get the most famous actor)
		let tmdbPersonMovies: any[] = [];
		const sortedPeople = (searchPeopleRes.results || []).sort(
			(a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)
		);

		if (sortedPeople.length > 0) {
			const topPerson = sortedPeople[0];
			if (topPerson && topPerson.id) {
				try {
					const credits = await client.getPersonMovieCredits(topPerson.id);
					tmdbPersonMovies = (credits.cast || [])
						.filter((m: any) => !m.adult && (m.poster_path || m.backdrop_path))
						.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
						.slice(0, 20);
				} catch {
					tmdbPersonMovies = (topPerson.known_for || []).filter((m: any) => !m.adult);
				}
			}
		}

		// Pool all candidate movies
		const candidateMap = new Map<number, any>();

		// Add local matches
		for (const m of [...localResults, ...localActorMovies]) {
			if (m.tmdbId) {
				candidateMap.set(m.tmdbId, {
					...m,
					id: m.id || String(m.tmdbId),
					popularityNum: Number(m.popularity || 0),
					voteAvgNum: Number(m.voteAverage || 0),
					voteCountNum: Number(m.voteCount || 0)
				});
			}
		}

		// Add TMDB movie matches
		for (const m of (searchMoviesRes.results || []) as any[]) {
			if (m.id && !candidateMap.has(m.id)) {
				candidateMap.set(m.id, {
					id: String(m.id),
					tmdbId: m.id,
					title: m.title || m.name || '',
					originalTitle: m.original_title || m.original_name || '',
					originalLanguage: m.original_language || '',
					overview: m.overview || '',
					posterPath: m.poster_path || null,
					backdropPath: m.backdrop_path || null,
					releaseDate: m.release_date || m.first_air_date || '',
					popularity: String(m.popularity || 0),
					voteAverage: String(m.vote_average || 0),
					voteCount: m.vote_count || 0,
					adult: m.adult || false,
					genres: [],
					popularityNum: Number(m.popularity || 0),
					voteAvgNum: Number(m.vote_average || 0),
					voteCountNum: Number(m.vote_count || 0)
				});
			}
		}

		// Add TMDB person filmography matches
		for (const m of tmdbPersonMovies as any[]) {
			if (m.id && !candidateMap.has(m.id)) {
				candidateMap.set(m.id, {
					id: String(m.id),
					tmdbId: m.id,
					title: m.title || m.name || '',
					originalTitle: m.original_title || m.original_name || '',
					originalLanguage: m.original_language || '',
					overview: m.overview || '',
					posterPath: m.poster_path || null,
					backdropPath: m.backdrop_path || null,
					releaseDate: m.release_date || m.first_air_date || '',
					popularity: String(m.popularity || 0),
					voteAverage: String(m.vote_average || 0),
					voteCount: m.vote_count || 0,
					adult: m.adult || false,
					genres: [],
					popularityNum: Number(m.popularity || 0),
					voteAvgNum: Number(m.vote_average || 0),
					voteCountNum: Number(m.vote_count || 0),
					fromActorSearch: true
				});
			}
		}

		// Smart Relevance Ranking Algorithm
		const scoredCandidates = Array.from(candidateMap.values()).map((m) => {
			let score = 0;
			const titleLower = (m.title || '').toLowerCase();

			// Exact or close title matches get heavy boosts
			if (titleLower === queryLower) {
				score += 5000;
			} else if (titleLower.startsWith(queryLower)) {
				score += 2000;
			} else if (titleLower.includes(queryLower)) {
				score += 800;
			}

			// Popularity & Vote weighting
			score += (m.popularityNum || 0) * 5;
			score += (m.voteAvgNum || 0) * 20;
			score += Math.log10((m.voteCountNum || 0) + 1) * 50;

			// If from top actor credits, add a solid baseline
			if (m.fromActorSearch) {
				score += 400;
			}

			return { movie: m, score };
		});

		// Sort descending by score
		scoredCandidates.sort((a, b) => b.score - a.score);
		const finalResults = scoredCandidates.slice(0, limit).map((item) => item.movie);

		// Background ingest top 3 items
		Promise.resolve().then(async () => {
			for (const m of finalResults.slice(0, 3)) {
				if (m.tmdbId) {
					await ingestMovie(m.tmdbId).catch(() => null);
				}
			}
		});

		return finalResults.map(applyLocalOverrides);
	} catch (err) {
		console.warn('⚠️ Search algorithm error:', err);
		return [];
	}
}
