import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMovieById } = vi.hoisted(() => ({ getMovieById: vi.fn() }));

vi.mock('$lib/server/services/movie.service', () => ({ getMovieById }));

import { load } from './+page.server';

describe('movie detail loader', () => {
	beforeEach(() => {
		getMovieById.mockReset();
	});

	it('preserves a not-found response', async () => {
		getMovieById.mockResolvedValue(null);

		await expect(
			load({ params: { id: 'missing' } } as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 404 });
	});

	it('maps unexpected service failures to a server error', async () => {
		getMovieById.mockRejectedValue(new Error('database unavailable'));

		await expect(
			load({ params: { id: 'broken' } } as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 500 });
	});

	it('returns a local movie without transforming its model', async () => {
		const movie = { id: 'movie-id', title: 'Example' };
		getMovieById.mockResolvedValue(movie);

		await expect(
			load({ params: { id: movie.id } } as Parameters<typeof load>[0])
		).resolves.toMatchObject({ movie, credits: [] });
	});
});
