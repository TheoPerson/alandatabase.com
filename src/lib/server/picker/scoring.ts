import { BAYESIAN_PARAMS, MODE_WEIGHTS, PENALTIES } from './config';
import type {
	CandidateScoreBreakdown,
	PickerCandidate,
	RecommendationMode,
	ScoredCandidate,
	UserTasteProfile
} from './types';

interface ScoringContext {
	tasteProfile: UserTasteProfile;
	mode: RecommendationMode;
	recentDirectorsShown?: string[];
	recentPrimaryGenresShown?: string[];
}

export function scoreCandidate(
	candidate: PickerCandidate,
	context: ScoringContext
): ScoredCandidate {
	const { tasteProfile, mode, recentDirectorsShown = [], recentPrimaryGenresShown = [] } = context;
	const matchedSignals: string[] = [];

	// 1. Quality Score (Bayesian Confidence-aware)
	const qualityScore = calculateQualityScore(candidate, matchedSignals);

	// 2. Personal Taste Score
	const tasteScore = calculateTasteScore(candidate, tasteProfile, matchedSignals);

	// 3. Discovery Score
	const discoveryScore = calculateDiscoveryScore(candidate, matchedSignals);

	// 4. Freshness Score (0 - 20)
	const freshnessScore = calculateFreshnessScore(candidate);

	// 5. Diversity & Skip Penalties
	let diversityPenalty = 0;
	if (candidate.director && recentDirectorsShown.includes(candidate.director.toLowerCase())) {
		diversityPenalty += PENALTIES.sameDirectorSession;
	}
	const primaryGenre = candidate.genres[0];
	if (primaryGenre && recentPrimaryGenresShown.includes(primaryGenre.toLowerCase())) {
		diversityPenalty += PENALTIES.samePrimaryGenreConsecutive;
	}

	let skipPenalty = 0;
	if (tasteProfile.recentSkippedMovieIds.has(candidate.id)) {
		skipPenalty += PENALTIES.recentNotTonightSkip;
	}

	// 6. Combine weighted scores
	const weights = MODE_WEIGHTS[mode];
	const rawScore =
		qualityScore * weights.quality +
		tasteScore * weights.taste +
		discoveryScore * weights.discovery +
		freshnessScore * weights.freshness;

	const finalScore = Math.max(0, Math.round((rawScore - diversityPenalty - skipPenalty) * 10) / 10);

	const breakdown: CandidateScoreBreakdown = {
		qualityScore,
		tasteScore,
		discoveryScore,
		freshnessScore,
		diversityPenalty,
		skipPenalty,
		finalScore,
		matchedSignals
	};

	const resolvedMode: 'safe' | 'discovery' =
		mode === 'discovery'
			? 'discovery'
			: mode === 'safe'
				? 'safe'
				: discoveryScore > 65 && qualityScore >= 70
					? 'discovery'
					: 'safe';

	return {
		candidate,
		breakdown,
		mode: resolvedMode
	};
}

/**
 * Calculates Bayesian confidence rating:
 * WR = (v / (v + m)) * R + (m / (v + m)) * C
 */
export function calculateQualityScore(candidate: PickerCandidate, signals: string[]): number {
	let r: number;
	let v: number;
	let m: number;
	let c: number;
	let hasImdb = false;

	if (candidate.imdbRating !== null && candidate.imdbRating > 0) {
		r = candidate.imdbRating;
		v = candidate.imdbVoteCount ?? BAYESIAN_PARAMS.imdbMinVotes;
		m = BAYESIAN_PARAMS.imdbMinVotes;
		c = BAYESIAN_PARAMS.imdbGlobalBenchmark;
		hasImdb = true;
	} else {
		r = candidate.voteAverage;
		v = candidate.voteCount;
		m = BAYESIAN_PARAMS.tmdbMinVotes;
		c = BAYESIAN_PARAMS.tmdbGlobalBenchmark;
	}

	// Bayesian weighted rating
	const weightedRating = (v / (v + m)) * r + (m / (v + m)) * c;

	if (hasImdb) {
		signals.push(`High IMDb Confidence: ${candidate.imdbRating}★ (${formatVoteVolume(v)} votes)`);
	} else if (weightedRating >= 7.8) {
		signals.push(`Critically Acclaimed: ${candidate.voteAverage.toFixed(1)}★ rating`);
	}

	// Normalize into 0 - 100 scale (range 5.5 to 9.2 mapped to 0 to 100)
	const normalized = ((weightedRating - 5.5) / 3.7) * 100;
	return Math.min(100, Math.max(0, Math.round(normalized * 10) / 10));
}

export function calculateTasteScore(
	candidate: PickerCandidate,
	profile: UserTasteProfile,
	signals: string[]
): number {
	let score = 0;

	// Genre match (up to 50 points)
	if (candidate.genres.length > 0) {
		let totalGenreAffinity = 0;
		const matchedGenreNames: string[] = [];

		for (const g of candidate.genres) {
			const affinity = profile.genreWeights[g] || 0.1;
			totalGenreAffinity += affinity;
			if (affinity >= 0.7) {
				matchedGenreNames.push(g);
			}
		}

		const avgAffinity = totalGenreAffinity / candidate.genres.length;
		score += avgAffinity * 50;

		if (matchedGenreNames.length > 0) {
			signals.push(`Matches your favorite genre: ${matchedGenreNames.join(', ')}`);
		}
	} else {
		score += 25; // neutral
	}

	// Director affinity (up to 30 points)
	if (candidate.director && profile.favoriteDirectors.has(candidate.director.toLowerCase())) {
		score += 30;
		signals.push(`Directed by favorite auteur: ${candidate.director}`);
	}

	// Era / Decade affinity (up to 15 points)
	if (candidate.releaseDate) {
		const year = new Date(candidate.releaseDate).getFullYear();
		if (!isNaN(year)) {
			const decade = `${Math.floor(year / 10) * 10}s`;
			if (profile.preferredDecades[decade] && profile.preferredDecades[decade] >= 2) {
				score += 15;
				signals.push(`Matches your preferred cinema era: ${decade}`);
			}
		}
	}

	// Runtime fit (up to 5 points)
	if (candidate.runtime && Math.abs(candidate.runtime - profile.avgRuntime) <= 25) {
		score += 5;
	}

	return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
}

export function calculateDiscoveryScore(candidate: PickerCandidate, signals: string[]): number {
	let score = 0;
	const effectiveRating = candidate.imdbRating ?? candidate.voteAverage;
	const effectiveVotes = candidate.imdbVoteCount ?? candidate.voteCount;

	// High quality with moderate votes = Hidden Gem
	if (effectiveRating >= 7.6) {
		if (effectiveVotes >= 1500 && effectiveVotes <= 120000) {
			score += 50;
			signals.push('Hidden Gem: high critical reception with under-the-radar viewership');
		} else if (effectiveVotes <= 350000) {
			score += 30;
		}
	}

	// Foreign language masterwork
	if (candidate.originalLanguage && candidate.originalLanguage !== 'en' && effectiveRating >= 7.8) {
		score += 35;
		signals.push(`Acclaimed International Cinema (${candidate.originalLanguage.toUpperCase()})`);
	}

	// Unique runtime or indie profile
	if (candidate.popularity >= 8 && candidate.popularity <= 45 && effectiveRating >= 7.5) {
		score += 15;
	}

	return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateFreshnessScore(candidate: PickerCandidate): number {
	if (!candidate.releaseDate) return 5;
	const year = new Date(candidate.releaseDate).getFullYear();
	if (isNaN(year)) return 5;

	// Slight boost for recent high-quality titles without dominating
	if (year >= 2020) return 18;
	if (year >= 2010) return 14;
	if (year >= 2000) return 10;
	return 8;
}

function formatVoteVolume(count: number): string {
	if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
	if (count >= 1000) return `${Math.round(count / 1000)}k`;
	return String(count);
}
