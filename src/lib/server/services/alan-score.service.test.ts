import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ALAN_SCORE_VALUES } from '$lib/alan-score';

const mocks = vi.hoisted(() => {
	const insertChain = {
		values: vi.fn(),
		onConflictDoUpdate: vi.fn(),
		returning: vi.fn()
	};
	insertChain.values.mockReturnValue(insertChain);
	insertChain.onConflictDoUpdate.mockReturnValue(insertChain);

	const deleteChain = { where: vi.fn(), returning: vi.fn() };
	deleteChain.where.mockReturnValue(deleteChain);

	return {
		findFirst: vi.fn(),
		insert: vi.fn(() => insertChain),
		insertChain,
		delete: vi.fn(() => deleteChain),
		deleteChain,
		resolveMovieUuid: vi.fn()
	};
});

vi.mock('$lib/server/db', () => ({
	db: {
		query: { moviePersonalScores: { findFirst: mocks.findFirst } },
		insert: mocks.insert,
		delete: mocks.delete
	}
}));
vi.mock('./interaction.service', () => ({ resolveMovieUuid: mocks.resolveMovieUuid }));

import { readAlanScore, resetAlanScore, upsertAlanScore } from './alan-score.service';

const row = {
	id: 'score-id',
	userId: 'owner-id',
	movieId: 'movie-id',
	realism: '8.0',
	cinematography: '6.0',
	originalLanguageExperience: null,
	tension: null,
	cast: null,
	atmosphere: null,
	rewatchability: null,
	computedScore: '7.1',
	coverage: 35,
	status: 'partial',
	note: 'Strong images',
	tags: ['slow burn'],
	createdAt: new Date('2026-09-01T10:00:00Z'),
	updatedAt: new Date('2026-09-01T10:00:00Z')
};

describe('Alan Score service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.insertChain.values.mockReturnValue(mocks.insertChain);
		mocks.insertChain.onConflictDoUpdate.mockReturnValue(mocks.insertChain);
		mocks.deleteChain.where.mockReturnValue(mocks.deleteChain);
		mocks.resolveMovieUuid.mockResolvedValue('movie-id');
		mocks.findFirst.mockResolvedValue(row);
		mocks.insertChain.returning.mockResolvedValue([row]);
		mocks.deleteChain.returning.mockResolvedValue([{ id: 'score-id' }]);
	});

	it('reads only after resolving a standard movie identifier', async () => {
		await expect(readAlanScore('owner-id', '123')).resolves.toMatchObject({
			score: 7.1,
			coverage: 35,
			values: { realism: 8, cinematography: 6 }
		});
		expect(mocks.resolveMovieUuid).toHaveBeenCalledWith('123');
		expect(mocks.findFirst).toHaveBeenCalledOnce();
	});

	it('does not read or write a rejected movie', async () => {
		mocks.resolveMovieUuid.mockResolvedValue(null);
		await expect(readAlanScore('owner-id', '-3')).resolves.toBeNull();
		await expect(
			upsertAlanScore('owner-id', '-3', {
				values: { ...EMPTY_ALAN_SCORE_VALUES, realism: 8 }
			})
		).resolves.toBeNull();
		await expect(resetAlanScore('owner-id', '-3')).resolves.toBe(false);
		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it('recalculates, normalizes, and uses an atomic owner/movie upsert', async () => {
		await upsertAlanScore('owner-id', '123', {
			values: { ...EMPTY_ALAN_SCORE_VALUES, realism: 8, cinematography: 6 },
			note: '  Strong images  ',
			tags: [' Slow Burn ', 'slow  burn']
		});

		expect(mocks.insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'owner-id',
				movieId: 'movie-id',
				realism: '8.0',
				cinematography: '6.0',
				computedScore: '7.1',
				coverage: 35,
				status: 'partial',
				note: 'Strong images',
				tags: ['slow burn']
			})
		);
		expect(mocks.insertChain.onConflictDoUpdate).toHaveBeenCalledOnce();
	});

	it('keeps repeated and concurrent saves on the conflict-safe path', async () => {
		await Promise.all([
			upsertAlanScore('owner-id', '123', {
				values: { ...EMPTY_ALAN_SCORE_VALUES, realism: 7 }
			}),
			upsertAlanScore('owner-id', '123', {
				values: { ...EMPTY_ALAN_SCORE_VALUES, realism: 8 }
			})
		]);
		expect(mocks.insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(2);
	});

	it('resets only the resolved owner/movie record', async () => {
		await expect(resetAlanScore('owner-id', '123')).resolves.toBe(true);
		expect(mocks.delete).toHaveBeenCalledOnce();
		expect(mocks.deleteChain.where).toHaveBeenCalledOnce();
	});
});
