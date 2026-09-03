import { fetchCandidateMovies } from './candidate-query';
import { generateRecommendationExplanation } from './explanations';
import { rankAndSelectCandidate } from './ranking';
import { getUserTasteProfile } from './taste-profile';
import { logActivity } from '../services/interaction.service';
import { telemetryBus } from '../telemetry-bus';
import type {
	PickerEventPayload,
	PickerFilters,
	PickerRecommendationResponse,
	RecommendationMode
} from './types';

export * from './types';
export * from './config';

interface GetRecommendationParams {
	userId?: string | null;
	sessionId: string;
	filters?: PickerFilters;
	shownMovieIds?: string[];
	position?: number;
	recentDirectorsShown?: string[];
	recentPrimaryGenresShown?: string[];
}

export async function getPickerRecommendation({
	userId,
	sessionId,
	filters = {},
	shownMovieIds = [],
	position = 1,
	recentDirectorsShown = [],
	recentPrimaryGenresShown = []
}: GetRecommendationParams): Promise<PickerRecommendationResponse | null> {
	const startTime = performance.now();

	// 1. Build taste profile from real user interactions
	const tasteProfile = await getUserTasteProfile(userId);

	// 2. Fetch candidates with hard exclusions applied
	const candidates = await fetchCandidateMovies({
		filters,
		tasteProfile,
		shownMovieIds
	});

	if (!candidates || candidates.length === 0) {
		return null;
	}

	// 3. Resolve mode
	const mode: RecommendationMode = filters.mode || 'balanced';

	// 4. Rank and probabilistically select top candidate
	const selected = rankAndSelectCandidate({
		candidates,
		tasteProfile,
		mode,
		recentDirectorsShown,
		recentPrimaryGenresShown
	});

	if (!selected) {
		return null;
	}

	// 5. Generate deterministic explanation
	const reason = generateRecommendationExplanation(selected, tasteProfile);

	const durationMs = Math.round(performance.now() - startTime);

	// 6. Emit real-time telemetry
	telemetryBus.emit({
		level: 'SUCCESS',
		source: 'MOVIE_PICKER',
		message: `Movie Picker recommended "${selected.candidate.title}" in ${durationMs}ms [${selected.mode.toUpperCase()}] (Score: ${selected.breakdown.finalScore})`,
		metadata: {
			movieId: selected.candidate.id,
			title: selected.candidate.title,
			sessionId,
			position,
			durationMs,
			mode: selected.mode
		}
	});

	// Record initial recommendation event in activities
	if (userId) {
		logActivity(userId, 'picker_recommendation', selected.candidate.id, undefined, {
			sessionId,
			position,
			mode: selected.mode,
			score: selected.breakdown.finalScore
		}).catch(() => {});
	}

	return {
		movie: {
			id: selected.candidate.id,
			tmdbId: selected.candidate.tmdbId,
			imdbId: selected.candidate.imdbId,
			title: selected.candidate.title,
			originalTitle: selected.candidate.originalTitle,
			overview: selected.candidate.overview,
			releaseDate: selected.candidate.releaseDate,
			runtime: selected.candidate.runtime,
			genres: selected.candidate.genres,
			posterPath: selected.candidate.posterPath,
			backdropPath: selected.candidate.backdropPath,
			imdbRating: selected.candidate.imdbRating,
			imdbVoteCount: selected.candidate.imdbVoteCount,
			tmdbRating: selected.candidate.voteAverage,
			tmdbVoteCount: selected.candidate.voteCount,
			director: selected.candidate.director,
			topCast: selected.candidate.cast
		},
		reason,
		sessionId,
		mode: selected.mode,
		position,
		signals: {
			imdbRating: selected.candidate.imdbRating,
			tmdbRating: selected.candidate.voteAverage,
			tasteMatchScore: selected.breakdown.tasteScore,
			qualityScore: selected.breakdown.qualityScore,
			finalScore: selected.breakdown.finalScore
		}
	};
}

export async function recordPickerEvent(
	userId: string | null | undefined,
	payload: PickerEventPayload
) {
	const actionType = `picker_${payload.action}`;

	// Emit to SSE telemetry bus
	telemetryBus.emit({
		level: payload.action === 'not_tonight' ? 'WARN' : 'INFO',
		source: 'MOVIE_PICKER',
		message: `User action: ${payload.action} on movie ${payload.movieId} (Session: ${payload.sessionId.slice(0, 8)})`,
		metadata: payload
	});

	// Persist to user activity diary if logged in
	if (userId) {
		await logActivity(userId, actionType, payload.movieId, undefined, {
			sessionId: payload.sessionId,
			position: payload.position,
			score: payload.score,
			...(payload.metadata || {})
		});
	}
}
