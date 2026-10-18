import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFileRecord, PlayableFile, ProgressEntry } from '$lib/media/types';

const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getPlayableForMovie: vi.fn(),
	getPlayableForEpisodes: vi.fn(),
	getProgress: vi.fn()
}));
vi.mock('$lib/server/media/repository', () => repo);

import { getLocalFilm, getLocalShow, type EpisodeSource } from './local';

const USER = '00000000-0000-4000-8000-0000000000aa';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const playable = (fileId: string, extra: Partial<PlayableFile> = {}): PlayableFile => ({
	fileId,
	durationSeconds: 3600,
	resolution: '1080p',
	hdr: 'sdr',
	audio: [{ ordinal: 0, language: 'fre', title: null, channels: 6 }],
	subtitles: [],
	...extra
});

const record = (fileId: string, codec = 'eac3'): Partial<MediaFileRecord> => ({
	id: fileId,
	path: 'F:\\MOVIES\\x.mkv',
	audioTracks: [
		{ ordinal: 0, codec, channels: 6, language: 'fre', title: null, isDefault: true },
		{ ordinal: 1, codec, channels: 6, language: 'eng', title: null, isDefault: false }
	]
});

const entry = (
	fileId: string,
	positionSeconds: number,
	updatedAt: string,
	completed = false
): ProgressEntry => ({ fileId, positionSeconds, durationSeconds: 3600, completed, updatedAt });

beforeEach(() => {
	for (const mock of Object.values(repo)) mock.mockReset();
	repo.getProgress.mockResolvedValue([]);
	repo.getMediaFile.mockImplementation(async (fileId: string) => record(fileId));
});

describe('getLocalFilm', () => {
	it('is null without a local copy', async () => {
		repo.getPlayableForMovie.mockResolvedValue([]);
		expect(await getLocalFilm(USER, id(500))).toBeNull();
		expect(repo.getProgress).not.toHaveBeenCalled();
	});

	it('plays the best copy with its quality line and lists every version', async () => {
		repo.getPlayableForMovie.mockResolvedValue([
			playable(id(1), { resolution: '2160p', hdr: 'hdr10' }),
			playable(id(2))
		]);
		const local = await getLocalFilm(USER, id(500));
		expect(local?.play).toEqual({
			fileId: id(1),
			href: `/watch/${id(1)}`,
			label: 'Play',
			progress: 0,
			startOverHref: null
		});
		expect(local?.quality).toBe('4K · HDR10 · Dolby Digital Plus 5.1 · French, English');
		expect(local?.versions.map((version) => version.label)).toEqual([
			'4K · HDR10 · Dolby Digital Plus 5.1 · French, English',
			'1080p · Dolby Digital Plus 5.1 · French, English'
		]);
		expect(local?.versions[0].best).toBe(true);
		expect(JSON.stringify(local)).not.toMatch(/MOVIES|\.mkv|eac3/iu);
	});

	it('resumes the copy being watched, with Start over', async () => {
		repo.getPlayableForMovie.mockResolvedValue([playable(id(1)), playable(id(2))]);
		repo.getProgress.mockResolvedValue([
			entry(id(1), 100, '2026-10-01T10:00:00.000Z', true),
			entry(id(2), 1140, '2026-10-02T10:00:00.000Z')
		]);
		const local = await getLocalFilm(USER, id(500));
		expect(local?.progress?.fileId).toBe(id(2));
		expect(local?.play).toEqual({
			fileId: id(2),
			href: `/watch/${id(2)}`,
			label: 'Resume · 41 min left',
			progress: 1140 / 3600,
			startOverHref: `/watch/${id(2)}?t=0`
		});
	});

	it('plays from the start again once the latest viewing is completed', async () => {
		repo.getPlayableForMovie.mockResolvedValue([playable(id(1))]);
		repo.getProgress.mockResolvedValue([entry(id(1), 3500, '2026-10-02T10:00:00.000Z', true)]);
		const local = await getLocalFilm(USER, id(500));
		expect(local?.play.label).toBe('Play');
		expect(local?.progress?.completed).toBe(true);
	});
});

describe('getLocalShow', () => {
	const episodes: EpisodeSource[] = [
		{
			id: id(100),
			seasonNumber: 0,
			episodeNumber: 1,
			name: 'Special',
			stillPath: null,
			runtime: 20
		},
		{
			id: id(101),
			seasonNumber: 1,
			episodeNumber: 1,
			name: 'Pilot',
			stillPath: '/s1.jpg',
			runtime: 50
		},
		{ id: id(102), seasonNumber: 1, episodeNumber: 2, name: null, stillPath: null, runtime: null },
		{ id: id(103), seasonNumber: 1, episodeNumber: 3, name: 'Three', stillPath: null, runtime: 50 },
		{ id: id(201), seasonNumber: 2, episodeNumber: 1, name: 'Back', stillPath: null, runtime: 50 }
	];

	beforeEach(() => {
		repo.getPlayableForEpisodes.mockResolvedValue(
			new Map([
				[id(100), [playable(id(10))]],
				[id(101), [playable(id(11), { resolution: '2160p' }), playable(id(21))]],
				[id(102), [playable(id(12))]],
				[id(201), [playable(id(13))]]
			])
		);
	});

	it('groups local episodes by season, regular seasons first and specials last', async () => {
		const local = await getLocalShow(USER, episodes);
		expect(local?.seasons.map((season) => season.seasonNumber)).toEqual([1, 2, 0]);
		expect(local?.seasons[0].episodes.map((row) => row.episodeNumber)).toEqual([1, 2]);
		expect(local?.seasons[0].episodes[1]).toEqual({
			fileId: id(12),
			episodeNumber: 2,
			title: 'Episode 2',
			stillPath: null,
			runtimeMinutes: null,
			progress: 0,
			completed: false,
			href: `/watch/${id(12)}`,
			remainingLabel: null,
			resolution: '1080p'
		});
		expect(local?.episodeCount).toBe(4);
		expect(local?.play?.label).toBe('Play S1 E1');
		expect(local?.resume).toEqual({ fileId: id(11), label: 'Play S1 E1' });
	});

	it('resumes the most recently watched unfinished episode, on the copy that was watched', async () => {
		repo.getProgress.mockResolvedValue([
			entry(id(21), 2880, '2026-10-03T10:00:00.000Z'),
			entry(id(12), 300, '2026-10-01T10:00:00.000Z')
		]);
		const local = await getLocalShow(USER, episodes);
		expect(local?.seasons[0].episodes[0]).toMatchObject({
			fileId: id(21),
			progress: 0.8,
			remainingLabel: '12 min left'
		});
		expect(local?.play).toEqual({
			fileId: id(21),
			href: `/watch/${id(21)}`,
			label: 'Resume S1 E1 · 12 min left',
			progress: 0.8,
			startOverHref: `/watch/${id(21)}?t=0`
		});
	});

	it('falls back to the first episode not completed', async () => {
		repo.getProgress.mockResolvedValue([entry(id(11), 3500, '2026-10-03T10:00:00.000Z', true)]);
		const local = await getLocalShow(USER, episodes);
		expect(local?.seasons[0].episodes[0]).toMatchObject({ completed: true, progress: 1 });
		expect(local?.play?.label).toBe('Play S1 E2');
		expect(local?.play?.startOverHref).toBeNull();
	});

	it('is null when nothing is on this PC', async () => {
		repo.getPlayableForEpisodes.mockResolvedValue(new Map());
		expect(await getLocalShow(USER, episodes)).toBeNull();
		expect(await getLocalShow(USER, [])).toBeNull();
	});
});
