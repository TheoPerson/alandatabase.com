import { describe, expect, it } from 'vitest';
import { parsePickerEvent, parseRecommendRequest } from './request';

const MOVIE_ID = '3f2b8c1e-5a7d-4e6f-9b0a-1c2d3e4f5a6b';

function ok<T>(result: { ok: boolean } & Record<string, unknown>): T {
	expect(result.ok).toBe(true);
	return (result as unknown as { value: T }).value;
}

describe('parseRecommendRequest', () => {
	it('applies safe defaults for an empty body', () => {
		const value = ok<ReturnType<typeof defaults>>(parseRecommendRequest({}));

		expect(value.filters).toEqual({});
		expect(value.shownMovieIds).toEqual([]);
		expect(value.position).toBe(1);
		expect(value.sessionId).toMatch(/^[0-9a-f-]{36}$/u);
	});

	it.each([null, 'text', 42, [], undefined])('rejects a non-object body (%s)', (body) => {
		expect(parseRecommendRequest(body).ok).toBe(false);
	});

	it('keeps only whitelisted filter keys', () => {
		const value = ok<ReturnType<typeof defaults>>(
			parseRecommendRequest({
				filters: { minRating: 7.5, includeAdult: true, adult: true, __proto__: { x: 1 } }
			})
		);

		expect(value.filters).toEqual({ minRating: 7.5 });
	});

	it.each([
		['minRating above 10', { minRating: 11 }],
		['negative minRating', { minRating: -1 }],
		['string minRating', { minRating: '7' }],
		['NaN minRating', { minRating: Number.NaN }],
		['minYear before cinema', { minYear: 1700 }],
		['fractional minYear', { minYear: 1999.5 }],
		['non-positive runtime', { maxRuntime: 0 }],
		['absurd runtime', { maxRuntime: 100000 }],
		['negative votes', { minVotes: -5 }],
		['unknown mode', { mode: 'chaos' }],
		['unknown era', { era: '1800s' }],
		['unknown preset', { preset: 'EVERYTHING' }],
		['non-boolean exclusion flag', { excludeWatched: 'no' }],
		['genres not an array', { genres: 'Drama' }],
		['non-string genre', { genres: ['Drama', 7] }],
		['too many genres', { genres: Array.from({ length: 11 }, (_, index) => `G${index}`) }],
		['overlong genre', { genres: ['x'.repeat(51)] }],
		['filters not an object', 'minRating=7']
	])('rejects %s', (_name, filters) => {
		expect(parseRecommendRequest({ filters }).ok).toBe(false);
	});

	it('trims genre names and accepts every supported filter', () => {
		const value = ok<ReturnType<typeof defaults>>(
			parseRecommendRequest({
				filters: {
					mode: 'discovery',
					era: '2000+',
					minYear: 1990,
					maxYear: 2020,
					minRating: 7,
					minVotes: 500,
					maxRuntime: 120,
					genres: [' Crime ', 'Drama'],
					excludeWatched: false,
					excludeDisliked: true
				}
			})
		);

		expect(value.filters.genres).toEqual(['Crime', 'Drama']);
		expect(value.filters.mode).toBe('discovery');
		expect(value.filters.excludeWatched).toBe(false);
	});

	it('expands a preset and lets explicit fields win', () => {
		const value = ok<ReturnType<typeof defaults>>(
			parseRecommendRequest({ filters: { preset: 'CRIME', minRating: 8.1 } })
		);

		expect(value.filters.genres).toEqual(['Crime', 'Mystery']);
		expect(value.filters.minRating).toBe(8.1);
	});

	it('only accepts UUID movie ids and bounds how many are accepted', () => {
		expect(parseRecommendRequest({ shownMovieIds: [MOVIE_ID] }).ok).toBe(true);
		expect(parseRecommendRequest({ shownMovieIds: ['not-a-uuid'] }).ok).toBe(false);
		expect(parseRecommendRequest({ shownMovieIds: 'abc' }).ok).toBe(false);
		expect(parseRecommendRequest({ shownMovieIds: Array(501).fill(MOVIE_ID) }).ok).toBe(false);
	});

	it('bounds session id, position and recent-history arrays', () => {
		expect(parseRecommendRequest({ sessionId: 'x'.repeat(65) }).ok).toBe(false);
		expect(parseRecommendRequest({ sessionId: '' }).ok).toBe(false);
		expect(parseRecommendRequest({ position: 0 }).ok).toBe(false);
		expect(parseRecommendRequest({ position: 1.5 }).ok).toBe(false);
		expect(parseRecommendRequest({ recentDirectorsShown: Array(51).fill('a') }).ok).toBe(false);
		expect(parseRecommendRequest({ recentPrimaryGenresShown: [3] }).ok).toBe(false);
	});
});

describe('parsePickerEvent', () => {
	const valid = { sessionId: 'session-1', movieId: MOVIE_ID, action: 'not_tonight' };

	it('accepts a minimal valid event', () => {
		expect(ok<Record<string, unknown>>(parsePickerEvent(valid))).toMatchObject(valid);
	});

	it.each([
		'impression',
		'another',
		'not_tonight',
		'open',
		'watch',
		'favorite',
		'watchlist',
		'rating'
	])('accepts action %s', (action) => {
		expect(parsePickerEvent({ ...valid, action }).ok).toBe(true);
	});

	it.each([
		['missing session', { ...valid, sessionId: undefined }],
		['non-uuid movie', { ...valid, movieId: 'abc' }],
		['unknown action', { ...valid, action: 'delete_everything' }],
		['overlong action', { ...valid, action: 'a'.repeat(60) }],
		['non-numeric score', { ...valid, score: '9' }],
		['infinite score', { ...valid, score: Number.POSITIVE_INFINITY }],
		['non-integer position', { ...valid, position: 1.2 }],
		['array body', [valid]]
	])('rejects %s', (_name, body) => {
		expect(parsePickerEvent(body).ok).toBe(false);
	});

	it('accepts small flat metadata and rejects nested or oversized metadata', () => {
		expect(parsePickerEvent({ ...valid, metadata: { source: 'card', rank: 2, ok: true } }).ok).toBe(
			true
		);
		expect(parsePickerEvent({ ...valid, metadata: { nested: { a: 1 } } }).ok).toBe(false);
		expect(parsePickerEvent({ ...valid, metadata: { big: 'x'.repeat(201) } }).ok).toBe(false);
		expect(
			parsePickerEvent({
				...valid,
				metadata: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`k${index}`, 1]))
			}).ok
		).toBe(false);
	});
});

// Type helper only: shape of a successfully parsed recommend request.
function defaults() {
	return {
		sessionId: '',
		filters: {} as import('$lib/picker/types').PickerFilters,
		shownMovieIds: [] as string[],
		position: 1,
		recentDirectorsShown: [] as string[],
		recentPrimaryGenresShown: [] as string[]
	};
}
