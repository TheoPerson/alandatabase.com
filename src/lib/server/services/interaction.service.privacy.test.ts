import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbSpies = vi.hoisted(() => ({
	interactionFindMany: vi.fn(),
	interactionFindFirst: vi.fn(),
	movieFindFirst: vi.fn(),
	userFindFirst: vi.fn(),
	reviewFindMany: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	ensureTablesExist: vi.fn()
}));

vi.mock('../db/index.js', () => ({
	db: {
		query: {
			userMovieInteractions: {
				findMany: dbSpies.interactionFindMany,
				findFirst: dbSpies.interactionFindFirst
			},
			movies: { findFirst: dbSpies.movieFindFirst },
			users: { findFirst: dbSpies.userFindFirst },
			userReviews: { findMany: dbSpies.reviewFindMany }
		},
		insert: dbSpies.insert,
		update: dbSpies.update,
		delete: dbSpies.delete
	}
}));

vi.mock('../db/migrate.js', () => ({
	ensureTablesExist: dbSpies.ensureTablesExist
}));

import {
	addUserReview,
	getUserFavorites,
	getUserStats,
	getUserWatchedHistory,
	getUserWatchlist,
	setMovieWatched,
	toggleFavorite,
	toggleWatchlist
} from './interaction.service';

const USER_ID = '00000000-0000-4000-8000-000000000100';

function movieFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		tmdbId: 1,
		title: 'Standard Movie',
		adult: false,
		keywords: [],
		localOverrides: {
			title: 'Standard Override',
			customVideoUrl: 'https://untrusted.example/embed'
		},
		runtime: 120,
		genres: [{ genre: { name: 'Drama' } }],
		...overrides
	};
}

function interactionFixture(movie: ReturnType<typeof movieFixture>, overrides = {}) {
	return {
		id: crypto.randomUUID(),
		userId: USER_ID,
		movieId: movie.id,
		watched: true,
		watchlist: true,
		favorite: true,
		movie,
		...overrides
	};
}

function privacyFixtureSet() {
	return [
		interactionFixture(movieFixture()),
		interactionFixture(movieFixture({ id: 'adult', tmdbId: 2, title: 'Adult', adult: true })),
		interactionFixture(movieFixture({ id: 'custom', tmdbId: -3, title: 'Custom' })),
		interactionFixture(
			movieFixture({
				id: 'explicit',
				tmdbId: 4,
				title: 'Known explicit keyword',
				keywords: [{ keywordId: 256466 }]
			})
		)
	];
}

beforeEach(() => {
	vi.clearAllMocks();
	dbSpies.interactionFindMany.mockResolvedValue([]);
	dbSpies.interactionFindFirst.mockResolvedValue(undefined);
	dbSpies.movieFindFirst.mockResolvedValue(undefined);
	dbSpies.userFindFirst.mockResolvedValue(undefined);
	dbSpies.reviewFindMany.mockResolvedValue([]);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('interaction service privacy reads', () => {
	it('filters adult, custom, and known-explicit rows from every personal collection', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		dbSpies.interactionFindMany.mockResolvedValue(privacyFixtureSet());

		const [watchlist, favorites, history] = await Promise.all([
			getUserWatchlist(USER_ID),
			getUserFavorites(USER_ID),
			getUserWatchedHistory(USER_ID)
		]);

		for (const collection of [watchlist, favorites, history]) {
			expect(collection.map((item) => item.movie.title)).toEqual(['Standard Override']);
			expect(collection[0].movie).not.toHaveProperty('keywords');
			expect(collection[0].movie).not.toHaveProperty('localOverrides');
			expect(JSON.stringify(collection)).not.toContain('customVideoUrl');
		}
		expect(dbSpies.ensureTablesExist).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(dbSpies.insert).not.toHaveBeenCalled();
		expect(dbSpies.update).not.toHaveBeenCalled();
		expect(dbSpies.delete).not.toHaveBeenCalled();
	});

	it('derives stats only from standard-content interactions', async () => {
		dbSpies.interactionFindMany.mockResolvedValue([
			interactionFixture(movieFixture()),
			interactionFixture(
				movieFixture({
					id: 'second-standard',
					tmdbId: 5,
					title: 'Second Standard',
					runtime: 90,
					genres: [{ genre: { name: 'Comedy' } }]
				}),
				{ watched: false, favorite: false }
			),
			...privacyFixtureSet().slice(1)
		]);

		const stats = await getUserStats(USER_ID);

		expect(stats).toEqual({
			watchedCount: 1,
			watchlistCount: 2,
			favoritesCount: 1,
			totalRuntimeMinutes: 120,
			totalRuntimeHours: 2,
			genreCounts: { Drama: 1 }
		});
		expect(dbSpies.ensureTablesExist).not.toHaveBeenCalled();
		expect(dbSpies.insert).not.toHaveBeenCalled();
		expect(dbSpies.update).not.toHaveBeenCalled();
		expect(dbSpies.delete).not.toHaveBeenCalled();
	});
});

describe('interaction service direct-ID containment', () => {
	it('rejects unresolved or quarantined IDs before any interaction write', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const uuid = '00000000-0000-4000-8000-000000000099';

		const [watchlist, favorite, watched, review] = await Promise.all([
			toggleWatchlist(USER_ID, uuid),
			toggleFavorite(USER_ID, '-3'),
			setMovieWatched(USER_ID, '267122', true),
			addUserReview(USER_ID, uuid, 'Private note')
		]);

		expect(watchlist).toEqual({ watchlist: false });
		expect(favorite).toEqual({ favorite: false });
		expect(watched).toBeNull();
		expect(review).toBeNull();
		expect(dbSpies.movieFindFirst).toHaveBeenCalledTimes(3);
		expect(dbSpies.interactionFindFirst).not.toHaveBeenCalled();
		expect(dbSpies.ensureTablesExist).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(dbSpies.insert).not.toHaveBeenCalled();
		expect(dbSpies.update).not.toHaveBeenCalled();
		expect(dbSpies.delete).not.toHaveBeenCalled();
	});
});
