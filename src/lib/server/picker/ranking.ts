import { SELECTION_TIERS } from './config';
import { scoreCandidate } from './scoring';
import type {
	PickerCandidate,
	RecommendationMode,
	ScoredCandidate,
	UserTasteProfile
} from './types';

interface RankerOptions {
	candidates: PickerCandidate[];
	tasteProfile: UserTasteProfile;
	mode?: RecommendationMode;
	recentDirectorsShown?: string[];
	recentPrimaryGenresShown?: string[];
}

export function rankAndSelectCandidate({
	candidates,
	tasteProfile,
	mode = 'balanced',
	recentDirectorsShown = [],
	recentPrimaryGenresShown = []
}: RankerOptions): ScoredCandidate | null {
	if (!candidates || candidates.length === 0) {
		return null;
	}

	// 1. Score every candidate
	const scored = candidates.map((c) =>
		scoreCandidate(c, {
			tasteProfile,
			mode,
			recentDirectorsShown,
			recentPrimaryGenresShown
		})
	);

	// 2. Sort descending by finalScore
	scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

	// If only 1 candidate available, return it directly
	if (scored.length === 1) {
		return scored[0];
	}

	// 3. Extract top tier (up to 20 items)
	const topPool = scored.slice(0, 20);

	// 4. Controlled probabilistic selection
	const roll = Math.random();

	// Tier 1: Rank 1-3 (very high probability ~65%)
	if (roll < SELECTION_TIERS.topTierRatio || topPool.length <= 3) {
		const topTier = topPool.slice(0, Math.min(3, topPool.length));
		return pickWeightedFromSlice(topTier);
	}

	// Tier 2: Rank 4-10 (moderate probability ~25%)
	if (roll < SELECTION_TIERS.topTierRatio + SELECTION_TIERS.midTierRatio || topPool.length <= 10) {
		const midTier = topPool.slice(3, Math.min(10, topPool.length));
		return pickWeightedFromSlice(midTier.length > 0 ? midTier : topPool);
	}

	// Tier 3: Rank 11-20 (discovery spark ~10%)
	const discoveryTier = topPool.slice(10, topPool.length);
	return pickWeightedFromSlice(discoveryTier.length > 0 ? discoveryTier : topPool);
}

/**
 * Picks an item from a tier slice, weighted slightly by finalScore
 */
function pickWeightedFromSlice(slice: ScoredCandidate[]): ScoredCandidate {
	if (slice.length === 1) return slice[0];

	const minScore = Math.min(...slice.map((s) => s.breakdown.finalScore));
	const offsetScores = slice.map((s) => Math.max(1, s.breakdown.finalScore - minScore + 5));
	const totalWeight = offsetScores.reduce((sum, w) => sum + w, 0);

	let randomPoint = Math.random() * totalWeight;
	for (let i = 0; i < slice.length; i++) {
		randomPoint -= offsetScores[i];
		if (randomPoint <= 0) {
			return slice[i];
		}
	}

	return slice[0];
}
