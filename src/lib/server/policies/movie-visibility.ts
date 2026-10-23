import { movieKeywords, movies } from '../db/schema.js';
import {
	isStandardContent,
	KNOWN_EXPLICIT_KEYWORD_IDS,
	standardContentVisibilityWhere,
	type KeywordReference
} from './standard-content.js';

export { KNOWN_EXPLICIT_KEYWORD_IDS };

export interface MovieVisibilityRecord {
	adult?: boolean | null;
	tmdbId?: number | null;
	keywords?: KeywordReference[] | null;
}

export interface StandardMovieRecord extends MovieVisibilityRecord {
	adult: false;
	tmdbId: number;
}

/**
 * Standard cinema surfaces fail closed for TMDB-adult rows, all custom
 * pseudo-TMDB rows, and rows tagged by the known explicit-ingestion keywords.
 */
export function isStandardMovie(movie: unknown): movie is StandardMovieRecord {
	return isStandardContent(movie);
}

/**
 * Database predicate matching {@link isStandardMovie}. Keep this centralized
 * so new movie reads do not accidentally omit one of the quarantine rules.
 */
export function standardMovieVisibilityWhere() {
	return standardContentVisibilityWhere({
		id: movies.id,
		adult: movies.adult,
		tmdbId: movies.tmdbId,
		keywordTable: movieKeywords,
		keywordOwnerId: movieKeywords.movieId,
		keywordId: movieKeywords.keywordId
	});
}
