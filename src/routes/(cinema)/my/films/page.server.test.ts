import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getUserWatchlist: vi.fn(),
	getUserFavorites: vi.fn(),
	getUserWatchedHistory: vi.fn()
}));
vi.mock('$lib/server/services/interaction.service', () => services);
const repo = vi.hoisted(() => ({
	getLibrarySummary: vi.fn(),
	listContinueWatching: vi.fn(),
	listLocalMovies: vi.fn(),
	listLocalShows: vi.fn()
}));
vi.mock('$lib/server/media/repository', () => repo);
const hqpCatalogue = vi.hoisted(() => ({ listUnmatchedFiles: vi.fn() }));
vi.mock('$lib/server/hqp/catalogue', () => hqpCatalogue);

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
const member = { id: 'member-1', role: 'member', username: 'guest', displayName: null };

beforeEach(() => {
	vi.clearAllMocks();
	services.getUserWatchlist.mockResolvedValue([movie('a'), movie('b')]);
	services.getUserFavorites.mockResolvedValue([movie('a')]);
	services.getUserWatchedHistory.mockResolvedValue([movie('c'), { movie: null }]);
	repo.getLibrarySummary.mockResolvedValue({ films: 2, episodes: 3, shows: 1, unmatched: 1 });
	repo.listContinueWatching.mockResolvedValue([]);
	repo.listLocalMovies.mockResolvedValue([]);
	repo.listLocalShows.mockResolvedValue([]);
	hqpCatalogue.listUnmatchedFiles.mockResolvedValue([]);
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
		expect(data.counts).toEqual({ watchlist: 2, favorites: 1, watched: 1, local: 3 });
	});

	it('computes the stats from watched films', async () => {
		const data = await run(owner);
		expect(data.stats).toEqual({
			watchedCount: 1,
			hours: 2,
			minutes: 120,
			topGenres: [{ name: 'Drama', count: 1 }],
			decades: [{ decade: 2010, count: 1 }]
		});
	});

	it('opens the tab named in the address, defaulting to the watchlist', async () => {
		expect((await run(owner, '?tab=stats')).tab).toBe('stats');
		expect((await run(owner, '?tab=nope')).tab).toBe('watchlist');
		expect((await run(owner, '?tab=local')).tab).toBe('local');
	});

	it('never ships the password hash or other account internals', async () => {
		const data = await run({ ...owner, passwordHash: 'secret', email: 'a@b.c' });
		expect(JSON.stringify(data)).not.toContain('secret');
		expect(JSON.stringify(data)).not.toContain('a@b.c');
	});
});

const FILE = '00000000-0000-4000-8000-0000000000f1';
const localFilm = (n: number) => ({
	id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
	href: `/movies/${n}`,
	title: `Film ${n}`,
	posterPath: '/p.jpg',
	releaseDate: '2024-01-01',
	rating: '7.0',
	genre: 'Drama',
	resolution: '2160p',
	hdr: 'hdr10',
	addedAt: '2026-10-16T20:00:00.000Z'
});

describe('Library loader: On this PC and Continue watching (owner only)', () => {
	it('gives the owner the Continue watching rail on every tab', async () => {
		repo.listContinueWatching.mockResolvedValue([
			{
				fileId: FILE,
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
				movie: null,
				episode: null
			}
		]);
		const data = await run(owner);
		expect(repo.listContinueWatching).toHaveBeenCalledWith('owner-1', 12);
		expect(data.continueWatching).toEqual([
			expect.objectContaining({ href: `/watch/${FILE}`, remainingLabel: '41 min left' })
		]);
		// The grids are only read on the local tab.
		expect(repo.listLocalMovies).not.toHaveBeenCalled();
		expect(data.local).toBeNull();
	});

	it('lists films, series with episode counts and unmatched files on the local tab', async () => {
		repo.listLocalMovies.mockResolvedValue([localFilm(1), localFilm(2)]);
		repo.listLocalShows.mockResolvedValue([
			{
				...localFilm(3),
				href: '/tv/250307',
				title: 'The Pitt',
				hdr: 'sdr',
				resolution: '1080p',
				episodeCount: 3
			}
		]);
		hqpCatalogue.listUnmatchedFiles.mockResolvedValue([
			{
				fileId: FILE,
				title: 'Usyk vs Dubois 2',
				year: 2025,
				durationSeconds: 3600,
				resolution: '1080p'
			}
		]);
		const data = await run(owner, '?tab=local');
		expect(repo.listLocalMovies).toHaveBeenCalledWith(48, 0);
		expect(data.local.summary).toEqual({ films: 2, episodes: 3, shows: 1, unmatched: 1 });
		expect(data.local.films[0]).toMatchObject({
			title: 'Film 1',
			quality: '4K · HDR10',
			episodeCount: null
		});
		expect(data.local.shows[0]).toMatchObject({
			href: '/tv/250307',
			quality: '1080p',
			episodeCount: 3
		});
		expect(data.local.unmatched[0]).toMatchObject({ fileId: FILE });
		expect(data.local.moreFilms).toBe(false);
	});

	it('reads one more page of 48 per Load more', async () => {
		repo.getLibrarySummary.mockResolvedValue({ films: 130, episodes: 0, shows: 0, unmatched: 0 });
		repo.listLocalMovies.mockImplementation(async (limit: number, offset: number) =>
			Array.from({ length: Math.max(0, Math.min(limit, 130 - offset)) }, (_, index) =>
				localFilm(offset + index)
			)
		);
		const data = await run(owner, '?tab=local&films=2');
		expect(repo.listLocalMovies.mock.calls).toEqual([
			[48, 0],
			[48, 48]
		]);
		expect(data.local.films).toHaveLength(96);
		expect(data.local.filmPages).toBe(2);
		expect(data.local.moreFilms).toBe(true);
	});

	it('keeps the page when the library is unreachable', async () => {
		repo.getLibrarySummary.mockRejectedValue(new Error('db down'));
		repo.listContinueWatching.mockRejectedValue(new Error('db down'));
		repo.listLocalMovies.mockRejectedValue(new Error('db down'));
		const data = await run(owner, '?tab=local');
		expect(data.continueWatching).toEqual([]);
		expect(data.local).toBeNull();
		expect(data.localError).toBe(true);
		expect(data.watchlist).toHaveLength(2);
	});

	it('never reads the library for a member, even with ?tab=local', async () => {
		const data = await run(member, '?tab=local');
		expect(data.tab).toBe('watchlist');
		expect(data.owner).toBe(false);
		for (const read of [...Object.values(repo), hqpCatalogue.listUnmatchedFiles]) {
			expect(read).not.toHaveBeenCalled();
		}
		expect(data.continueWatching).toEqual([]);
		expect(data.local).toBeNull();
		expect(data.counts.local).toBeNull();
		expect(JSON.stringify(data)).not.toContain('/watch/');
	});

	it('sends exact watch minutes and the latest watched posters for Stats', async () => {
		services.getUserWatchedHistory.mockResolvedValue([
			movie('w1', { runtime: 100 }),
			movie('w2', { runtime: 95 }),
			movie('w3', { runtime: null }),
			...Array.from({ length: 6 }, (_, index) => movie(`x${index}`, { runtime: 90 }))
		]);
		const data = await run(member, '?tab=stats');
		expect(data.stats.minutes).toBe(100 + 95 + 6 * 90);
		expect(data.recentWatched.map((item: { id: string }) => item.id)).toEqual([
			'w1',
			'w2',
			'w3',
			'x0',
			'x1',
			'x2'
		]);
	});
});
