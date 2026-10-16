import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getUserWatchlist: vi.fn(),
	getUserFavorites: vi.fn(),
	getUserWatchedHistory: vi.fn()
}));
vi.mock('$lib/server/services/interaction.service', () => services);

import { load } from './+page.server';

const movie = (id: string, extra: Record<string, unknown> = {}) => ({
	movie: {
		id,
		title: `Film ${id}`,
		posterPath: '/p.jpg',
		releaseDate: '2012-05-01',
		voteAverage: 7.5,
		runtime: 120,
		genres: [{ genre: { id: 18, name: 'Drama' } }],
		...extra
	}
});
const run = (user: unknown, search = '') =>
	(load as (event: unknown) => Promise<any>)({
		locals: { user },
		url: new URL(`https://alandatabase.com/my/films${search}`)
	});
const owner = { id: 'owner-1', role: 'owner', username: 'alan', displayName: 'Alan' };

beforeEach(() => {
	vi.clearAllMocks();
	services.getUserWatchlist.mockResolvedValue([movie('a'), movie('b')]);
	services.getUserFavorites.mockResolvedValue([movie('a')]);
	services.getUserWatchedHistory.mockResolvedValue([movie('c'), { movie: null }]);
});

describe('Library loader', () => {
	it('sends a visitor without a session to sign in and back', async () => {
		await expect(run(null)).rejects.toMatchObject({
			status: 302,
			location: '/auth/login?returnTo=%2Fmy%2Ffilms'
		});
		expect(services.getUserWatchlist).not.toHaveBeenCalled();
	});

	it("reads only the signed-in person's lists", async () => {
		await run(owner);
		for (const read of Object.values(services)) expect(read).toHaveBeenCalledWith('owner-1');
	});

	it('maps films to poster items and drops rows whose film is gone', async () => {
		const data = await run(owner);
		expect(data.watchlist.map((item: { href: string }) => item.href)).toEqual([
			'/movies/a',
			'/movies/b'
		]);
		expect(data.watched).toHaveLength(1);
		expect(data.counts).toEqual({ watchlist: 2, favorites: 1, watched: 1 });
	});

	it('computes the stats from watched films', async () => {
		const data = await run(owner);
		expect(data.stats).toEqual({
			watchedCount: 1,
			hours: 2,
			topGenres: [{ name: 'Drama', count: 1 }],
			decades: [{ decade: 2010, count: 1 }]
		});
	});

	it('opens the tab named in the address, defaulting to the watchlist', async () => {
		expect((await run(owner, '?tab=stats')).tab).toBe('stats');
		expect((await run(owner, '?tab=nope')).tab).toBe('watchlist');
	});

	it('never ships the password hash or other account internals', async () => {
		const data = await run({ ...owner, passwordHash: 'secret', email: 'a@b.c' });
		expect(JSON.stringify(data)).not.toContain('secret');
		expect(JSON.stringify(data)).not.toContain('a@b.c');
	});
});
