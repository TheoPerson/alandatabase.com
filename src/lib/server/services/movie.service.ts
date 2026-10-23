import { and, asc, desc, eq, getTableName, gte, ilike, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { genres, movieGenres, movies, people } from '../db/schema.js';
import { isStandardMovie, standardMovieVisibilityWhere } from '../policies/movie-visibility.js';
import type { HeroItem, PosterItem } from '$lib/catalogue/items';

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
	const safeLimit = normalizeSearchLimit(limit);
	const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
	const results = await db.query.movies.findMany({
		where: standardMovieVisibilityWhere(),
		orderBy: [desc(movies.popularity)],
		limit: safeLimit,
		offset: safeOffset,
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
	const safeLimit = normalizeSearchLimit(limit);
	const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
	const results = await db.query.movies.findMany({
		where: standardMovieVisibilityWhere(),
		orderBy: [desc(movies.voteAverage)],
		limit: safeLimit,
		offset: safeOffset,
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

const FEATURED_MINIMUM_VOTES = 1000;

export async function getFeaturedMovies(limit = 5) {
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			isNotNull(movies.backdropPath),
			gte(movies.voteCount, FEATURED_MINIMUM_VOTES)
		),
		orderBy: [desc(movies.voteAverage), desc(movies.popularity)],
		limit: normalizeSearchLimit(limit),
		with: {
			genres: { with: { genre: true } },
			keywords: true
		}
	});
	return prepareVisibleMovies(results);
}

/**
 * The genres a visible standard film actually carries. The genre table is shared with TV
 * (Action & Adventure, Reality, Sci-Fi & Fantasy...), and genres used only by quarantined
 * films must not leak into standard filters either.
 */
export async function getGenres() {
	return db
		.selectDistinct({ id: genres.id, name: genres.name })
		.from(genres)
		.innerJoin(movieGenres, eq(movieGenres.genreId, genres.id))
		.innerJoin(movies, eq(movies.id, movieGenres.movieId))
		.where(standardMovieVisibilityWhere())
		.orderBy(asc(genres.name));
}

function genreNames(movie: any): string[] {
	return (movie.genres ?? [])
		.map((relation: any) => relation.genre?.name ?? relation.name)
		.filter((name: unknown): name is string => typeof name === 'string' && name.length > 0);
}

export function toPosterItem(movie: any): PosterItem {
	return {
		id: String(movie.id),
		href: `/movies/${movie.id}`,
		title: movie.title,
		posterPath: movie.posterPath ?? null,
		releaseDate: movie.releaseDate ?? null,
		rating: movie.voteAverage ?? null,
		genre: genreNames(movie)[0] ?? null
	};
}

export function toHeroItem(movie: any): HeroItem {
	const metadata =
		movie.metadata && typeof movie.metadata === 'object' && !Array.isArray(movie.metadata)
			? (movie.metadata as Record<string, unknown>)
			: {};
	return {
		...toPosterItem(movie),
		backdropPath: movie.backdropPath ?? null,
		logoPath: typeof metadata.logoPath === 'string' ? metadata.logoPath : null,
		overview: movie.overview ?? null,
		runtime: movie.runtime ?? null,
		genres: genreNames(movie)
	};
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
				limit: 30,
				with: {
					person: true
				}
			},
			videos: true,
			watchProviders: true,
			keywords: {
				with: {
					keyword: true
				}
			}
		}
	});

	const movie = prepareStandardMovie(found);
	if (!movie) return null;
	// Names only: the keyword ids are visibility metadata and stay stripped.
	const keywordNames = ((found?.keywords ?? []) as Array<{ keyword?: { name?: unknown } | null }>)
		.map((row) => row.keyword?.name)
		.filter((name): name is string => typeof name === 'string' && name.length > 0);
	return { ...movie, keywordNames };
}

const SIMILAR_LIMIT = 12;
const SIMILAR_MAX = 24;

// The relational builder re-aliases Drizzle columns inside a raw `where` to the
// root table, so the genre subquery refers to movie_genres by identifier (same
// reason as standardMovieVisibilityWhere).
const genreTable = sql.identifier(getTableName(movieGenres));
const genreMovieId = sql`${genreTable}.${sql.identifier(movieGenres.movieId.name)}`;
const genreGenreId = sql`${genreTable}.${sql.identifier(movieGenres.genreId.name)}`;

/** Standard movies sharing one genre, most popular first; never the film itself. */
export async function similarMovies(
	movieId: string,
	genreId: number | null,
	limit = SIMILAR_LIMIT
) {
	if (genreId === null || !Number.isInteger(genreId)) return [];
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			ne(movies.id, movieId),
			sql`exists (
				select 1
				from ${genreTable}
				where ${genreMovieId} = ${movies.id}
					and ${genreGenreId} = ${genreId}
			)`
		),
		orderBy: [desc(movies.popularity), desc(movies.voteAverage)],
		limit: Math.min(Math.max(1, Math.trunc(limit)), SIMILAR_MAX),
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

/** The other standard films of a collection, in release order. */
export async function collectionMovies(collectionId: string | null, excludeMovieId: string) {
	if (!collectionId) return [];
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			eq(movies.collectionId, collectionId),
			ne(movies.id, excludeMovieId)
		),
		orderBy: [asc(movies.releaseDate)],
		limit: SIMILAR_MAX,
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
	const castRoles = prepareVisibleRoles(person.castRoles || []);
	const crewRoles = prepareVisibleRoles(person.crewRoles || []);

	// A person known only through quarantined titles must not become a public surface.
	if (castRoles.length === 0 && crewRoles.length === 0) return null;

	return {
		...person,
		castRoles,
		crewRoles
	};
}

function normalizeSearchLimit(limit: number) {
	if (!Number.isFinite(limit)) return 30;
	return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/gu, '\\$&');
}

export async function searchMovies(q: string, limit = 30) {
	if (!q || !q.trim()) return [];
	const queryStr = q.trim();
	const queryLower = queryStr.toLowerCase();
	const safeLimit = normalizeSearchLimit(limit);

	try {
		const titlePattern = `%${escapeLikePattern(queryStr)}%`;
		const [localResults, localActors] = await Promise.all([
			db.query.movies
				.findMany({
					where: and(standardMovieVisibilityWhere(), ilike(movies.title, titlePattern)),
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
					where: ilike(people.name, titlePattern),
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
