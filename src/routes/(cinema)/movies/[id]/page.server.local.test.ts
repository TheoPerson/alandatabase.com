import { beforeEach, describe, expect, it, vi } from 'vitest';

// Alan's HQP on the film page: only the owner gets local copies; nobody else's load reads the
// media library at all.

const services = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	similarMovies: vi.fn(),
	collectionMovies: vi.fn(),
	getUserInteraction: vi.fn(),
	getUserMovieReviews: vi.fn()
}));
const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getPlayableForMovie: vi.fn(),
	getPlayableForEpisodes: vi.fn(),
	getProgress: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getMovieById: services.getMovieById,
	similarMovies: services.similarMovies,
	collectionMovies: services.collectionMovies
}));
vi.mock('$lib/server/services/interaction.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getUserInteraction: services.getUserInteraction,
	getUserMovieReviews: services.getUserMovieReviews
}));
vi.mock('$lib/server/media/repository', () => repo);

import { load } from './+page.server';

const MOVIE = '00000000-0000-4000-8000-000000000001';
const FILE_4K = '00000000-0000-4000-8000-0000000000f1';
const FILE_HD = '00000000-0000-4000-8000-0000000000f2';
const owner = { id: '00000000-0000-4000-8000-0000000000aa', role: 'owner', username: 'alan' };
const member = { id: '00000000-0000-4000-8000-0000000000bb', role: 'member', username: 'guest' };

const movie = {
	id: MOVIE,
	tmdbId: 27205,
	title: 'Inception',
	posterPath: '/p.jpg',
	backdropPath: '/b.jpg',
	releaseDate: '2010-07-16',
	runtime: 148,
	voteAverage: '8.4',
	metadata: {},
	genres: [],
	cast: [],
	crew: [],
	videos: [],
	watchProviders: []
};

const playable = (fileId: string, resolution: '2160p' | '1080p', hdr: 'hdr10' | 'sdr') => ({
	fileId,
	durationSeconds: 8880,
	resolution,
	hdr,
	audio: [
		{ ordinal: 0, language: 'fre', title: null, channels: 6 },
		{ ordinal: 1, language: 'eng', title: null, channels: 6 }
	],
	subtitles: []
});

const record = (fileId: string) => ({
	id: fileId,
	path: 'F:\\MOVIES\\Inception.2010.MULTi.2160p.mkv',
	sizeBytes: 1,
	durationSeconds: 8880,
	video: null,
	audioTracks: [
		{ ordinal: 0, codec: 'eac3', channels: 6, language: 'fre', title: null, isDefault: true },
		{ ordinal: 1, codec: 'eac3', channels: 6, language: 'eng', title: null, isDefault: false }
	],
	subtitleTracks: [],
	movieId: MOVIE,
	episodeId: null,
	matchStatus: 'matched'
});

function call(user: unknown) {
	return load({ params: { id: MOVIE }, locals: { user } } as unknown as Parameters<
		typeof load
	>[0]) as Promise<Record<string, unknown> & { local: any }>;
}

beforeEach(() => {
	for (const mock of [...Object.values(services), ...Object.values(repo)]) mock.mockReset();
	services.getMovieById.mockResolvedValue(movie);
	services.similarMovies.mockResolvedValue([]);
	services.collectionMovies.mockResolvedValue([]);
	services.getUserInteraction.mockResolvedValue(null);
	services.getUserMovieReviews.mockResolvedValue([]);
	repo.getPlayableForMovie.mockResolvedValue([
		playable(FILE_4K, '2160p', 'hdr10'),
		playable(FILE_HD, '1080p', 'sdr')
	]);
	repo.getMediaFile.mockImplementation(async (fileId: string) => record(fileId));
	repo.getProgress.mockResolvedValue([]);
});

describe('film page: the owner local copies', () => {
	it('gives the owner Play on the best copy, its quality line and both versions', async () => {
		const data = await call(owner);
		expect(repo.getPlayableForMovie).toHaveBeenCalledWith(MOVIE);
		expect(data.local.play).toEqual({
			fileId: FILE_4K,
			href: `/watch/${FILE_4K}`,
			label: 'Play',
			progress: 0,
			startOverHref: null
		});
		expect(data.local.quality).toBe('4K · HDR10 · Dolby Digital Plus 5.1 · French, English');
		expect(data.local.versions.map((version: { href: string }) => version.href)).toEqual([
			`/watch/${FILE_4K}`,
			`/watch/${FILE_HD}`
		]);
	});

	it('offers Resume with the time left and Start over from saved progress', async () => {
		repo.getProgress.mockResolvedValue([
			{
				fileId: FILE_HD,
				positionSeconds: 6420,
				durationSeconds: 8880,
				completed: false,
				updatedAt: '2026-10-16T20:00:00.000Z'
			}
		]);
		const data = await call(owner);
		expect(data.local.play).toMatchObject({
			fileId: FILE_HD,
			label: 'Resume · 41 min left',
			startOverHref: `/watch/${FILE_HD}?t=0`
		});
		expect(data.local.progress).toMatchObject({ fileId: FILE_HD, positionSeconds: 6420 });
	});

	it('never sends a library path or codec name to the page', async () => {
		const data = await call(owner);
		const json = JSON.stringify(data);
		expect(json).not.toContain('F:\\\\MOVIES');
		expect(json).not.toContain('.mkv');
		expect(json).not.toContain('"path"');
	});

	it('is null when no copy is on this PC', async () => {
		repo.getPlayableForMovie.mockResolvedValue([]);
		expect((await call(owner)).local).toBeNull();
	});

	it('keeps the page when the library read fails', async () => {
		repo.getPlayableForMovie.mockRejectedValue(new Error('db down'));
		const data = await call(owner);
		expect(data.local).toBeNull();
		expect(data.hero).toMatchObject({ title: 'Inception' });
	});

	it.each([
		['a member', member],
		['a visitor', null]
	])('never reads the library for %s and sends no file id', async (_label, user) => {
		const data = await call(user);
		expect(data.local).toBeNull();
		for (const read of Object.values(repo)) expect(read).not.toHaveBeenCalled();
		const json = JSON.stringify(data);
		expect(json).not.toContain(FILE_4K);
		expect(json).not.toContain('/watch/');
	});
});
