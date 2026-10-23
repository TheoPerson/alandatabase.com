import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFileRecord, PlayableFile, ProgressEntry } from '$lib/media/types';
import type { ContinueWatchingRow } from '$lib/server/media/repository';

const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getPlayableForMovie: vi.fn(),
	getPlayableForEpisodes: vi.fn(),
	getProgress: vi.fn()
}));
const catalogue = vi.hoisted(() => ({
	getLaunchMovie: vi.fn(),
	getLaunchShowForEpisode: vi.fn(),
	getParsedTitle: vi.fn()
}));

vi.mock('$lib/server/media/repository', async (importOriginal) => ({
	resolutionOf: (await importOriginal<typeof import('$lib/server/media/repository')>())
		.resolutionOf,
	...repo
}));
vi.mock('./catalogue', () => catalogue);

import { buildLaunchPayload, parseStartAt, toContinueCardItem } from './launch';

const USER = '00000000-0000-4000-8000-0000000000aa';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MOVIE = id(500);

function playable(fileId: string, extra: Partial<PlayableFile> = {}): PlayableFile {
	return {
		fileId,
		durationSeconds: 3600,
		resolution: '1080p',
		hdr: 'sdr',
		audio: [{ ordinal: 0, language: 'fre', title: null, channels: 6 }],
		subtitles: [],
		...extra
	};
}

function record(fileId: string, extra: Partial<MediaFileRecord> = {}): MediaFileRecord {
	return {
		id: fileId,
		path: 'F:\\MOVIES\\Secret.Name.2021.mkv',
		sizeBytes: 1,
		durationSeconds: 3600,
		video: {
			codec: 'hevc',
			profile: 'Main 10',
			pixFmt: null,
			width: 3840,
			height: 2160,
			hdr: 'hdr10'
		},
		audioTracks: [
			{ ordinal: 0, codec: 'eac3', channels: 6, language: 'fre', title: 'VFF', isDefault: true }
		],
		subtitleTracks: [
			{
				ordinal: 0,
				source: 'external',
				codec: 'subrip',
				language: 'eng',
				title: null,
				forced: false,
				isText: true
			}
		],
		movieId: null,
		episodeId: null,
		matchStatus: 'unmatched',
		...extra
	};
}

function progress(fileId: string, positionSeconds: number, completed = false): ProgressEntry {
	return {
		fileId,
		positionSeconds,
		durationSeconds: 3600,
		completed,
		updatedAt: '2026-10-16T20:00:00.000Z'
	};
}

const movie = {
	id: MOVIE,
	title: 'Dune',
	releaseDate: '2021-09-15',
	overview: 'Spice.',
	runtime: 155,
	originalLanguage: 'en',
	posterPath: '/p.jpg',
	backdropPath: '/b.jpg',
	logoPath: '/logo.png'
};

const show = {
	id: id(600),
	tmdbId: 66732,
	name: 'Stranger Things',
	firstAirDate: '2016-07-15',
	originalLanguage: 'en',
	posterPath: '/st.jpg',
	backdropPath: '/st-back.jpg'
};
const episode = (n: number, season: number, number: number, extra = {}) => ({
	id: id(n),
	seasonNumber: season,
	episodeNumber: number,
	name: `Chapter ${number}`,
	overview: null,
	stillPath: `/still-${season}-${number}.jpg`,
	airDate: '2025-11-26',
	runtime: 60,
	...extra
});

beforeEach(() => {
	for (const mock of [...Object.values(repo), ...Object.values(catalogue)]) mock.mockReset();
	repo.getProgress.mockResolvedValue([]);
});

describe('buildLaunchPayload: film', () => {
	it('queues the film alone with its artwork, link, file and progress', async () => {
		const fileId = id(1);
		repo.getMediaFile.mockResolvedValue(record(fileId, { movieId: MOVIE, matchStatus: 'matched' }));
		catalogue.getLaunchMovie.mockResolvedValue(movie);
		repo.getPlayableForMovie.mockResolvedValue([playable(id(2)), playable(fileId)]);
		repo.getProgress.mockResolvedValue([progress(fileId, 1200)]);

		const payload = await buildLaunchPayload(USER, fileId);

		expect(payload).toEqual({
			queue: [
				{
					fileId,
					kind: 'movie',
					title: 'Dune',
					showTitle: null,
					seasonNumber: null,
					episodeNumber: null,
					overview: 'Spice.',
					year: 2021,
					runtimeMinutes: 155,
					originalLanguage: 'en',
					artwork: {
						stillPath: '/b.jpg',
						backdropPath: '/b.jpg',
						posterPath: '/p.jpg',
						logoPath: '/logo.png'
					},
					titleHref: `/movies/${MOVIE}`,
					file: playable(fileId),
					progress: progress(fileId, 1200)
				}
			],
			index: 0,
			returnHref: `/movies/${MOVIE}`
		});
		expect(repo.getProgress).toHaveBeenCalledWith(USER, [fileId]);
	});

	it('is null when the film is not visible (same policy as its page) or the file is not listed', async () => {
		const fileId = id(1);
		repo.getMediaFile.mockResolvedValue(record(fileId, { movieId: MOVIE, matchStatus: 'matched' }));
		catalogue.getLaunchMovie.mockResolvedValue(null);
		repo.getPlayableForMovie.mockResolvedValue([playable(fileId)]);
		expect(await buildLaunchPayload(USER, fileId)).toBeNull();

		catalogue.getLaunchMovie.mockResolvedValue(movie);
		repo.getPlayableForMovie.mockResolvedValue([playable(id(2))]);
		expect(await buildLaunchPayload(USER, fileId)).toBeNull();
	});
});

describe('buildLaunchPayload: episode', () => {
	it('queues every local episode in (season, episode) order with the requested file in its slot', async () => {
		const requested = id(11);
		const episodes = [
			episode(101, 1, 1),
			episode(102, 1, 2),
			episode(103, 1, 3),
			episode(104, 2, 1, { name: null })
		];
		repo.getMediaFile.mockResolvedValue(
			record(requested, { episodeId: id(102), matchStatus: 'matched' })
		);
		catalogue.getLaunchShowForEpisode.mockResolvedValue({
			show,
			episode: episodes[1],
			episodes
		});
		repo.getPlayableForEpisodes.mockResolvedValue(
			new Map([
				[id(104), [playable(id(14))]],
				[id(102), [playable(id(12), { resolution: '2160p' }), playable(requested)]],
				[id(101), [playable(id(10))]]
			])
		);
		repo.getProgress.mockResolvedValue([progress(requested, 300), progress(id(10), 3500, true)]);

		const payload = await buildLaunchPayload(USER, requested);

		expect(payload?.queue.map((item) => item.fileId)).toEqual([id(10), requested, id(14)]);
		expect(payload?.index).toBe(1);
		expect(payload?.returnHref).toBe('/tv/66732?season=1');
		expect(payload?.queue[1]).toMatchObject({
			kind: 'episode',
			title: 'Chapter 2',
			showTitle: 'Stranger Things',
			seasonNumber: 1,
			episodeNumber: 2,
			year: 2025,
			runtimeMinutes: 60,
			originalLanguage: 'en',
			artwork: {
				stillPath: '/still-1-2.jpg',
				backdropPath: '/st-back.jpg',
				posterPath: '/st.jpg',
				logoPath: null
			},
			titleHref: '/tv/66732?season=1',
			progress: progress(requested, 300)
		});
		expect(payload?.queue[2]).toMatchObject({
			title: 'Episode 1',
			titleHref: '/tv/66732?season=2',
			progress: null
		});
		expect(payload?.queue[0].progress?.completed).toBe(true);
		expect(repo.getPlayableForEpisodes).toHaveBeenCalledWith(episodes.map((entry) => entry.id));
	});

	it('is null when the show is quarantined or the file is not playable', async () => {
		const requested = id(11);
		repo.getMediaFile.mockResolvedValue(
			record(requested, { episodeId: id(102), matchStatus: 'matched' })
		);
		catalogue.getLaunchShowForEpisode.mockResolvedValue(null);
		expect(await buildLaunchPayload(USER, requested)).toBeNull();

		catalogue.getLaunchShowForEpisode.mockResolvedValue({
			show,
			episode: episode(102, 1, 2),
			episodes: [episode(102, 1, 2)]
		});
		repo.getPlayableForEpisodes.mockResolvedValue(new Map([[id(102), [playable(id(12))]]]));
		expect(await buildLaunchPayload(USER, requested)).toBeNull();
	});
});

describe('buildLaunchPayload: unmatched and edge cases', () => {
	it('plays an unmatched file under its parsed title, without artwork', async () => {
		const fileId = id(21);
		repo.getMediaFile.mockResolvedValue(record(fileId));
		catalogue.getParsedTitle.mockResolvedValue({ title: 'Usyk vs Dubois 2', year: 2025 });

		const payload = await buildLaunchPayload(USER, fileId);

		expect(payload?.index).toBe(0);
		expect(payload?.returnHref).toBe('/my/films?tab=local');
		expect(payload?.queue[0]).toMatchObject({
			kind: 'movie',
			title: 'Usyk vs Dubois 2',
			year: 2025,
			artwork: { stillPath: null, backdropPath: null, posterPath: null, logoPath: null },
			titleHref: '/my/films?tab=local'
		});
		expect(payload?.queue[0].file).toEqual({
			fileId,
			durationSeconds: 3600,
			resolution: '2160p',
			hdr: 'hdr10',
			audio: [{ ordinal: 0, language: 'fre', title: 'VFF', channels: 6 }],
			subtitles: [{ ordinal: 0, language: 'eng', title: null, forced: false, isText: true }]
		});
	});

	it('never puts a library path or a codec in any payload', async () => {
		const fileId = id(21);
		repo.getMediaFile.mockResolvedValue(record(fileId));
		catalogue.getParsedTitle.mockResolvedValue(null);
		const payload = await buildLaunchPayload(USER, fileId);
		expect(payload?.queue[0].title).toBe('Untitled file');
		expect(JSON.stringify(payload)).not.toMatch(/MOVIES|Secret|\.mkv|"path"|eac3|subrip/iu);
	});

	it('is null for malformed or unknown ids without touching the catalogue', async () => {
		expect(await buildLaunchPayload(USER, 'not-a-uuid')).toBeNull();
		expect(repo.getMediaFile).not.toHaveBeenCalled();
		repo.getMediaFile.mockResolvedValue(null);
		expect(await buildLaunchPayload(USER, id(99))).toBeNull();
		expect(catalogue.getLaunchMovie).not.toHaveBeenCalled();
	});

	it('reads progress in bounded batches for long queues', async () => {
		const requested = id(1000);
		const episodes = Array.from({ length: 250 }, (_, index) => episode(2000 + index, 1, index + 1));
		repo.getMediaFile.mockResolvedValue(
			record(requested, { episodeId: episodes[0].id, matchStatus: 'matched' })
		);
		catalogue.getLaunchShowForEpisode.mockResolvedValue({ show, episode: episodes[0], episodes });
		repo.getPlayableForEpisodes.mockResolvedValue(
			new Map(
				episodes.map((entry, index) => [
					entry.id,
					[playable(index === 0 ? requested : id(3000 + index))]
				])
			)
		);
		const payload = await buildLaunchPayload(USER, requested);
		expect(payload?.queue).toHaveLength(250);
		expect(repo.getProgress).toHaveBeenCalledTimes(2);
		expect(repo.getProgress.mock.calls.every(([, ids]) => ids.length <= 200)).toBe(true);
	});
});

describe('parseStartAt', () => {
	it('accepts whole seconds from 0 to 86400', () => {
		expect(parseStartAt('0')).toBe(0);
		expect(parseStartAt('754')).toBe(754);
		expect(parseStartAt('86400')).toBe(86400);
	});

	it('resumes for anything else', () => {
		for (const value of [null, '', '-1', '86401', '1.5', '12abc', ' 12', '1e3', 'NaN'])
			expect(parseStartAt(value)).toBe('resume');
	});
});

describe('toContinueCardItem', () => {
	const base = {
		fileId: id(1),
		positionSeconds: 600,
		durationSeconds: 3060,
		updatedAt: '2026-10-16T20:00:00.000Z',
		posterPath: '/p.jpg',
		backdropPath: '/b.jpg'
	};

	it('describes an episode with its show, number and name', () => {
		const row: ContinueWatchingRow = {
			...base,
			kind: 'episode',
			title: 'Stranger Things',
			subtitle: 'S05E01 · Chapitre un',
			href: '/tv/66732',
			imagePath: '/still.jpg',
			movie: null,
			episode: {
				id: id(2),
				showId: id(3),
				showTmdbId: 66732,
				showName: 'Stranger Things',
				seasonNumber: 5,
				episodeNumber: 1,
				label: 'S05E01',
				name: 'Chapitre un',
				stillPath: '/still.jpg'
			}
		};
		expect(toContinueCardItem(row)).toEqual({
			fileId: id(1),
			href: `/watch/${id(1)}`,
			title: 'Stranger Things',
			eyebrow: 'S5 · E1 · Chapitre un',
			stillPath: '/still.jpg',
			progress: 600 / 3060,
			remainingLabel: '41 min left',
			ariaLabel: 'Resume Stranger Things, season 5 episode 1, Chapitre un, 41 minutes left'
		});
	});

	it('describes a film with its year and survives an unknown duration', () => {
		const row: ContinueWatchingRow = {
			...base,
			durationSeconds: null,
			kind: 'movie',
			title: 'Dune',
			subtitle: '2021',
			href: `/movies/${MOVIE}`,
			imagePath: '/b.jpg',
			movie: { id: MOVIE, tmdbId: 438631, title: 'Dune', releaseDate: '2021-09-15' },
			episode: null
		};
		expect(toContinueCardItem(row)).toEqual({
			fileId: id(1),
			href: `/watch/${id(1)}`,
			title: 'Dune',
			eyebrow: '2021',
			stillPath: '/b.jpg',
			progress: 0,
			remainingLabel: 'Resume',
			ariaLabel: 'Resume Dune'
		});
	});
});
