import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	searchLocalMovies: vi.fn(),
	getTrendingMovies: vi.fn(),
	getGenres: vi.fn(),
	logServerError: vi.fn()
}));

vi.mock('$lib/server/queries/local-movie-search', () => ({
	searchLocalMovies: mocks.searchLocalMovies
}));
vi.mock('$lib/server/services/movie.service', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		getTrendingMovies: mocks.getTrendingMovies,
		getGenres: mocks.getGenres
	};
});
vi.mock('$lib/server/security/logging', () => ({ logServerError: mocks.logServerError }));

import { load } from './+page.server';

function movie(index: number) {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		title: `Movie ${index}`,
		posterPath: '/p.jpg',
		voteAverage: '7.5',
		releaseDate: '2001-01-01',
		genres: [{ genre: { id: 28, name: 'Action' } }]
	};
}

const event = (search = '') =>
	({ url: new URL(`https://alandatabase.com/search${search}`) }) as any;

describe('search page loader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.searchLocalMovies.mockResolvedValue([]);
		mocks.getTrendingMovies.mockResolvedValue([]);
		mocks.getGenres.mockResolvedValue([]);
	});

	it('loads trending films and genres, and runs no search, when there is no query', async () => {
		mocks.getTrendingMovies.mockResolvedValue([movie(1), movie(2)]);
		mocks.getGenres.mockResolvedValue([{ id: 28, name: 'Action' }]);

		const data = await load(event());

		expect(mocks.searchLocalMovies).not.toHaveBeenCalled();
		expect(mocks.getTrendingMovies).toHaveBeenCalledWith(12);
		expect(data).toMatchObject({ query: '', results: [], searchError: false });
		expect(data.trending).toEqual([
			{
				id: movie(1).id,
				href: `/movies/${movie(1).id}`,
				title: 'Movie 1',
				posterPath: '/p.jpg',
				releaseDate: '2001-01-01',
				rating: '7.5',
				genre: 'Action'
			},
			expect.objectContaining({ id: movie(2).id })
		]);
		expect(data.genres).toEqual([{ id: 28, name: 'Action' }]);
	});

	it('treats a whitespace-only query as no query', async () => {
		const data = await load(event('?q=%20%20'));

		expect(data.query).toBe('');
		expect(mocks.searchLocalMovies).not.toHaveBeenCalled();
		expect(mocks.getTrendingMovies).toHaveBeenCalled();
	});

	it('returns poster items for a query and skips the empty-state reads', async () => {
		mocks.searchLocalMovies.mockResolvedValue([movie(1), movie(2), movie(3)]);

		const data = await load(event('?q=movie'));

		expect(mocks.searchLocalMovies).toHaveBeenCalledWith('movie', 30);
		expect(mocks.getTrendingMovies).not.toHaveBeenCalled();
		expect(mocks.getGenres).not.toHaveBeenCalled();
		expect(data).toMatchObject({ query: 'movie', limit: 30, searchError: false });
		expect(data.results).toHaveLength(3);
		expect(data.results[0]).toMatchObject({ href: `/movies/${movie(1).id}`, title: 'Movie 1' });
		expect(data.trending).toEqual([]);
		expect(data.genres).toEqual([]);
	});

	it('rejects a limit above the 30 result cap with a 400', async () => {
		await expect(load(event('?q=movie&limit=100'))).rejects.toMatchObject({ status: 400 });
		expect(mocks.searchLocalMovies).not.toHaveBeenCalled();
	});

	it('reports a search failure without throwing and logs it', async () => {
		mocks.searchLocalMovies.mockRejectedValue(new Error('database down'));

		const data = await load(event('?q=movie'));

		expect(data).toMatchObject({ query: 'movie', results: [], searchError: true });
		expect(mocks.logServerError).toHaveBeenCalledTimes(1);
	});

	it('rejects control characters and over-long queries with a 400', async () => {
		await expect(load(event('?q=bad%00query'))).rejects.toMatchObject({ status: 400 });
		await expect(load(event(`?q=${'a'.repeat(121)}`))).rejects.toMatchObject({ status: 400 });
		expect(mocks.searchLocalMovies).not.toHaveBeenCalled();
	});

	it('tolerates a trending failure and still returns the genres', async () => {
		mocks.getTrendingMovies.mockRejectedValue(new Error('trending down'));
		mocks.getGenres.mockResolvedValue([{ id: 18, name: 'Drama' }]);

		const data = await load(event());

		expect(data.trending).toEqual([]);
		expect(data.genres).toEqual([{ id: 18, name: 'Drama' }]);
		expect(data.searchError).toBe(false);
		expect(mocks.logServerError).toHaveBeenCalledTimes(1);
	});

	it('tolerates a genre failure and still returns the trending films', async () => {
		mocks.getTrendingMovies.mockResolvedValue([movie(1)]);
		mocks.getGenres.mockRejectedValue(new Error('genres down'));

		const data = await load(event());

		expect(data.trending).toHaveLength(1);
		expect(data.genres).toEqual([]);
		expect(mocks.logServerError).toHaveBeenCalledTimes(1);
	});

	it('survives both empty-state reads failing', async () => {
		mocks.getTrendingMovies.mockRejectedValue(new Error('a'));
		mocks.getGenres.mockRejectedValue(new Error('b'));

		const data = await load(event());

		expect(data).toMatchObject({ query: '', results: [], trending: [], genres: [] });
		expect(mocks.logServerError).toHaveBeenCalledTimes(2);
	});
});
