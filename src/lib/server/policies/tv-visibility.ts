import { tvKeywords, tvShows } from '../db/schema.js';
import {
	isStandardContent,
	standardContentVisibilityWhere,
	type KeywordReference
} from './standard-content.js';

export interface TvShowVisibilityRecord {
	adult?: boolean | null;
	tmdbId?: number | null;
	keywords?: KeywordReference[] | null;
}

export interface StandardTvShowRecord extends TvShowVisibilityRecord {
	adult: false;
	tmdbId: number;
}

/**
 * TV shows follow the movie policy exactly: TMDB-adult rows, custom pseudo-TMDB rows and rows
 * tagged with a known explicit keyword never reach a standard surface; a show whose keywords
 * were not loaded fails closed.
 */
export function isStandardTvShow(show: unknown): show is StandardTvShowRecord {
	return isStandardContent(show);
}

/** Database predicate matching {@link isStandardTvShow} over tv_shows + tv_keywords. */
export function standardTvShowVisibilityWhere() {
	return standardContentVisibilityWhere({
		id: tvShows.id,
		adult: tvShows.adult,
		tmdbId: tvShows.tmdbId,
		keywordTable: tvKeywords,
		keywordOwnerId: tvKeywords.showId,
		keywordId: tvKeywords.keywordId
	});
}
