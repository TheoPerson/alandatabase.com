import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	listCatalogue: vi.fn(),
	getGenres: vi.fn(),
	logServerError: vi.fn()
}));

vi.mock('$lib/server/services/catalogue.service', () => ({
	listCatalogue: services.listCatalogue
}));
vi.mock('$lib/server/services/movie.service', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, getGenres: services.getGenres };
});
vi.mock('$lib/server/security/logging', () => ({ logServerError: services.logServerError }));

import { load } from './+page.server';

function movie(index: number) {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		title: `Movie ${index}`,
		posterPath: `/p${index}.jpg`,
		voteAverage: '7.5',
		releaseDate: '2001-01-01',
		genres: [{ genre: { id: 28, name: 'Action' } }]
	};
}

function run(search = '') {
	return load({
		url: new URL(`https://alandatabase.com/movies${search}`)
	} as unknown as Parameters<typeof load>[0]);
}

async function rejection(search: string) {
	try {
		await run(search);
	} catch (thrown) {
		return thrown as { status: number; body?: { message: string }; location?: string };
	}
	throw new Error('expected the loader to throw');
}

describe('browse loader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		services.listCatalogue.mockResolvedValue({ movies: [movie(1), movie(2)], totalCount: 178 });
		services.getGenres.mockResolvedValue([
			{ id: 28, name: 'Action' },
			{ id: 18, name: 'Drama' }
		]);
	});

	it('reads the first page of the whole catalogue by default', async () => {
		const data = await run();

		expect(services.listCatalogue).toHaveBeenCalledWith({
			page: 1,
			limit: 24,
			genreId: null,
			decade: null,
			minRating: null,
			sortBy: 'popularity'
		});
		expect(data.filters).toEqual({
			genreId: null,
			decade: null,
			minRating: null,
			sortBy: 'popularity'
		});
		expect(data.pagination).toEqual({ page: 1, pageSize: 24, totalCount: 178, totalPages: 8 });
		expect(data.unavailable).toBe(false);
	});

	it('maps films to poster cards and lists the genres for the filter chips', async () => {
		const data = await run();

		expect(data.items).toEqual([
			expect.objectContaining({
				id: movie(1).id,
				href: `/movies/${movie(1).id}`,
				title: 'Movie 1',
				posterPath: '/p1.jpg'
			}),
			expect.objectContaining({ id: movie(2).id, href: `/movies/${movie(2).id}` })
		]);
		expect(data.genres).toEqual([
			{ id: 28, name: 'Action' },
			{ id: 18, name: 'Drama' }
		]);
	});

	it('passes every filter, the sort and the page through to the catalogue', async () => {
		const data = await run('?genre=28&decade=2010&rating=7&sort=rating&page=2');

		expect(services.listCatalogue).toHaveBeenCalledWith({
			page: 2,
			limit: 24,
			genreId: 28,
			decade: 2010,
			minRating: 7,
			sortBy: 'rating'
		});
		expect(data.filters).toEqual({ genreId: 28, decade: 2010, minRating: 7, sortBy: 'rating' });
		expect(data.pagination.page).toBe(2);
	});

	it.each([
		['genre=abc', /Genre/],
		['genre=0', /Genre/],
		['decade=2015', /decade/i],
		['decade=1500', /Decade/],
		['rating=10', /Rating/],
		['sort=bogus', /sort/i],
		['page=0', /page/i],
		['page=99999', /page/i]
	])('rejects ?%s with a 400 and never reads the catalogue', async (query, message) => {
		const thrown = await rejection(`?${query}`);

		expect(thrown.status).toBe(400);
		expect(thrown.body?.message).toMatch(message);
		expect(services.listCatalogue).not.toHaveBeenCalled();
	});

	it('flags the catalogue as unavailable instead of throwing when the read fails', async () => {
		services.listCatalogue.mockRejectedValue(new Error('db down'));

		const data = await run('?genre=28');

		expect(data.unavailable).toBe(true);
		expect(data.items).toEqual([]);
		expect(data.pagination).toEqual({ page: 1, pageSize: 24, totalCount: 0, totalPages: 0 });
		expect(data.filters.genreId).toBe(28);
		// The genres still load, so the visitor can change the filters while the read recovers.
		expect(data.genres).toHaveLength(2);
		expect(services.logServerError).toHaveBeenCalled();
	});

	it('drops the genre chips rather than the page when the genre list fails', async () => {
		services.getGenres.mockRejectedValue(new Error('db down'));

		const data = await run();

		expect(data.genres).toEqual([]);
		expect(data.items).toHaveLength(2);
		expect(data.unavailable).toBe(false);
	});

	it('sends a page past the end to the last page, keeping the filters', async () => {
		const beyond = await rejection('?genre=28&page=9');

		expect(beyond.status).toBe(307);
		expect(beyond.location).toBe('/movies?genre=28&page=8');

		const first = await run('?page=8');
		expect(first.pagination.page).toBe(8);
	});

	it('shows an empty result as empty, not as an out-of-range page', async () => {
		services.listCatalogue.mockResolvedValue({ movies: [], totalCount: 0 });

		const data = await run('?genre=28&page=2');

		expect(data.items).toEqual([]);
		expect(data.pagination).toEqual({ page: 2, pageSize: 24, totalCount: 0, totalPages: 0 });
		expect(data.unavailable).toBe(false);
	});

	it('returns nothing personal: no user, no account state', async () => {
		const data = (await run()) as Record<string, unknown>;

		expect(Object.keys(data).sort()).toEqual([
			'filters',
			'genres',
			'items',
			'pagination',
			'unavailable'
		]);
	});
});
