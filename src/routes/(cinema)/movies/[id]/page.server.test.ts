import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	getUserInteraction: vi.fn(),
	readAlanScore: vi.fn(),
	upsertAlanScore: vi.fn(),
	resetAlanScore: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', () => ({ getMovieById: mocks.getMovieById }));
vi.mock('$lib/server/services/interaction.service', () => ({
	getUserInteraction: mocks.getUserInteraction
}));
vi.mock('$lib/server/services/alan-score.service', () => ({
	readAlanScore: mocks.readAlanScore,
	upsertAlanScore: mocks.upsertAlanScore,
	resetAlanScore: mocks.resetAlanScore
}));

import { _parseAlanScoreForm, actions, load } from './+page.server';

const movie = { id: 'movie-id', cast: [] };

describe('canonical movie Alan Score access', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getMovieById.mockResolvedValue(movie);
		mocks.getUserInteraction.mockResolvedValue({ rating: '4.5' });
		mocks.readAlanScore.mockResolvedValue({ score: 8.1 });
	});

	it('omits all personal score fields for anonymous visitors', async () => {
		const data = await load({ params: { id: '123' }, locals: { user: null } } as any);
		expect(data).not.toHaveProperty('personal');
		expect(mocks.readAlanScore).not.toHaveBeenCalled();
		expect(mocks.getUserInteraction).not.toHaveBeenCalled();
	});

	it('loads score and legacy rating only for the owner', async () => {
		const data = await load({
			params: { id: '123' },
			locals: { user: { id: 'owner-id', role: 'owner' } }
		} as any);
		expect(data).toMatchObject({
			personal: { alanScore: { score: 8.1 }, legacyRating: '4.5' }
		});
		expect(mocks.readAlanScore).toHaveBeenCalledWith('owner-id', '123');
	});

	it.each([null, 'admin', 'member'])('denies score writes before parsing for %s', async (role) => {
		const formData = vi.fn();
		const locals = { user: role ? { id: 'user-id', role } : null };
		await expect(
			actions.saveAlanScore({ locals, request: { formData } } as any)
		).rejects.toMatchObject({
			status: 403
		});
		await expect(
			actions.resetAlanScore({ locals, request: { formData } } as any)
		).rejects.toMatchObject({
			status: 403
		});
		expect(formData).not.toHaveBeenCalled();
		expect(mocks.upsertAlanScore).not.toHaveBeenCalled();
		expect(mocks.resetAlanScore).not.toHaveBeenCalled();
	});

	it('parses missing dimensions as null and preserves zero', () => {
		const form = new FormData();
		form.set('movieId', 'movie-id');
		form.set('realism', '0');
		form.set('cinematography', '8.5');
		form.set('tags', 'Slow Burn, theatrical');
		expect(_parseAlanScoreForm(form)).toMatchObject({
			movieId: 'movie-id',
			values: { realism: 0, cinematography: 8.5, tension: null },
			tags: ['Slow Burn', ' theatrical']
		});
	});

	it('ignores any submitted user identity and writes as the authenticated owner', async () => {
		const form = new FormData();
		form.set('movieId', 'movie-id');
		form.set('userId', 'different-user');
		form.set('realism', '8');
		mocks.upsertAlanScore.mockResolvedValue({ score: 8, status: 'partial' });

		const result = await actions.saveAlanScore({
			locals: { user: { id: 'owner-id', role: 'owner' } },
			request: { formData: async () => form }
		} as any);

		expect(mocks.upsertAlanScore).toHaveBeenCalledWith(
			'owner-id',
			'movie-id',
			expect.objectContaining({ values: expect.objectContaining({ realism: 8 }) })
		);
		expect(result).toMatchObject({ alanScoreMessage: 'Alan Score saved.' });
	});

	it('returns an explicit empty score after an owner reset', async () => {
		const form = new FormData();
		form.set('movieId', 'movie-id');

		const result = await actions.resetAlanScore({
			locals: { user: { id: 'owner-id', role: 'owner' } },
			request: { formData: async () => form }
		} as any);

		expect(mocks.resetAlanScore).toHaveBeenCalledWith('owner-id', 'movie-id');
		expect(result).toEqual({ alanScoreMessage: 'Alan Score reset.', alanScore: null });
	});
});
