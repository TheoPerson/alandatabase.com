import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, getUserWatchlist } = vi.hoisted(() => ({
	findMany: vi.fn(),
	getUserWatchlist: vi.fn()
}));
vi.mock('$lib/server/db', () => ({ db: { query: { userLists: { findMany } } } }));
vi.mock('$lib/server/services/movie.service', () => ({ prepareStandardMovie: (m: unknown) => m }));
vi.mock('$lib/server/services/interaction.service', () => ({ getUserWatchlist }));
vi.mock('$lib/server/security/logging', () => ({ logServerError: vi.fn() }));

import { load } from './+page.server';

const run = () => (load as (event: unknown) => Promise<any>)({ locals: { user: { id: 'u1' } } });
const film = (id: string, posterPath: string | null) => ({
	movie: { id, title: `Film ${id}`, posterPath }
});

beforeEach(() => {
	vi.clearAllMocks();
	findMany.mockResolvedValue([]);
	getUserWatchlist.mockResolvedValue([
		film('a', '/a.jpg'),
		film('b', null),
		film('c', '/c.jpg'),
		film('d', '/d.jpg'),
		film('e', '/e.jpg'),
		film('f', '/f.jpg'),
		film('g', '/g.jpg')
	]);
});

describe('Lists index loader', () => {
	it('gives the empty state up to five watchlist posters, skipping films without one', async () => {
		const data = await run();
		expect(data.fan.map((poster: { id: string }) => poster.id)).toEqual(['a', 'c', 'd', 'e', 'f']);
	});

	it('does not read the watchlist once lists exist', async () => {
		findMany.mockResolvedValue([{ id: 'l1', items: [] }]);
		const data = await run();
		expect(data.fan).toEqual([]);
		expect(getUserWatchlist).not.toHaveBeenCalled();
	});

	it('keeps the page when the watchlist cannot be read', async () => {
		getUserWatchlist.mockRejectedValue(new Error('db down'));
		const data = await run();
		expect(data.fan).toEqual([]);
		expect(data.lists).toEqual([]);
	});
});
