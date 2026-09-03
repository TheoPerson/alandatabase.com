export type RecommendationMode = 'safe' | 'discovery' | 'balanced';

export type PickerPreset =
	'TONIGHT' | 'CLASSIC' | 'CRIME' | 'THRILLER' | 'HIDDEN_GEM' | 'HIGHLY_RATED' | 'SHORT';

export interface PickerFilters {
	preset?: PickerPreset;
	era?: '1990+' | '2000+' | '2010+' | '2020+' | 'classic' | 'all';
	minYear?: number;
	maxYear?: number;
	minRating?: number;
	minVotes?: number;
	maxRuntime?: number;
	genres?: string[];
	mode?: RecommendationMode;
	excludeWatched?: boolean;
	excludeDisliked?: boolean;
}

export interface PickerCandidate {
	id: string;
	tmdbId: number;
	imdbId: string | null;
	title: string;
	originalTitle: string | null;
	originalLanguage: string | null;
	overview: string | null;
	tagline: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	runtime: number | null;
	popularity: number;
	voteAverage: number;
	voteCount: number;
	imdbRating: number | null;
	imdbVoteCount: number | null;
	adult: boolean;
	genres: string[];
	director: string | null;
	cast: string[];
}

export interface UserTasteProfile {
	genreWeights: Record<string, number>; // Genre name -> affinity score (0.0 to 1.0)
	topGenres: string[];
	favoriteDirectors: Set<string>;
	preferredDecades: Record<string, number>; // e.g. "1990s" -> count
	avgRuntime: number;
	totalLogged: number;
	watchedMovieIds: Set<string>;
	dislikedMovieIds: Set<string>; // rating <= 2.0 or multiple skips
	favoriteMovieIds: Set<string>;
	watchlistMovieIds: Set<string>;
	recentSkippedMovieIds: Set<string>;
}

export interface CandidateScoreBreakdown {
	qualityScore: number; // 0 - 100
	tasteScore: number; // 0 - 100
	discoveryScore: number; // 0 - 100
	freshnessScore: number; // 0 - 20
	diversityPenalty: number; // 0 - 40
	skipPenalty: number; // 0 - 50
	finalScore: number; // Combined weighted score
	matchedSignals: string[];
}

export interface ScoredCandidate {
	candidate: PickerCandidate;
	breakdown: CandidateScoreBreakdown;
	mode: 'safe' | 'discovery';
}

export interface PickerRecommendationResponse {
	movie: {
		id: string;
		tmdbId: number;
		imdbId: string | null;
		title: string;
		originalTitle: string | null;
		overview: string | null;
		releaseDate: string | null;
		runtime: number | null;
		genres: string[];
		posterPath: string | null;
		backdropPath: string | null;
		imdbRating: number | null;
		imdbVoteCount: number | null;
		tmdbRating: number;
		tmdbVoteCount: number;
		director: string | null;
		topCast: string[];
	};
	reason: string;
	sessionId: string;
	mode: 'safe' | 'discovery';
	position: number;
	signals: {
		imdbRating: number | null;
		tmdbRating: number;
		tasteMatchScore: number;
		qualityScore: number;
		finalScore: number;
	};
}

export type PickerActionType =
	'impression' | 'another' | 'not_tonight' | 'open' | 'watch' | 'favorite' | 'watchlist' | 'rating';

export interface PickerEventPayload {
	sessionId: string;
	movieId: string;
	action: PickerActionType;
	position?: number;
	score?: number;
	metadata?: Record<string, any>;
}
