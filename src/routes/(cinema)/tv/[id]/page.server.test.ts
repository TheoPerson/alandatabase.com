import { beforeEach, describe, expect, it, vi } from 'vitest';

const tvDb = vi.hoisted(() => ({ getTvShowByTmdbId: vi.fn() }));
const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getPlayableForMovie: vi.fn(),
	getPlayableForEpisodes: vi.fn(),
	getProgress: vi.fn()
}));
vi.mock('$lib/server/services/tv-db.service', () => tvDb);
vi.mock('$lib/server/media/repository', () => repo);
// Signed-in loads read the series flags; covered in page.server.interaction.test.ts.
vi.mock('$lib/server/services/show-interaction.service', () => ({
	getShowInteraction: vi.fn(async () => ({ watchlist: false, favorite: false })),
	setShowFlag: vi.fn(),
	isShowFlag: vi.fn()
}));

import { load } from './+page.server';
import { TOP_50_IMDB_TV } from '$lib/server/services/tv.service';

const owner = { id: '00000000-0000-4000-8000-0000000000aa', role: 'owner', username: 'alan' };
const member = { id: '00000000-0000-4000-8000-0000000000bb', role: 'member', username: 'guest' };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = (tmdbId: string, user: unknown = null) =>
	(load as (event: unknown) => Promise<any>)({ params: { id: tmdbId }, locals: { user } });

const episode = (season: number, number: number, extra: Record<string, unknown> = {}) => ({
	id: id(season * 100 + number),
	seasonNumber: season,
	episodeNumber: number,
	name: `Chapter ${number}`,
	overview: 'Something happens.',
	stillPath: `/s${season}e${number}.jpg`,
	airDate: '2025-11-26',
	runtime: 52,
	voteAverage: null,
	...extra
});

const season = (number: number, episodes: ReturnType<typeof episode>[]) => ({
	id: id(9000 + number),
	seasonNumber: number,
	name: number === 0 ? 'Specials' : `Season ${number}`,
	overview: null,
	posterPath: null,
	airDate: '2025-11-26',
	episodeCount: episodes.length,
	episodes
});

// A show only the database knows (not on the IMDb chart).
const stored = {
	id: id(1),
	tmdbId: 250307,
	name: 'The Pitt',
	originalName: 'The Pitt',
	overview: 'The staff of a Pittsburgh trauma centre.',
	tagline: null,
	posterPath: '/pitt.jpg',
	backdropPath: '/pitt-b.jpg',
	firstAirDate: '2025-01-09',
	lastAirDate: '2026-04-16',
	status: 'Returning Series',
	numberOfSeasons: 3,
	numberOfEpisodes: 45,
	voteAverage: 8.6,
	voteCount: 700,
	popularity: 90,
	originalLanguage: 'en',
	imdbId: 'tt31938062',
	genres: ['Drama'],
	seasons: [
		season(0, [episode(0, 1)]),
		season(2, [episode(2, 1), episode(2, 2)]),
		season(1, [episode(1, 1), episode(1, 2)]),
		season(3, [])
	]
};

const playable = (fileId: string) => ({
	fileId,
	durationSeconds: 3000,
	resolution: '2160p',
	hdr: 'hdr10',
	audio: [],
	subtitles: []
});

beforeEach(() => {
	for (const mock of [tvDb.getTvShowByTmdbId, ...Object.values(repo)]) mock.mockReset();
	tvDb.getTvShowByTmdbId.mockResolvedValue(null);
	repo.getProgress.mockResolvedValue([]);
	repo.getPlayableForEpisodes.mockResolvedValue(new Map());
});

describe('TV series detail loader', () => {
	it('returns a chart series with its real snapshot fields', async () => {
		const entry = TOP_50_IMDB_TV[0];
		const data = await run(String(entry.tmdbId));
		expect(tvDb.getTvShowByTmdbId).toHaveBeenCalledWith(entry.tmdbId);
		expect(data.show).toMatchObject({
			tmdbId: entry.tmdbId,
			title: entry.title,
			rank: entry.rank,
			rating: entry.imdbRating,
			ratingSource: 'IMDb',
			years: entry.year,
			seasons: entry.seasons,
			posterPath: entry.posterPath,
			backdropPath: entry.backdropPath,
			genres: entry.genres
		});
		expect(data.seasons).toEqual([]);
		expect(data.local).toBeNull();
	});

	it('suggests up to 12 chart series that share a genre, never the series itself', async () => {
		const entry = TOP_50_IMDB_TV.find((show) => show.genres.includes('Drama'))!;
		const data = await run(String(entry.tmdbId));
		expect(data.similar.length).toBeGreaterThan(0);
		expect(data.similar.length).toBeLessThanOrEqual(12);
		for (const item of data.similar) {
			expect(item.href).not.toBe(`/tv/${entry.tmdbId}`);
			const other = TOP_50_IMDB_TV.find((show) => `/tv/${show.tmdbId}` === item.href)!;
			expect(other.genres.some((genre) => entry.genres.includes(genre))).toBe(true);
		}
	});

	it('shows a series only the catalogue database has, with ordered seasons and episodes', async () => {
		tvDb.getTvShowByTmdbId.mockResolvedValue(stored);
		const data = await run('250307');
		expect(data.show).toMatchObject({
			title: 'The Pitt',
			rank: null,
			rating: 8.6,
			ratingSource: 'TMDB',
			years: '2025–',
			firstYear: '2025',
			firstAirDate: '2025-01-09',
			seasons: 3,
			episodes: 45,
			overview: 'The staff of a Pittsburgh trauma centre.'
		});
		// Regular seasons in order, specials last, empty seasons left out.
		expect(data.seasons.map((entry: { seasonNumber: number }) => entry.seasonNumber)).toEqual([
			1, 2, 0
		]);
		expect(data.seasons[0].episodes[1]).toEqual({
			seasonNumber: 1,
			episodeNumber: 2,
			name: 'Chapter 2',
			overview: 'Something happens.',
			stillPath: '/s1e2.jpg',
			airDate: '2025-11-26',
			runtime: 52
		});
	});

	it('merges a chart series with its database seasons', async () => {
		const entry = TOP_50_IMDB_TV[0];
		tvDb.getTvShowByTmdbId.mockResolvedValue({ ...stored, tmdbId: entry.tmdbId, name: 'Other' });
		const data = await run(String(entry.tmdbId));
		expect(data.show).toMatchObject({ title: entry.title, rank: entry.rank, ratingSource: 'IMDb' });
		expect(data.seasons).toHaveLength(3);
	});

	it('still shows a chart series when the database read fails', async () => {
		const entry = TOP_50_IMDB_TV[0];
		tvDb.getTvShowByTmdbId.mockRejectedValue(new Error('db down'));
		const data = await run(String(entry.tmdbId));
		expect(data.show.title).toBe(entry.title);
		expect(data.seasons).toEqual([]);
	});

	it('fails with 500 when the database fails and the chart does not know the series', async () => {
		tvDb.getTvShowByTmdbId.mockRejectedValue(new Error('db down'));
		await expect(run('250307')).rejects.toMatchObject({ status: 500 });
	});

	it.each(['999999999', 'abc', '-1', '1.5', ''])('answers 404 for %s', async (value) => {
		await expect(run(value)).rejects.toMatchObject({ status: 404 });
	});
});

describe('TV series detail loader: episodes on this PC', () => {
	beforeEach(() => {
		tvDb.getTvShowByTmdbId.mockResolvedValue(stored);
		repo.getPlayableForEpisodes.mockResolvedValue(
			new Map([
				[id(101), [playable(id(5001))]],
				[id(102), [playable(id(5002))]]
			])
		);
	});

	it('gives the owner Play links for the local episodes and the series Play button', async () => {
		const data = await run('250307', owner);
		expect(repo.getPlayableForEpisodes).toHaveBeenCalledWith(
			expect.arrayContaining([id(101), id(102), id(201), id(1)])
		);
		expect(data.local.play).toMatchObject({ href: `/watch/${id(5001)}`, label: 'Play S1 E1' });
		expect(data.local.seasons).toEqual([
			{
				seasonNumber: 1,
				episodes: [
					expect.objectContaining({
						fileId: id(5001),
						episodeNumber: 1,
						href: `/watch/${id(5001)}`
					}),
					expect.objectContaining({ fileId: id(5002), episodeNumber: 2 })
				]
			}
		]);
	});

	it('resumes the episode being watched', async () => {
		repo.getProgress.mockResolvedValue([
			{
				fileId: id(5002),
				positionSeconds: 2280,
				durationSeconds: 3000,
				completed: false,
				updatedAt: '2026-10-16T21:00:00.000Z'
			}
		]);
		const data = await run('250307', owner);
		expect(data.local.resume).toEqual({ fileId: id(5002), label: 'Resume S1 E2 · 12 min left' });
	});

	it('keeps the page when the library read fails', async () => {
		repo.getPlayableForEpisodes.mockRejectedValue(new Error('db down'));
		const data = await run('250307', owner);
		expect(data.local).toBeNull();
		expect(data.seasons).toHaveLength(3);
	});

	it.each([
		['a member', member],
		['a visitor', null]
	])('never reads the library for %s and sends no file id', async (_label, user) => {
		const data = await run('250307', user);
		expect(data.local).toBeNull();
		for (const read of Object.values(repo)) expect(read).not.toHaveBeenCalled();
		const json = JSON.stringify(data);
		expect(json).not.toContain(id(5001));
		expect(json).not.toContain('/watch/');
	});
});
