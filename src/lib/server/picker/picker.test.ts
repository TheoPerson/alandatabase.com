import { describe, it, expect } from 'vitest';
import {
	calculateQualityScore,
	calculateTasteScore,
	calculateDiscoveryScore,
	scoreCandidate
} from './scoring';
import { rankAndSelectCandidate } from './ranking';
import { generateRecommendationExplanation } from './explanations';
import type { PickerCandidate, UserTasteProfile } from './types';

function createMockCandidate(overrides: Partial<PickerCandidate> = {}): PickerCandidate {
	return {
		id: 'movie-uuid-1',
		tmdbId: 101,
		imdbId: 'tt0111161',
		title: 'The Great Cinema',
		originalTitle: 'The Great Cinema',
		originalLanguage: 'en',
		overview: 'An unforgettable cinematic masterpiece about life and choices.',
		tagline: 'Witness greatness.',
		posterPath: '/great-cinema.jpg',
		backdropPath: '/great-cinema-backdrop.jpg',
		releaseDate: '2005-06-15',
		runtime: 125,
		popularity: 45.5,
		voteAverage: 8.2,
		voteCount: 15000,
		imdbRating: 8.5,
		imdbVoteCount: 500000,
		adult: false,
		genres: ['Crime', 'Thriller'],
		director: 'Martin Scorsese',
		cast: ['Robert De Niro', 'Al Pacino'],
		...overrides
	};
}

function createMockTasteProfile(overrides: Partial<UserTasteProfile> = {}): UserTasteProfile {
	return {
		genreWeights: {
			Crime: 1.0,
			Thriller: 0.9,
			Drama: 0.8,
			Comedy: 0.2
		},
		topGenres: ['Crime', 'Thriller', 'Drama'],
		favoriteDirectors: new Set(['martin scorsese', 'christopher nolan']),
		preferredDecades: { '2000s': 10, '1990s': 8 },
		avgRuntime: 130,
		totalLogged: 25,
		watchedMovieIds: new Set(['watched-uuid-1', 'watched-uuid-2']),
		dislikedMovieIds: new Set(['disliked-uuid-1']),
		favoriteMovieIds: new Set(['fav-uuid-1']),
		watchlistMovieIds: new Set(['wl-uuid-1']),
		recentSkippedMovieIds: new Set(['skipped-uuid-1']),
		...overrides
	};
}

describe('Movie Picker Engine — Quality Scoring & Bayesian Confidence', () => {
	it('should score high-vote movies higher than low-vote movies with same raw rating', () => {
		const highVotes = createMockCandidate({
			imdbRating: 8.5,
			imdbVoteCount: 600000
		});
		const lowVotes = createMockCandidate({
			imdbRating: 8.5,
			imdbVoteCount: 400
		});

		const scoreHigh = calculateQualityScore(highVotes, []);
		const scoreLow = calculateQualityScore(lowVotes, []);

		expect(scoreHigh).toBeGreaterThan(scoreLow);
	});

	it('should prefer an IMDb 8.5 movie with 800k votes over an IMDb 9.0 movie with only 200 votes', () => {
		const verifiedClassic = createMockCandidate({
			imdbRating: 8.5,
			imdbVoteCount: 800000
		});
		const unverifiedNiche = createMockCandidate({
			imdbRating: 9.0,
			imdbVoteCount: 200
		});

		const scoreClassic = calculateQualityScore(verifiedClassic, []);
		const scoreNiche = calculateQualityScore(unverifiedNiche, []);

		expect(scoreClassic).toBeGreaterThan(scoreNiche);
	});

	it('should correctly normalize quality scores between 0 and 100', () => {
		const masterpiece = createMockCandidate({ imdbRating: 9.3, imdbVoteCount: 2500000 });
		const poorFilm = createMockCandidate({ imdbRating: 4.0, imdbVoteCount: 10000 });

		const scoreMasterpiece = calculateQualityScore(masterpiece, []);
		const scorePoor = calculateQualityScore(poorFilm, []);

		expect(scoreMasterpiece).toBeGreaterThan(85);
		expect(scoreMasterpiece).toBeLessThanOrEqual(100);
		expect(scorePoor).toBeLessThan(30);
		expect(scorePoor).toBeGreaterThanOrEqual(0);
	});
});

describe('Movie Picker Engine — Personal Taste Scoring', () => {
	it('should award higher taste scores to candidates matching favorite genres', () => {
		const profile = createMockTasteProfile();
		const crimeThriller = createMockCandidate({ genres: ['Crime', 'Thriller'] });
		const comedyOnly = createMockCandidate({ genres: ['Comedy'] });

		const scoreCrime = calculateTasteScore(crimeThriller, profile, []);
		const scoreComedy = calculateTasteScore(comedyOnly, profile, []);

		expect(scoreCrime).toBeGreaterThan(scoreComedy);
	});

	it('should give significant bonus points to favorite directors', () => {
		const profile = createMockTasteProfile();
		const scorseseMovie = createMockCandidate({ director: 'Martin Scorsese' });
		const unknownDirectorMovie = createMockCandidate({ director: 'Unknown Filmmaker' });

		const scoreScorsese = calculateTasteScore(scorseseMovie, profile, []);
		const scoreUnknown = calculateTasteScore(unknownDirectorMovie, profile, []);

		expect(scoreScorsese - scoreUnknown).toBeGreaterThanOrEqual(30);
	});

	it('should award points for matching preferred eras and runtimes', () => {
		const profile = createMockTasteProfile({ avgRuntime: 120, preferredDecades: { '2000s': 5 } });
		const matchingEraAndRuntime = createMockCandidate({
			releaseDate: '2006-05-10',
			runtime: 122
		});
		const mismatchedEraAndRuntime = createMockCandidate({
			releaseDate: '1940-02-10',
			runtime: 210
		});

		const scoreMatch = calculateTasteScore(matchingEraAndRuntime, profile, []);
		const scoreMismatch = calculateTasteScore(mismatchedEraAndRuntime, profile, []);

		expect(scoreMatch).toBeGreaterThan(scoreMismatch);
	});
});

describe('Movie Picker Engine — Discovery & Penalties', () => {
	it('should award discovery bonus to high-rated foreign masterworks', () => {
		const koreanMasterpiece = createMockCandidate({
			originalLanguage: 'ko',
			voteAverage: 8.4,
			imdbRating: 8.5,
			voteCount: 85000
		});
		const englishMainstream = createMockCandidate({
			originalLanguage: 'en',
			voteAverage: 7.5,
			imdbRating: 7.5,
			voteCount: 800000
		});

		const scoreKorean = calculateDiscoveryScore(koreanMasterpiece, []);
		const scoreEnglish = calculateDiscoveryScore(englishMainstream, []);

		expect(scoreKorean).toBeGreaterThan(scoreEnglish);
	});

	it('should penalize movies whose director was shown recently in the session', () => {
		const profile = createMockTasteProfile();
		const candidate = createMockCandidate({ director: 'Christopher Nolan' });

		const freshScored = scoreCandidate(candidate, {
			tasteProfile: profile,
			mode: 'balanced',
			recentDirectorsShown: []
		});

		const penalizedScored = scoreCandidate(candidate, {
			tasteProfile: profile,
			mode: 'balanced',
			recentDirectorsShown: ['christopher nolan']
		});

		expect(freshScored.breakdown.finalScore).toBeGreaterThan(penalizedScored.breakdown.finalScore);
		expect(penalizedScored.breakdown.diversityPenalty).toBeGreaterThanOrEqual(30);
	});

	it('should heavily penalize movies the user recently skipped with Not Tonight', () => {
		const profile = createMockTasteProfile({
			recentSkippedMovieIds: new Set(['movie-uuid-skipped'])
		});
		const candidate = createMockCandidate({ id: 'movie-uuid-skipped' });

		const scored = scoreCandidate(candidate, {
			tasteProfile: profile,
			mode: 'balanced'
		});

		expect(scored.breakdown.skipPenalty).toBeGreaterThanOrEqual(40);
	});
});

describe('Movie Picker Engine — Ranking & Controlled Randomness', () => {
	it('should rank top candidates and probabilistically select from the top tier', () => {
		const profile = createMockTasteProfile();
		const candidates = [
			createMockCandidate({ id: 'cand-1', title: 'Top Pick 1', imdbRating: 8.8 }),
			createMockCandidate({ id: 'cand-2', title: 'Top Pick 2', imdbRating: 8.7 }),
			createMockCandidate({ id: 'cand-3', title: 'Mid Pick 3', imdbRating: 7.8 }),
			createMockCandidate({ id: 'cand-4', title: 'Low Pick 4', imdbRating: 6.5 })
		];

		const selected = rankAndSelectCandidate({
			candidates,
			tasteProfile: profile,
			mode: 'safe'
		});

		expect(selected).not.toBeNull();
		expect(selected?.candidate.id).toBeDefined();
		// Selected candidate should have strong quality score
		expect(selected?.breakdown.finalScore).toBeGreaterThan(50);
	});

	it('should return the single candidate if only one candidate is available', () => {
		const profile = createMockTasteProfile();
		const candidates = [createMockCandidate({ id: 'lone-candidate', title: 'Lone Title' })];

		const selected = rankAndSelectCandidate({
			candidates,
			tasteProfile: profile
		});

		expect(selected?.candidate.id).toBe('lone-candidate');
	});

	it('should return null when candidates array is empty', () => {
		const profile = createMockTasteProfile();
		const selected = rankAndSelectCandidate({
			candidates: [],
			tasteProfile: profile
		});

		expect(selected).toBeNull();
	});
});

describe('Movie Picker Engine — Explanation Generation', () => {
	it('should generate meaningful why-this-pick explanations based on matched signals', () => {
		const profile = createMockTasteProfile();
		const candidate = createMockCandidate({
			title: 'Taxi Driver',
			director: 'Martin Scorsese',
			genres: ['Crime', 'Drama'],
			imdbRating: 8.2
		});

		const scored = scoreCandidate(candidate, {
			tasteProfile: profile,
			mode: 'safe'
		});

		const explanation = generateRecommendationExplanation(scored, profile);

		expect(explanation).toBeDefined();
		expect(typeof explanation).toBe('string');
		expect(explanation.length).toBeGreaterThan(20);
		// Should mention director or favorite genres or IMDb
		expect(
			explanation.includes('Scorsese') ||
				explanation.includes('Crime') ||
				explanation.includes('IMDb') ||
				explanation.includes('Drama')
		).toBe(true);
	});
});
