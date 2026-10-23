import { and, eq, getTableName, gt, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Shared standard-content policy for every TMDB-backed catalogue table (movies, TV shows).
 * A row is standard only when TMDB classified it as non-adult, it carries a real (positive)
 * TMDB id, and none of its keywords is a known explicit-ingestion keyword. Anything else
 * fails closed and stays off browse, search, detail, artwork and recommendation surfaces.
 */
export const KNOWN_EXPLICIT_KEYWORD_IDS = [256466, 267122, 738] as const;

export type KeywordReference =
	| number
	| {
			id?: number | null;
			keywordId?: number | null;
			keyword?: { id?: number | null } | null;
	  };

export interface StandardContentCandidate {
	adult?: boolean | null;
	tmdbId?: number | null;
	keywords?: KeywordReference[] | null;
}

export interface StandardContentRecord extends StandardContentCandidate {
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
	if (!reference || typeof reference !== 'object') return null;
	if (typeof reference.keywordId === 'number') return reference.keywordId;
	if (typeof reference.id === 'number') return reference.id;
	if (typeof reference.keyword?.id === 'number') return reference.keyword.id;
	return null;
}

/** In-memory check: fails closed when the adult flag or the keyword classification is missing. */
export function isStandardContent(record: unknown): record is StandardContentRecord {
	if (!record || typeof record !== 'object') return false;

	const candidate = record as StandardContentCandidate;
	if (candidate.adult !== false) return false;
	if (typeof candidate.tmdbId !== 'number' || candidate.tmdbId <= 0) return false;
	if (!Array.isArray(candidate.keywords)) return false;

	return !candidate.keywords.some((reference) => {
		const keywordId = getKeywordId(reference);
		return keywordId !== null && knownExplicitKeywordIds.has(keywordId);
	});
}

/** The catalogue table and its keyword junction, as the database predicate needs them. */
export interface StandardContentTables {
	/** Root table columns. */
	id: AnyPgColumn;
	adult: AnyPgColumn;
	tmdbId: AnyPgColumn;
	/** Keyword junction table and its columns (owner row id, TMDB keyword id). */
	keywordTable: PgTable;
	keywordOwnerId: AnyPgColumn;
	keywordId: AnyPgColumn;
}

/**
 * Database predicate matching {@link isStandardContent} for one catalogue table.
 *
 * Keep the parentheses in the SQL fragment: passing a raw SELECT to Drizzle's notExists()
 * serializes as `not exists select ...`, which PostgreSQL rejects. The subquery names the
 * junction table by identifier, not through Drizzle column objects, because the relational
 * builder (`db.query.<table>.findMany`) re-aliases every column in a raw `where` to the root
 * table (it turned `movie_keywords.movie_id` into the non-existent `movies.movie_id`).
 */
export function standardContentVisibilityWhere(tables: StandardContentTables) {
	const keywordTable = sql.identifier(getTableName(tables.keywordTable));
	const keywordOwnerId = sql`${keywordTable}.${sql.identifier(tables.keywordOwnerId.name)}`;
	const keywordId = sql`${keywordTable}.${sql.identifier(tables.keywordId.name)}`;

	return and(
		eq(tables.adult, false),
		gt(tables.tmdbId, 0),
		sql`not exists (
			select 1
			from ${keywordTable}
			where ${keywordOwnerId} = ${tables.id}
				and ${keywordId} in (${explicitKeywordSql})
		)`
	);
}
