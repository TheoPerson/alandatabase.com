import { db } from '../db';
import { movies, movieGenres, genres, movieCrew, movieCast, people } from '../db/schema';
import { eq, and, desc, sql, inArray, notInArray, gte, lte, or } from 'drizzle-orm';
import { PICKER_DEFAULTS } from './config';
import { getOrEnrichImdbRating } from './imdb';
import type { PickerCandidate, PickerFilters, UserTasteProfile } from './types';

interface QueryOptions {
	filters: PickerFilters;
	tasteProfile: UserTasteProfile;
	shownMovieIds?: string[];
	limit?: number;
}

export async function fetchCandidateMovies({
	filters,
	tasteProfile,
	shownMovieIds = [],
	limit = PICKER_DEFAULTS.candidatePoolSize
}: QueryOptions): Promise<PickerCandidate[]> {
	// 1. Compile hard exclusion IDs
	const excludeIds = new Set<string>(shownMovieIds);

	if (filters.excludeWatched !== false) {
		for (const id of tasteProfile.watchedMovieIds) {
			excludeIds.add(id);
		}
	}

	if (filters.excludeDisliked !== false) {
		for (const id of tasteProfile.dislikedMovieIds) {
			excludeIds.add(id);
		}
	}

	// 2. Query candidates from PostgreSQL
	let candidates = await executeCandidateQuery({
		filters,
		excludeIds: Array.from(excludeIds),
		limit
	});

	// 3. Fallback relaxation if candidate pool is too small (< 12 items)
	if (candidates.length < 12) {
		const relaxedFilters: PickerFilters = {
			...filters,
			minRating: filters.minRating ? Math.max(6.0, filters.minRating - 0.7) : undefined,
			minVotes: filters.minVotes ? Math.max(300, Math.floor(filters.minVotes / 3)) : undefined,
			minYear: filters.minYear ? Math.max(1960, filters.minYear - 10) : undefined
		};

		const fallbackCandidates = await executeCandidateQuery({
			filters: relaxedFilters,
			excludeIds: Array.from(excludeIds),
			limit: limit - candidates.length
		});

		const seenTmdbIds = new Set(candidates.map((c) => c.tmdbId));
		for (const fc of fallbackCandidates) {
			if (!seenTmdbIds.has(fc.tmdbId)) {
				candidates.push(fc);
				seenTmdbIds.add(fc.tmdbId);
			}
		}
	}

	// 4. Enrich authentic IMDb ratings in background / runtime cache
	const enrichedCandidates = await Promise.all(
		candidates.map(async (c) => {
			const { imdbRating, imdbVoteCount } = await getOrEnrichImdbRating(
				c.id,
				c.imdbId,
				c.imdbRating,
				c.imdbVoteCount
			);

			return {
				...c,
				imdbRating,
				imdbVoteCount
			};
		})
	);

	return enrichedCandidates;
}

async function executeCandidateQuery({
	filters,
	excludeIds,
	limit
}: {
	filters: PickerFilters;
	excludeIds: string[];
	limit: number;
}): Promise<PickerCandidate[]> {
	try {
		const conditions = [
			eq(movies.adult, false),
			sql`${movies.posterPath} IS NOT NULL`,
			sql`${movies.overview} IS NOT NULL`,
			sql`LENGTH(${movies.overview}) > 20`,
			sql`${movies.runtime} IS NOT NULL AND ${movies.runtime} >= 40`
		];

		// Release Year filters
		if (filters.minYear) {
			conditions.push(gte(movies.releaseDate, `${filters.minYear}-01-01`));
		}
		if (filters.maxYear) {
			conditions.push(lte(movies.releaseDate, `${filters.maxYear}-12-31`));
		}

		// Rating filter (either IMDb or TMDB meets the threshold)
		if (filters.minRating) {
			const minRatingStr = filters.minRating.toFixed(1);
			conditions.push(
				or(gte(movies.voteAverage, minRatingStr), gte(movies.imdbRating, minRatingStr))!
			);
		}

		// Vote count filter (minimum confidence)
		const minVotes = filters.minVotes ?? PICKER_DEFAULTS.minTmdbVotes;
		conditions.push(or(gte(movies.voteCount, minVotes), gte(movies.imdbVoteCount, minVotes))!);

		// Runtime filter
		if (filters.maxRuntime) {
			conditions.push(lte(movies.runtime, filters.maxRuntime));
		}

		// Hard exclusions (watched, disliked, session shown)
		if (excludeIds.length > 0) {
			// Chunk exclusions if very large to prevent huge IN clauses
			const slice = excludeIds.slice(0, 500);
			conditions.push(notInArray(movies.id, slice));
		}

		// Query movies with relations
		const results = await db.query.movies.findMany({
			where: and(...conditions),
			orderBy: [desc(movies.voteAverage), desc(movies.popularity)],
			limit: limit * 2,
			with: {
				genres: {
					with: {
						genre: true
					}
				},
				crew: {
					limit: 5,
					with: {
						person: true
					}
				},
				cast: {
					limit: 5,
					with: {
						person: true
					}
				}
			}
		});

		// Map to PickerCandidate and apply genre filtering if specific genres requested
		const requestedGenresLower = filters.genres?.map((g) => g.toLowerCase());

		const mapped: PickerCandidate[] = [];

		for (const m of results) {
			const movieGenresList = (m.genres || [])
				.map((g: any) => g.genre?.name)
				.filter(Boolean) as string[];

			if (requestedGenresLower && requestedGenresLower.length > 0) {
				const hasMatchingGenre = movieGenresList.some((mg) =>
					requestedGenresLower.includes(mg.toLowerCase())
				);
				if (!hasMatchingGenre) {
					continue;
				}
			}

			// Extract director
			let director: string | null = null;
			for (const c of m.crew || []) {
				if (c.job === 'Director' && c.person?.name) {
					director = c.person.name;
					break;
				}
			}

			// Extract top cast
			const castList = (m.cast || [])
				.map((c: any) => c.person?.name)
				.filter(Boolean)
				.slice(0, 3) as string[];

			mapped.push({
				id: m.id,
				tmdbId: m.tmdbId,
				imdbId: m.imdbId,
				title: m.title,
				originalTitle: m.originalTitle,
				originalLanguage: m.originalLanguage,
				overview: m.overview,
				tagline: m.tagline,
				posterPath: m.posterPath,
				backdropPath: m.backdropPath,
				releaseDate: m.releaseDate,
				runtime: m.runtime,
				popularity: parseFloat(String(m.popularity || '0')),
				voteAverage: parseFloat(String(m.voteAverage || '0')),
				voteCount: m.voteCount || 0,
				imdbRating: m.imdbRating ? parseFloat(String(m.imdbRating)) : null,
				imdbVoteCount: m.imdbVoteCount,
				adult: m.adult,
				genres: movieGenresList,
				director,
				cast: castList
			});

			if (mapped.length >= limit) {
				break;
			}
		}

		return mapped;
	} catch (err) {
		console.error('Candidate query error:', err);
		return [];
	}
}
