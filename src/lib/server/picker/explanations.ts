import type { ScoredCandidate, UserTasteProfile } from './types';

export function generateRecommendationExplanation(
	scored: ScoredCandidate,
	profile: UserTasteProfile
): string {
	const { candidate, breakdown, mode } = scored;
	const genresStr = candidate.genres.slice(0, 2).join(' / ');

	// 1. Discovery mode explanations
	if (mode === 'discovery') {
		if (candidate.originalLanguage && candidate.originalLanguage !== 'en') {
			const lang = candidate.originalLanguage.toUpperCase();
			return `Acclaimed ${lang} cinema masterwork with exceptional critical reception and high viewer ratings.`;
		}
		if (breakdown.discoveryScore >= 40) {
			return `Discovery pick: high critical acclaim with under-the-radar viewership, perfect for a fresh experience.`;
		}
	}

	// 2. Director affinity match
	if (candidate.director && profile.favoriteDirectors.has(candidate.director.toLowerCase())) {
		return `Directed by ${candidate.director} + strong match with your personal cinema taste.`;
	}

	// 3. Strong taste match with specific genres
	const matchedHighAffinityGenres = candidate.genres.filter(
		(g) => (profile.genreWeights[g] || 0) >= 0.6
	);
	if (matchedHighAffinityGenres.length > 0) {
		const gNames = matchedHighAffinityGenres.slice(0, 2).join(' and ');
		if (candidate.imdbRating && candidate.imdbRating >= 8.0) {
			return `Strong match for your ${gNames} preferences + high IMDb confidence (${candidate.imdbRating.toFixed(1)}★).`;
		}
		return `Recommended because you frequently watch and favorite ${gNames} films.`;
	}

	// 4. High-confidence classic or era match
	if (candidate.releaseDate) {
		const year = new Date(candidate.releaseDate).getFullYear();
		if (!isNaN(year) && year < 1990 && breakdown.qualityScore >= 75) {
			return `High-confidence all-time classic (${year}) you haven't logged as watched yet.`;
		}
	}

	// 5. Standout IMDb rating
	if (candidate.imdbRating && candidate.imdbRating >= 8.3) {
		return `Top-tier IMDb score of ${candidate.imdbRating.toFixed(1)}★ with verified worldwide audience acclaim.`;
	}

	// 6. General high-quality pick
	if (genresStr) {
		return `Critically acclaimed ${genresStr} selected for high viewer confidence and narrative depth.`;
	}

	return `High-confidence recommendation selected for exceptional quality and tonight's viewing.`;
}
