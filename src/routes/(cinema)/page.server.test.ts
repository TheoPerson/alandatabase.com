import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getFeaturedMovies: vi.fn(),
	getGenres: vi.fn(),
	getTopRatedMovies: vi.fn(),
	getTrendingMovies: vi.fn(),
	getUserWatchlist: vi.fn(),
	toggleWatchlist: vi.fn(),
	getTop50IMDbTVShows: vi.fn(),
	listContinueWatching: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		getFeaturedMovies: services.getFeaturedMovies,
		getGenres: services.getGenres,
		getTopRatedMovies: services.getTopRatedMovies,
		getTrendingMovies: services.getTrendingMovies
	};
});
vi.mock('$lib/server/services/interaction.service', () => ({
	getUserWatchlist: services.getUserWatchlist,
	toggleWatchlist: services.toggleWatchlist
}));
vi.mock('$lib/server/services/tv.service', () => ({
	getTop50IMDbTVShows: services.getTop50IMDbTVShows
}));

vi.mock('$lib/server/media/repository', () => ({
	listContinueWatching: services.listContinueWatching
}));

import { load } from './+page.server';

function movie(index: number) {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		title: `Movie ${index}`,
		posterPath: '/p.jpg',
		backdropPath: '/b.jpg',
		voteAverage: '7.5',
		releaseDate: '2001-01-01',
		genres: []
	};
}

describe('home load', () => {
	it('caps the watchlist rail and keeps the other rails independent of a failed one', async () => {
		services.getFeaturedMovies.mockRejectedValue(new Error('db down'));
		services.getTrendingMovies.mockResolvedValue([movie(1)]);
		services.getTopRatedMovies.mockResolvedValue([movie(2)]);
		services.getGenres.mockResolvedValue([{ id: 18, name: 'Drama' }]);
		services.getTop50IMDbTVShows.mockResolvedValue([]);
		services.listContinueWatching.mockResolvedValue([]);
		services.getUserWatchlist.mockResolvedValue(
			Array.from({ length: 30 }, (_, index) => ({ movie: movie(100 + index) }))
		);

		const data = await load({
			locals: { user: { id: 'u1', role: 'owner' } }
		} as unknown as Parameters<typeof load>[0]);

		expect(data.featured).toEqual([]);
		expect(data.error).toBe(false);
		expect(data.top10).toHaveLength(1);
		expect(data.watchlist).toHaveLength(20);
		expect(data.watchlistIds).toContain(movie(100).id);
	});
});

describe('home continue watching rail', () => {
	const row = {
		fileId: '00000000-0000-4000-8000-000000000001',
		positionSeconds: 600,
		durationSeconds: 3060,
		updatedAt: '2026-10-16T20:00:00.000Z',
		kind: 'movie',
		title: 'Dune',
		subtitle: '2021',
		href: '/movies/x',
		imagePath: '/b.jpg',
		posterPath: '/p.jpg',
		backdropPath: '/b.jpg',
		movie: { id: 'x', tmdbId: 1, title: 'Dune', releaseDate: '2021-09-15' },
		episode: null
	};
	const run = (user: unknown) =>
		load({ locals: { user } } as unknown as Parameters<typeof load>[0]);

	beforeEach(() => {
		vi.clearAllMocks();
		services.getFeaturedMovies.mockResolvedValue([]);
		services.getTrendingMovies.mockResolvedValue([]);
		services.getTopRatedMovies.mockResolvedValue([]);
		services.getGenres.mockResolvedValue([]);
		services.getTop50IMDbTVShows.mockResolvedValue([]);
		services.getUserWatchlist.mockResolvedValue([]);
		services.listContinueWatching.mockResolvedValue([row]);
	});

	it('gives the owner up to 12 cards that open the player', async () => {
		const data = await run({ id: 'u1', role: 'owner' });
		expect(services.listContinueWatching).toHaveBeenCalledWith('u1', 12);
		expect(data.continueWatching).toEqual([
			expect.objectContaining({
				href: '/watch/00000000-0000-4000-8000-000000000001',
				title: 'Dune',
				remainingLabel: '41 min left'
			})
		]);
	});

	it.each([
		['a member', { id: 'u2', role: 'member' }],
		['a visitor', null]
	])('never reads the library for %s', async (_label, user) => {
		const data = await run(user);
		expect(services.listContinueWatching).not.toHaveBeenCalled();
		expect(data.continueWatching).toEqual([]);
	});

	it('hides the rail instead of failing the page when the read fails', async () => {
		services.listContinueWatching.mockRejectedValue(new Error('db down'));
		const data = await run({ id: 'u1', role: 'owner' });
		expect(data.continueWatching).toEqual([]);
	});
});
