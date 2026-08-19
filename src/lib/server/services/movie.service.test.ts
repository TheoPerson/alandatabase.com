import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbSpies = vi.hoisted(() => ({
	movieFindMany: vi.fn(),
	movieFindFirst: vi.fn(),
	peopleFindMany: vi.fn(),
	peopleFindFirst: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn()
}));

vi.mock('../db/index.js', () => ({
	db: {
		query: {
			movies: {
				findMany: dbSpies.movieFindMany,
				findFirst: dbSpies.movieFindFirst
			},
			people: {
				findMany: dbSpies.peopleFindMany,
				findFirst: dbSpies.peopleFindFirst
			}
		},
		select: dbSpies.select,
		insert: dbSpies.insert,
		update: dbSpies.update,
		delete: dbSpies.delete
	}
}));

import {
	applyLocalOverrides,
	countMovies,
	getMovieById,
	getTopRatedMovies,
	getTrendingMovies,
	searchMovies
} from './movie.service';

function movieFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		tmdbId: 1,
		title: 'Standard Movie',
		overview: 'Overview',
		adult: false,
		keywords: [],
		popularity: '10',
		voteAverage: '8',
		voteCount: 100,
		localOverrides: null,
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	dbSpies.movieFindMany.mockResolvedValue([]);
	dbSpies.movieFindFirst.mockResolvedValue(undefined);
	dbSpies.peopleFindMany.mockResolvedValue([]);
	dbSpies.peopleFindFirst.mockResolvedValue(undefined);
	dbSpies.where.mockResolvedValue([{ count: 0 }]);
	dbSpies.from.mockReturnValue({ where: dbSpies.where });
	dbSpies.select.mockReturnValue({ from: dbSpies.from });
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Movie Service - Local Overrides', () => {
	it('should return the movie unchanged if there are no overrides', () => {
		const movie = {
			id: '123',
			title: 'Original Title',
			overview: 'Original Overview',
			localOverrides: null
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('Original Title');
		expect(result.overview).toBe('Original Overview');
		expect(result).not.toHaveProperty('localOverrides');
	});

	it('should apply local overrides when they exist', () => {
		const movie = {
			id: '123',
			title: 'Official Matrix',
			overview: 'Official Overview',
			localOverrides: {
				title: 'My Custom Matrix Title',
				overview: 'This is my personal overview for the movie.',
				customVideoUrl: 'https://untrusted.example/embed'
			}
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('My Custom Matrix Title');
		expect(result.overview).toBe('This is my personal overview for the movie.');
		expect(result).not.toHaveProperty('localOverrides');
		expect(JSON.stringify(result)).not.toContain('customVideoUrl');
	});

	it('should only apply specific overridden fields and leave others intact', () => {
		const movie = {
			id: '123',
			title: 'Official Matrix',
			releaseDate: '1999-03-31',
			overview: 'Official Overview',
			localOverrides: {
				title: 'My Custom Matrix Title'
			}
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('My Custom Matrix Title');
		expect(result.releaseDate).toBe('1999-03-31');
		expect(result.overview).toBe('Official Overview');
	});
});

describe('Movie Service - Standard local reads', () => {
	it('filters quarantined rows from home movie reads', async () => {
		dbSpies.movieFindMany.mockResolvedValue([
			movieFixture(),
			movieFixture({ id: 'adult', tmdbId: 2, title: 'Adult', adult: true }),
			movieFixture({ id: 'custom', tmdbId: -3, title: 'Custom' }),
			movieFixture({
				id: 'explicit',
				tmdbId: 4,
				title: 'Explicit keyword',
				keywords: [{ keywordId: 256466 }]
			})
		]);

		const [trending, topRated] = await Promise.all([getTrendingMovies(), getTopRatedMovies()]);

		expect(trending.map((movie) => movie.title)).toEqual(['Standard Movie']);
		expect(topRated.map((movie) => movie.title)).toEqual(['Standard Movie']);
		expect(trending[0]).not.toHaveProperty('keywords');
	});

	it('counts through the standard-content database predicate', async () => {
		dbSpies.where.mockResolvedValue([{ count: 7 }]);

		const count = await countMovies();

		expect(count).toBe(7);
		expect(dbSpies.where).toHaveBeenCalledOnce();
	});

	it('returns null for invalid, missing, or quarantined details without side effects', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const invalid = await getMovieById('not-an-id');
		dbSpies.movieFindFirst
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(movieFixture({ tmdbId: 9, adult: true }));
		const missing = await getMovieById('999');
		const adult = await getMovieById('9');

		expect(invalid).toBeNull();
		expect(missing).toBeNull();
		expect(adult).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(dbSpies.insert).not.toHaveBeenCalled();
		expect(dbSpies.update).not.toHaveBeenCalled();
		expect(dbSpies.delete).not.toHaveBeenCalled();
	});

	it('searches only local standard movies and performs no deferred work', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		dbSpies.movieFindMany.mockResolvedValue([
			movieFixture({ title: 'Inception', tmdbId: 27205 }),
			movieFixture({ title: 'Adult result', tmdbId: 20, adult: true }),
			movieFixture({ title: 'Custom result', tmdbId: -21 }),
			movieFixture({
				title: 'Explicit result',
				tmdbId: 22,
				keywords: [{ keywordId: 267122 }]
			})
		]);
		dbSpies.peopleFindMany.mockResolvedValue([
			{
				castRoles: [
					{ movie: movieFixture({ title: 'Actor Film', tmdbId: 23 }) },
					{ movie: movieFixture({ title: 'Actor Adult Film', tmdbId: 24, adult: true }) }
				]
			}
		]);

		const results = await searchMovies('Inception', 10);

		expect(results.map((movie) => movie.title)).toEqual(['Inception', 'Actor Film']);
		expect(results.every((movie) => !('keywords' in movie))).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(dbSpies.insert).not.toHaveBeenCalled();
		expect(dbSpies.update).not.toHaveBeenCalled();
		expect(dbSpies.delete).not.toHaveBeenCalled();
	});

	it('does not touch the database for an empty search', async () => {
		const results = await searchMovies('   ');

		expect(results).toEqual([]);
		expect(dbSpies.movieFindMany).not.toHaveBeenCalled();
		expect(dbSpies.peopleFindMany).not.toHaveBeenCalled();
	});
});
