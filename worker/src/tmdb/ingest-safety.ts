export const BLOCKED_TMDB_KEYWORD_IDS: ReadonlySet<number> = new Set([256466, 267122, 738]);

type KeywordCandidate = {
	id?: number | null;
};

export type TMDBIngestionCandidate = {
	adult?: boolean | null;
	keywords?: {
		keywords?: Array<KeywordCandidate | null> | null;
	} | null;
};

export type TMDBIngestionSafetyDecision =
	| { allowed: true }
	| {
			allowed: false;
			reason:
				| 'adult-flagged'
				| 'adult-classification-missing'
				| 'keyword-classification-missing'
				| 'explicit-keyword';
			keywordId?: number;
	  };

export function evaluateTMDBIngestionSafety(
	candidate: TMDBIngestionCandidate
): TMDBIngestionSafetyDecision {
	if (candidate.adult === true) {
		return { allowed: false, reason: 'adult-flagged' };
	}

	if (candidate.adult !== false) {
		return { allowed: false, reason: 'adult-classification-missing' };
	}

	const keywords = candidate.keywords?.keywords;
	if (!Array.isArray(keywords)) {
		return { allowed: false, reason: 'keyword-classification-missing' };
	}

	for (const keyword of keywords) {
		const keywordId = keyword?.id;
		if (typeof keywordId !== 'number' || !Number.isInteger(keywordId)) {
			return { allowed: false, reason: 'keyword-classification-missing' };
		}

		if (BLOCKED_TMDB_KEYWORD_IDS.has(keywordId)) {
			return { allowed: false, reason: 'explicit-keyword', keywordId };
		}
	}

	return { allowed: true };
}
