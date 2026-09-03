import type { PickerFilters, PickerPreset, RecommendationMode } from './types';

export const PICKER_DEFAULTS = {
	minYear: 1990,
	minImdbRating: 7.0,
	minImdbVotes: 8000,
	minTmdbVotes: 1000,
	excludeWatched: true,
	excludeDisliked: true,
	includeAdult: false,
	candidatePoolSize: 120,
	topTierSize: 20
} as const;

export const BAYESIAN_PARAMS = {
	imdbMinVotes: 5000,
	imdbGlobalBenchmark: 7.0,
	tmdbMinVotes: 1200,
	tmdbGlobalBenchmark: 6.8
} as const;

export interface ModeWeights {
	quality: number;
	taste: number;
	discovery: number;
	freshness: number;
}

export const MODE_WEIGHTS: Record<RecommendationMode, ModeWeights> = {
	safe: {
		quality: 0.45,
		taste: 0.4,
		discovery: 0.1,
		freshness: 0.05
	},
	discovery: {
		quality: 0.25,
		taste: 0.2,
		discovery: 0.5,
		freshness: 0.05
	},
	balanced: {
		quality: 0.38,
		taste: 0.34,
		discovery: 0.23,
		freshness: 0.05
	}
};

export const QUICK_PRESETS: Record<PickerPreset, Partial<PickerFilters>> = {
	TONIGHT: {
		era: '1990+',
		minYear: 1990,
		minRating: 7.0,
		mode: 'balanced'
	},
	CLASSIC: {
		era: 'classic',
		minYear: 1950,
		maxYear: 1989,
		minRating: 7.5,
		mode: 'safe'
	},
	CRIME: {
		genres: ['Crime', 'Mystery'],
		minYear: 1980,
		minRating: 7.2,
		mode: 'balanced'
	},
	THRILLER: {
		genres: ['Thriller', 'Mystery'],
		minYear: 1990,
		minRating: 7.2,
		mode: 'balanced'
	},
	HIDDEN_GEM: {
		minYear: 1985,
		minRating: 7.4,
		mode: 'discovery'
	},
	HIGHLY_RATED: {
		minRating: 8.0,
		mode: 'safe'
	},
	SHORT: {
		maxRuntime: 110,
		minRating: 7.0,
		mode: 'balanced'
	}
};

export const SELECTION_TIERS = {
	topTierRatio: 0.65, // Ranks 1-3
	midTierRatio: 0.25, // Ranks 4-8
	discoveryTierRatio: 0.1 // Ranks 9-20
} as const;

export const PENALTIES = {
	sameDirectorSession: 30,
	samePrimaryGenreConsecutive: 12,
	recentNotTonightSkip: 45
} as const;
