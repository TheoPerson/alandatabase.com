import { beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	transaction: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', () => ({
	getMovieById: spies.getMovieById
}));

vi.mock('$lib/server/db', () => ({
	db: {
		transaction: spies.transaction
	}
}));

vi.mock('$lib/server/services/interaction.service', () => ({
	logActivity: vi.fn()
}));

import { _mergeInteractionValues, _mergeReviewValues, actions } from './+page.server';

const MOVIE_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
	vi.clearAllMocks();
	spies.getMovieById.mockResolvedValue({ id: MOVIE_ID, tmdbId: 27_205 });
});

describe('catalog merge identity safety', () => {
	it('preserves spoiler state, watch dates, ratings and notes when records conflict', () => {
		expect(
			_mergeReviewValues(
				{ content: 'Target review', containsSpoilers: false },
				{ content: 'Source review', containsSpoilers: true }
			)
		).toEqual({
			content: 'Target review\n\n---\n\nSource review',
			containsSpoilers: true
		});

		const merged = _mergeInteractionValues(
			{
				watched: true,
				watchlist: false,
				favorite: false,
				rating: null,
				watchDate: '2025-02-10',
				rewatchCount: 1,
				personalNotes: 'Target note'
			},
			{
				watched: false,
				watchlist: true,
				favorite: true,
				rating: '4.5',
				watchDate: '2024-01-05',
				rewatchCount: 2,
				personalNotes: 'Source note'
			}
		);

		expect(merged).toMatchObject({
			watched: true,
			watchlist: true,
			favorite: true,
			rating: '4.5',
			watchDate: '2024-01-05',
			rewatchCount: 3,
			personalNotes: 'Target note\nSource note'
		});
	});

	it('rejects authenticated non-owner users before resolving movies', async () => {
		const form = new FormData();
		form.set('targetTmdbId', '27205');
		const request = new Request('http://localhost/movies/catalog/27205/merge', {
			method: 'POST',
			body: form
		});

		await expect(
			actions.default({
				request,
				params: { id: '27205' },
				locals: { user: { id: 'viewer', role: 'member' } }
			} as never)
		).rejects.toMatchObject({ status: 403 });

		expect(spies.getMovieById).not.toHaveBeenCalled();
		expect(spies.transaction).not.toHaveBeenCalled();
	});

	it('rejects a numeric route that resolves source and target to the same movie', async () => {
		const form = new FormData();
		form.set('targetTmdbId', '27205');
		const request = new Request('http://localhost/movies/catalog/27205/merge', {
			method: 'POST',
			body: form
		});

		const result = await actions.default({
			request,
			params: { id: '27205' },
			locals: { user: { id: 'admin', role: 'admin' } }
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(spies.getMovieById).toHaveBeenNthCalledWith(1, '27205');
		expect(spies.getMovieById).toHaveBeenNthCalledWith(2, '27205');
		expect(spies.transaction).not.toHaveBeenCalled();
	});
});
