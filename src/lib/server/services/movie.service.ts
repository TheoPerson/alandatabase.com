import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { movies, people } from '../db/schema.js';
import { isStandardMovie, standardMovieVisibilityWhere } from '../policies/movie-visibility.js';

export interface MovieFilters {
	query?: string;
	genreId?: number;
	year?: number;
	sortBy?: 'popularity' | 'voteAverage' | 'releaseDate';
	limit?: number;
	offset?: number;
}

export function applyLocalOverrides(movie: any) {
	if (!movie) return movie;
	const resolved = { ...movie };
	if (resolved.localOverrides) {
		const overrides: any = resolved.localOverrides;
		if (overrides.title) resolved.title = overrides.title;
		if (overrides.originalTitle) resolved.originalTitle = overrides.originalTitle;
		if (overrides.releaseDate) resolved.releaseDate = overrides.releaseDate;
		if (overrides.overview) resolved.overview = overrides.overview;
	}
	delete resolved.localOverrides;
	return resolved;
}

function stripVisibilityMetadata(movie: any) {
	const visibleMovie = { ...movie };
	delete visibleMovie.keywords;
	return visibleMovie;
}

export function prepareStandardMovie(movie: any) {
	if (!isStandardMovie(movie)) return null;
	return applyLocalOverrides(stripVisibilityMetadata(movie));
}

function prepareVisibleMovies(movieRecords: any[]) {
	return movieRecords
		.map((movie) => prepareStandardMovie(movie))
		.filter((movie): movie is NonNullable<typeof movie> => movie !== null);
}

export async function getTrendingMovies(limit = 12, offset = 0) {
	const results = await db.query.movies.findMany({
		where: standardMovieVisibilityWhere(),
		orderBy: [desc(movies.popularity)],
		limit,
		offset,
		with: {
			genres: {
				with: {
					genre: true
				}
			},
			keywords: true
		}
	});
	return prepareVisibleMovies(results);
}

export async function getTopRatedMovies(limit = 12, offset = 0) {
	const results = await db.query.movies.findMany({
		where: standardMovieVisibilityWhere(),
		orderBy: [desc(movies.voteAverage)],
		limit,
		offset,
		with: {
			genres: {
				with: {
					genre: true
				}
			},
			keywords: true
		}
	});
	return prepareVisibleMovies(results);
}

export async function countMovies() {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(movies)
		.where(standardMovieVisibilityWhere());
	return Number(result[0]?.count || 0);
}

export async function getMovieById(id: string) {
	const isNumeric = /^\d+$/.test(id);
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

	if (!isNumeric && !isUuid) {
		return null;
	}

	const identityWhere = isNumeric ? eq(movies.tmdbId, parseInt(id, 10)) : eq(movies.id, id);

	const found = await db.query.movies.findFirst({
		where: and(standardMovieVisibilityWhere(), identityWhere),
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
			videos: true,
			keywords: true
		}
	});

	return prepareStandardMovie(found);
}

function prepareVisibleRoles(roles: any[]) {
	return roles
		.filter((role) => role.movie && isStandardMovie(role.movie))
		.map((role) => ({
			...role,
			movie: applyLocalOverrides(stripVisibilityMetadata(role.movie))
		}));
}

export async function getPersonById(id: string) {
	const person = await db.query.people.findFirst({
		where: eq(people.id, id),
		with: {
			castRoles: {
				limit: 20,
				with: {
					movie: {
						with: { keywords: true }
					}
				}
			},
			crewRoles: {
				limit: 10,
				with: {
					movie: {
						with: { keywords: true }
					}
				}
			}
		}
	});

	if (!person) return person;

	return {
		...person,
		castRoles: prepareVisibleRoles(person.castRoles || []),
		crewRoles: prepareVisibleRoles(person.crewRoles || [])
	};
}

function normalizeSearchLimit(limit: number) {
	if (!Number.isFinite(limit)) return 30;
	return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export async function searchMovies(q: string, limit = 30) {
	if (!q || !q.trim()) return [];
	const queryStr = q.trim();
	const queryLower = queryStr.toLowerCase();
	const safeLimit = normalizeSearchLimit(limit);

	try {
		const [localResults, localActors] = await Promise.all([
			db.query.movies
				.findMany({
					where: and(standardMovieVisibilityWhere(), ilike(movies.title, `%${queryStr}%`)),
					orderBy: [desc(movies.popularity)],
					limit: Math.max(15, safeLimit),
					with: {
						genres: { with: { genre: true } },
						keywords: true
					}
				})
				.catch(() => []),
			db.query.people
				.findMany({
					where: ilike(people.name, `%${queryStr}%`),
					limit: 3,
					with: {
						castRoles: {
							limit: 10,
							with: {
								movie: {
									with: {
										genres: { with: { genre: true } },
										keywords: true
									}
								}
							}
						}
					}
				})
				.catch(() => [])
		]);

		const localActorMovies: any[] = [];
		for (const actor of localActors) {
			for (const role of actor.castRoles || []) {
				if (role.movie && isStandardMovie(role.movie)) {
					localActorMovies.push({ ...role.movie, fromActorSearch: true });
				}
			}
		}

		const candidateMap = new Map<number, any>();
		for (const movie of [...localResults, ...localActorMovies]) {
			if (!isStandardMovie(movie)) continue;

			const visibleMovie = stripVisibilityMetadata(movie);
			candidateMap.set(movie.tmdbId, {
				...visibleMovie,
				id: visibleMovie.id || String(movie.tmdbId),
				popularityNum: Number(visibleMovie.popularity || 0),
				voteAvgNum: Number(visibleMovie.voteAverage || 0),
				voteCountNum: Number(visibleMovie.voteCount || 0)
			});
		}

		const scoredCandidates = Array.from(candidateMap.values()).map((movie) => {
			let score = 0;
			const titleLower = (movie.title || '').toLowerCase();

			if (titleLower === queryLower) {
				score += 5000;
			} else if (titleLower.startsWith(queryLower)) {
				score += 2000;
			} else if (titleLower.includes(queryLower)) {
				score += 800;
			}

			score += (movie.popularityNum || 0) * 5;
			score += (movie.voteAvgNum || 0) * 20;
			score += Math.log10((movie.voteCountNum || 0) + 1) * 50;

			if (movie.fromActorSearch) {
				score += 400;
			}

			return { movie, score };
		});

		scoredCandidates.sort((a, b) => b.score - a.score);
		return scoredCandidates.slice(0, safeLimit).map((item) => applyLocalOverrides(item.movie));
	} catch (err) {
		console.warn('Search algorithm error:', err);
		return [];
	}
}
