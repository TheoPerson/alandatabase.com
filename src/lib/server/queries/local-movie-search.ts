import { and, desc, ilike, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import {
	isStandardMovie,
	standardMovieVisibilityWhere
} from '$lib/server/policies/movie-visibility';
import { MAX_SEARCH_QUERY_LENGTH } from '$lib/server/security/request-bounds';

const MAX_LOCAL_SEARCH_RESULTS = 30;
const OVERRIDABLE_TEXT_FIELDS = ['title', 'originalTitle', 'releaseDate', 'overview'] as const;

type MovieWithOverrides = {
	localOverrides?: unknown;
	keywords?: unknown;
};

export function applyStoredMovieOverrides<T extends MovieWithOverrides>(movie: T): T {
	const resolved: Record<string, unknown> = { ...movie };
	if (
		movie.localOverrides &&
		typeof movie.localOverrides === 'object' &&
		!Array.isArray(movie.localOverrides)
	) {
		const overrides = movie.localOverrides as Record<string, unknown>;

		for (const field of OVERRIDABLE_TEXT_FIELDS) {
			if (typeof overrides[field] === 'string' && overrides[field].length > 0) {
				resolved[field] = overrides[field];
			}
		}
	}
	delete resolved.localOverrides;

	return resolved as T;
}

export function prepareStandardMovies<T extends MovieWithOverrides>(movieRecords: T[]): T[] {
	const visibleMovies: T[] = [];

	for (const movie of movieRecords) {
		if (!isStandardMovie(movie)) continue;

		const visibleMovie: T = { ...movie };
		delete visibleMovie.keywords;
		visibleMovies.push(applyStoredMovieOverrides(visibleMovie));
	}

	return visibleMovies;
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/gu, '\\$&');
}

export async function searchLocalMovies(query: string, limit: number) {
	const normalizedQuery = query.trim();
	if (!normalizedQuery || normalizedQuery.length > MAX_SEARCH_QUERY_LENGTH) return [];

	const boundedLimit = Number.isSafeInteger(limit)
		? Math.min(Math.max(limit, 1), MAX_LOCAL_SEARCH_RESULTS)
		: 1;
	const pattern = `%${escapeLikePattern(normalizedQuery)}%`;

	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			or(
				ilike(movies.title, pattern),
				ilike(movies.originalTitle, pattern),
				ilike(sql`${movies.localOverrides}->>'title'`, pattern),
				ilike(sql`${movies.localOverrides}->>'originalTitle'`, pattern)
			)
		),
		orderBy: [desc(movies.popularity), desc(movies.id)],
		limit: boundedLimit,
		with: { keywords: true, genres: { with: { genre: true } } }
	});

	return prepareStandardMovies(results);
}
