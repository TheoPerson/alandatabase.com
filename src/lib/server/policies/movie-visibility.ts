import { and, eq, getTableName, gt, sql } from 'drizzle-orm';
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
const keywordTable = sql.identifier(getTableName(movieKeywords));
const keywordMovieId = sql`${keywordTable}.${sql.identifier(movieKeywords.movieId.name)}`;
const keywordId = sql`${keywordTable}.${sql.identifier(movieKeywords.keywordId.name)}`;
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
		// Keep the parentheses in this SQL fragment. Passing a raw SELECT to
		// Drizzle's notExists() currently serializes as `not exists select ...`,
		// which PostgreSQL rejects and makes every standard catalogue read fail.
		//
		// The subquery refers to movie_keywords by identifier, not by Drizzle column
		// objects: the relational builder (`db.query.movies.findMany`) re-aliases
		// every column in a raw `where` to the root table, which turned
		// `movie_keywords.movie_id` into the non-existent `movies.movie_id`.
		sql`not exists (
			select 1
			from ${keywordTable}
			where ${keywordMovieId} = ${movies.id}
				and ${keywordId} in (${explicitKeywordSql})
		)`
	);
}
