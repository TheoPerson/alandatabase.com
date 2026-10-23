import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			movies: { findMany }
		}
	}
}));

import { searchLocalMovies } from './local-movie-search';

function movieFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		tmdbId: 1,
		title: 'Standard movie',
		originalTitle: 'Standard movie',
		adult: false,
		keywords: [],
		localOverrides: null,
		genres: [],
		...overrides
	};
}

describe('local-only movie search', () => {
	beforeEach(() => {
		findMany.mockReset();
	});

	it('defensively excludes adult, custom, and known-explicit rows', async () => {
		findMany.mockResolvedValue([
			movieFixture({
				localOverrides: {
					title: 'Saved title',
					customVideoUrl: 'https://untrusted.example/embed'
				}
			}),
			movieFixture({ id: 'adult', tmdbId: 2, adult: true }),
			movieFixture({ id: 'custom', tmdbId: -3 }),
			movieFixture({
				id: 'explicit',
				tmdbId: 4,
				keywords: [{ keywordId: 256466 }]
			})
		]);

		const results = await searchLocalMovies('movie', 10);

		expect(results.map((movie) => movie.title)).toEqual(['Saved title']);
		expect(results[0]).not.toHaveProperty('keywords');
		expect(results[0]).not.toHaveProperty('localOverrides');
		expect(JSON.stringify(results)).not.toContain('customVideoUrl');
	});

	it('enforces a local result cap and requests keyword visibility metadata', async () => {
		findMany.mockResolvedValue([]);

		await searchLocalMovies('movie', 10_000);

		expect(findMany).toHaveBeenCalledOnce();
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 30,
				with: { keywords: true, genres: { with: { genre: true } } }
			})
		);
	});
});
