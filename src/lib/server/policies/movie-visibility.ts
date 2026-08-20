import { and, eq, gt, notExists, sql } from 'drizzle-orm';
import { movieKeywords, movies } from '../db/schema.js';

export const KNOWN_EXPLICIT_KEYWORD_IDS = [256466, 267122, 738] as const;

type KeywordReference =
	| number
	| {
			id?: number | null;
			keywordId?: number | null;
			keyword?: { id?: number | null } | null;
	  };

export interface MovieVisibilityRecord {
	adult?: boolean | null;
	tmdbId?: number | null;
	keywords?: KeywordReference[] | null;
}

export interface StandardMovieRecord extends MovieVisibilityRecord {
	adult: false;
	tmdbId: number;
}

const knownExplicitKeywordIds = new Set<number>(KNOWN_EXPLICIT_KEYWORD_IDS);
const explicitKeywordSql = sql.join(
	KNOWN_EXPLICIT_KEYWORD_IDS.map((keywordId) => sql`${keywordId}`),
	sql`, `
);

function getKeywordId(reference: KeywordReference): number | null {
	if (typeof reference === 'number') return reference;
	if (typeof reference.keywordId === 'number') return reference.keywordId;
	if (typeof reference.id === 'number') return reference.id;
	if (typeof reference.keyword?.id === 'number') return reference.keyword.id;
	return null;
}

/**
 * Standard cinema surfaces fail closed for TMDB-adult rows, all custom
 * pseudo-TMDB rows, and rows tagged by the known explicit-ingestion keywords.
 */
export function isStandardMovie(movie: unknown): movie is StandardMovieRecord {
	if (!movie || typeof movie !== 'object') return false;

	const candidate = movie as MovieVisibilityRecord;
	if (candidate.adult !== false) return false;
	if (typeof candidate.tmdbId !== 'number' || candidate.tmdbId <= 0) return false;
	if (!Array.isArray(candidate.keywords)) return false;

	return !candidate.keywords.some((reference) => {
		const keywordId = getKeywordId(reference);
		return keywordId !== null && knownExplicitKeywordIds.has(keywordId);
	});
}

/**
 * Database predicate matching {@link isStandardMovie}. Keep this centralized
 * so new movie reads do not accidentally omit one of the quarantine rules.
 */
export function standardMovieVisibilityWhere() {
	return and(
		eq(movies.adult, false),
		gt(movies.tmdbId, 0),
		notExists(sql`
			select 1
			from ${movieKeywords}
			where ${movieKeywords.movieId} = ${movies.id}
				and ${movieKeywords.keywordId} in (${explicitKeywordSql})
		`)
	);
}
