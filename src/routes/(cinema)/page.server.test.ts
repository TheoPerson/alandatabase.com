import { describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getFeaturedMovies: vi.fn(),
	getGenres: vi.fn(),
	getTopRatedMovies: vi.fn(),
	getTrendingMovies: vi.fn(),
	getUserWatchlist: vi.fn(),
	toggleWatchlist: vi.fn(),
	getTop50IMDbTVShows: vi.fn()
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
