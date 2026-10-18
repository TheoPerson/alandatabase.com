import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import {
	getExternalSubtitlePath,
	getLibrarySummary,
	getMediaFile,
	getPlayableForEpisodes,
	getPlayableForMovie,
	getProgress,
	isCompletedPosition,
	listContinueWatching,
	listLocalMovies,
	listLocalShows,
	nextEpisodeFile,
	saveProgress
} from './repository';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function one<T = { id: string }>(sql: string, params: unknown[] = []): Promise<T> {
	const { rows } = await pg.query<T>(sql, params);
	return rows[0];
}

interface FileOptions {
	movieId?: string | null;
	episodeId?: string | null;
	height?: number;
	hdr?: string;
	pixFmt?: string;
	bitRate?: number;
	status?: string;
	external?: boolean;
}

let fileCounter = 0;
async function insertFile(options: FileOptions = {}) {
	fileCounter++;
	const height = options.height ?? 1080;
	const video = {
		codec: 'hevc',
		profile: 'Main 10',
		pixFmt: options.pixFmt ?? 'yuv420p',
		width: Math.round((height * 16) / 9),
		height,
		hdr: options.hdr ?? 'sdr',
		bitRate: options.bitRate ?? 8_000_000
	};
	const audio = [
		{ ordinal: 0, codec: 'eac3', channels: 6, language: 'fre', title: 'VFF', isDefault: true },
		{ ordinal: 1, codec: 'eac3', channels: 6, language: 'eng', title: null, isDefault: false }
	];
	const subtitles: unknown[] = [
		{
			ordinal: 0,
			source: 'embedded',
			codec: 'subrip',
			language: 'fre',
			title: 'Forced',
			forced: true,
			isText: true
		}
	];
	const external: unknown[] = [];
	if (options.external) {
		subtitles.push({
			ordinal: 1,
			source: 'external',
			codec: 'subrip',
			language: 'eng',
			title: null,
			forced: false,
			isText: true
		});
		external.push({ ordinal: 1, path: `F:\\MOVIES\\file-${fileCounter}.en.srt`, language: 'eng' });
	}
	const row = await one(
		`insert into media_files (path, size_bytes, mtime_ms, duration_seconds, video, audio_tracks,
			subtitle_tracks, external_subtitles, movie_id, episode_id, match_status)
		 values ($1, $2, 1, 3600, $3, $4, $5, $6, $7, $8, $9) returning id`,
		[
			`F:\\MOVIES\\file-${fileCounter}.mkv`,
			1_000_000 + fileCounter,
			JSON.stringify(video),
			JSON.stringify(audio),
			JSON.stringify(subtitles),
			JSON.stringify(external),
			options.movieId ?? null,
			options.episodeId ?? null,
			options.status ?? (options.movieId || options.episodeId ? 'matched' : 'unmatched')
		]
	);
	return row.id;
}

async function insertMovie(tmdbId: number, title: string, adult = false) {
	return (
		await one(
			`insert into movies (tmdb_id, title, adult, poster_path, release_date, vote_average)
			 values ($1, $2, $3, '/poster.jpg', '2021-09-15', 7.8) returning id`,
			[tmdbId, title, adult]
		)
	).id;
}

async function insertShow(tmdbId: number, name: string) {
	return (
		await one(
			`insert into tv_shows (tmdb_id, name, poster_path, backdrop_path, first_air_date, vote_average)
			 values ($1, $2, '/show.jpg', '/show-back.jpg', '2025-01-09', 8.7) returning id`,
			[tmdbId, name]
		)
	).id;
}

async function insertEpisode(showId: string, season: number, episode: number) {
	const seasonRow = await one(
		`insert into tv_seasons (show_id, season_number) values ($1, $2)
		 on conflict (show_id, season_number) do update set season_number = excluded.season_number
		 returning id`,
		[showId, season]
	);
	return (
		await one(
			`insert into tv_episodes (show_id, season_id, season_number, episode_number, name, still_path)
			 values ($1, $2, $3, $4, $5, $6) returning id`,
			[
				showId,
				seasonRow.id,
				season,
				episode,
				`Episode ${episode}`,
				`/still-${season}-${episode}.jpg`
			]
		)
	).id;
}

let userId: string;
let otherUserId: string;
let dune: string;
let adultMovie: string;
let taggedMovie: string;
let pitt: string;
let quarantinedShow: string;
const ep: Record<string, string> = {};
const file: Record<string, string> = {};

beforeAll(async () => {
	userId = (
		await one(
			`insert into users (email, username, password_hash, role) values ('o@x.test', 'owner', 'x', 'owner') returning id`
		)
	).id;
	otherUserId = (
		await one(
			`insert into users (email, username, password_hash) values ('m@x.test', 'member', 'x') returning id`
		)
	).id;

	await pg.query(`insert into genres (id, name) values (878, 'Science-Fiction')`);
	await pg.query(
		`insert into keywords (id, name) values (738, 'explicit'), (256466, 'explicit 2')`
	);
	dune = await insertMovie(438631, 'Dune');
	await pg.query(`insert into movie_genres (movie_id, genre_id) values ($1, 878)`, [dune]);
	adultMovie = await insertMovie(999001, 'Adult Film', true);
	taggedMovie = await insertMovie(999002, 'Tagged Film');
	await pg.query(`insert into movie_keywords (movie_id, keyword_id) values ($1, 256466)`, [
		taggedMovie
	]);

	file.dune1080 = await insertFile({ movieId: dune, height: 1080, bitRate: 9_000_000 });
	file.dune2160sdr = await insertFile({ movieId: dune, height: 2160, bitRate: 20_000_000 });
	file.dune2160hdr = await insertFile({
		movieId: dune,
		height: 2160,
		hdr: 'hdr10',
		pixFmt: 'yuv420p10le',
		bitRate: 18_000_000,
		external: true
	});
	file.adult = await insertFile({ movieId: adultMovie });
	file.tagged = await insertFile({ movieId: taggedMovie });
	file.unmatched = await insertFile();
	file.ambiguous = await insertFile({ status: 'ambiguous' });

	pitt = await insertShow(250307, 'The Pitt');
	ep.s1e1 = await insertEpisode(pitt, 1, 1);
	ep.s1e2 = await insertEpisode(pitt, 1, 2);
	ep.s1e3 = await insertEpisode(pitt, 1, 3);
	ep.s2e1 = await insertEpisode(pitt, 2, 1);
	file.s1e1hd = await insertFile({ episodeId: ep.s1e1, height: 720 });
	file.s1e1fhd = await insertFile({ episodeId: ep.s1e1, height: 1080 });
	file.s1e2 = await insertFile({ episodeId: ep.s1e2 });
	file.s2e1 = await insertFile({ episodeId: ep.s2e1 });

	quarantinedShow = await insertShow(900001, 'Quarantined Show');
	await pg.query(`insert into tv_keywords (show_id, keyword_id) values ($1, 738)`, [
		quarantinedShow
	]);
	ep.q1 = await insertEpisode(quarantinedShow, 1, 1);
	ep.q2 = await insertEpisode(quarantinedShow, 1, 2);
	file.q1 = await insertFile({ episodeId: ep.q1 });
	file.q2 = await insertFile({ episodeId: ep.q2 });
});

afterAll(async () => {
	await pg.close();
});

describe('getMediaFile and getExternalSubtitlePath', () => {
	it('returns null for malformed or unknown ids', async () => {
		expect(await getMediaFile('not-a-uuid')).toBeNull();
		expect(await getMediaFile("'; drop table media_files; --")).toBeNull();
		expect(await getMediaFile(MISSING_ID)).toBeNull();
	});

	it('returns the server-side record with its path and tracks', async () => {
		const record = await getMediaFile(file.dune2160hdr);
		expect(record).toMatchObject({
			id: file.dune2160hdr,
			movieId: dune,
			episodeId: null,
			matchStatus: 'matched',
			durationSeconds: 3600
		});
		expect(record?.path).toMatch(/^F:\\MOVIES\\/u);
		expect(record?.video?.hdr).toBe('hdr10');
		expect(record?.audioTracks).toHaveLength(2);
		expect(record?.subtitleTracks.map((track) => track.source)).toEqual(['embedded', 'external']);
		expect(typeof record?.sizeBytes).toBe('number');
	});

	it('resolves only external subtitle ordinals', async () => {
		expect(await getExternalSubtitlePath(file.dune2160hdr, 1)).toMatch(/\.en\.srt$/u);
		expect(await getExternalSubtitlePath(file.dune2160hdr, 0)).toBeNull();
		expect(await getExternalSubtitlePath(file.dune2160hdr, -1)).toBeNull();
		expect(await getExternalSubtitlePath(file.dune2160hdr, 1.5)).toBeNull();
		expect(await getExternalSubtitlePath('bad', 1)).toBeNull();
		expect(await getExternalSubtitlePath(MISSING_ID, 1)).toBeNull();
	});
});

describe('playable files', () => {
	it('orders a film best first: resolution, then HDR, then bitrate', async () => {
		const files = await getPlayableForMovie(dune);
		expect(files.map((entry) => entry.fileId)).toEqual([
			file.dune2160hdr,
			file.dune2160sdr,
			file.dune1080
		]);
		expect(files[0]).toMatchObject({ resolution: '2160p', hdr: 'hdr10', durationSeconds: 3600 });
		expect(files[2].resolution).toBe('1080p');
	});

	it('never exposes paths, codecs or other server-only fields', async () => {
		const files = await getPlayableForMovie(dune);
		const text = JSON.stringify(files);
		expect(text).not.toMatch(/MOVIES|\.mkv|\.srt|path/iu);
		expect(Object.keys(files[0]).sort()).toEqual(
			['audio', 'durationSeconds', 'fileId', 'hdr', 'resolution', 'subtitles'].sort()
		);
		expect(files[0].audio[0]).toEqual({ ordinal: 0, language: 'fre', title: 'VFF', channels: 6 });
		expect(files[0].subtitles).toEqual([
			{ ordinal: 0, language: 'fre', title: 'Forced', forced: true, isText: true },
			{ ordinal: 1, language: 'eng', title: null, forced: false, isText: true }
		]);
	});

	it('fails closed for malformed ids and non-standard films', async () => {
		expect(await getPlayableForMovie('nope')).toEqual([]);
		expect(await getPlayableForMovie(adultMovie)).toEqual([]);
		expect(await getPlayableForMovie(taggedMovie)).toEqual([]);
	});

	it('maps episodes to their files, best first, skipping quarantined shows and bad ids', async () => {
		const map = await getPlayableForEpisodes([ep.s1e1, ep.s1e2, ep.s1e3, ep.q1, 'bad']);
		expect([...map.keys()].sort()).toEqual([ep.s1e1, ep.s1e2].sort());
		expect(map.get(ep.s1e1)?.map((entry) => entry.fileId)).toEqual([file.s1e1fhd, file.s1e1hd]);
		expect((await getPlayableForEpisodes([])).size).toBe(0);
	});
});

describe('library lists', () => {
	it('summarises standard films, episodes and shows, and files needing attention', async () => {
		expect(await getLibrarySummary()).toEqual({ films: 1, episodes: 3, shows: 1, unmatched: 2 });
	});

	it('lists local films and shows as poster items, standard only and bounded', async () => {
		const movies = await listLocalMovies(24, 0);
		expect(movies).toHaveLength(1);
		expect(movies[0]).toMatchObject({
			id: dune,
			href: `/movies/${dune}`,
			title: 'Dune',
			posterPath: '/poster.jpg',
			genre: 'Science-Fiction',
			resolution: '2160p',
			hdr: 'hdr10'
		});
		expect(await listLocalMovies(24, 1)).toEqual([]);
		expect(await listLocalMovies(Number.NaN, -5)).toHaveLength(1);

		const shows = await listLocalShows(24, 0);
		expect(shows).toHaveLength(1);
		expect(shows[0]).toMatchObject({
			id: pitt,
			href: '/tv/250307',
			title: 'The Pitt',
			posterPath: '/show.jpg'
		});
	});
});

describe('progress', () => {
	it('applies the completed rule: 92% of the duration or the last 3 minutes', () => {
		expect(isCompletedPosition(100, 3600)).toBe(false);
		expect(isCompletedPosition(3312, 3600)).toBe(true); // 92%
		expect(isCompletedPosition(1650, 1800)).toBe(true); // 91.7%, but 150 s left
		expect(isCompletedPosition(1600, 1800)).toBe(false); // 200 s left
		expect(isCompletedPosition(0, 120)).toBe(false); // never at the very start
		expect(isCompletedPosition(500, null)).toBe(false);
	});

	it('upserts one row per user and file and reads it back', async () => {
		const first = await saveProgress(userId, {
			fileId: file.dune1080,
			positionSeconds: 100,
			durationSeconds: 3600
		});
		expect(first).toMatchObject({ fileId: file.dune1080, positionSeconds: 100, completed: false });
		const second = await saveProgress(userId, {
			fileId: file.dune1080,
			positionSeconds: 3400,
			durationSeconds: 3600
		});
		expect(second?.completed).toBe(true);
		const { rows } = await pg.query(`select * from media_progress where file_id = $1`, [
			file.dune1080
		]);
		expect(rows).toHaveLength(1);

		const entries = await getProgress(userId, [file.dune1080, file.dune1080, 'bad', MISSING_ID]);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			fileId: file.dune1080,
			positionSeconds: 3400,
			durationSeconds: 3600,
			completed: true
		});
		expect(new Date(entries[0].updatedAt).toISOString()).toBe(entries[0].updatedAt);
		expect(await getProgress(otherUserId, [file.dune1080])).toEqual([]);
	});

	it('rejects invalid input and unknown files without writing', async () => {
		expect(
			await saveProgress(userId, { fileId: 'bad', positionSeconds: 1, durationSeconds: 2 })
		).toBeNull();
		expect(
			await saveProgress('bad', { fileId: file.dune1080, positionSeconds: 1, durationSeconds: 2 })
		).toBeNull();
		expect(
			await saveProgress(userId, { fileId: file.dune1080, positionSeconds: -1, durationSeconds: 2 })
		).toBeNull();
		expect(
			await saveProgress(userId, {
				fileId: file.dune1080,
				positionSeconds: Number.NaN,
				durationSeconds: 2
			})
		).toBeNull();
		expect(
			await saveProgress(userId, { fileId: MISSING_ID, positionSeconds: 1, durationSeconds: 2 })
		).toBeNull();
		const clamped = await saveProgress(userId, {
			fileId: file.s2e1,
			positionSeconds: 99999,
			durationSeconds: 3000
		});
		expect(clamped?.positionSeconds).toBe(3000);
		await pg.query(`delete from media_progress where file_id = $1`, [file.s2e1]);
	});
});

describe('continue watching', () => {
	it('lists unfinished films and the latest episode per show, newest first, standard only', async () => {
		await pg.query(`delete from media_progress`);
		const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
		const progress = [
			[file.dune2160hdr, 1200, false, at(30)],
			[file.s1e1fhd, 3500, true, at(20)],
			[file.s1e2, 600, false, at(10)],
			[file.s1e1hd, 300, false, at(40)],
			[file.q1, 100, false, at(1)],
			[file.adult, 100, false, at(2)]
		] as const;
		for (const [fileId, position, completed, updatedAt] of progress) {
			await pg.query(
				`insert into media_progress (user_id, file_id, position_seconds, duration_seconds, completed, updated_at)
				 values ($1, $2, $3, 3600, $4, $5)`,
				[userId, fileId, position, completed, updatedAt]
			);
		}
		const rows = await listContinueWatching(userId, 10);
		expect(rows.map((row) => row.fileId)).toEqual([file.s1e2, file.dune2160hdr]);
		expect(rows[0]).toMatchObject({
			kind: 'episode',
			title: 'The Pitt',
			subtitle: 'S01E02 · Episode 2',
			href: '/tv/250307',
			positionSeconds: 600,
			durationSeconds: 3600,
			imagePath: '/still-1-2.jpg',
			episode: { seasonNumber: 1, episodeNumber: 2, label: 'S01E02', showTmdbId: 250307 }
		});
		expect(rows[1]).toMatchObject({
			kind: 'movie',
			title: 'Dune',
			href: `/movies/${dune}`,
			imagePath: '/poster.jpg'
		});
		expect(JSON.stringify(rows)).not.toMatch(/MOVIES|\.mkv/u);
		expect(await listContinueWatching(userId, 1)).toHaveLength(1);
		expect(await listContinueWatching(otherUserId, 10)).toEqual([]);
		expect(await listContinueWatching('bad', 10)).toEqual([]);
	});
});

describe('nextEpisodeFile', () => {
	it('returns the next episode that has a file, across season boundaries', async () => {
		const next = await nextEpisodeFile(file.s1e1hd);
		expect(next?.fileId).toBe(file.s1e2);
		expect(next?.episode).toMatchObject({
			seasonNumber: 1,
			episodeNumber: 2,
			label: 'S01E02',
			showName: 'The Pitt'
		});

		const acrossSeasons = await nextEpisodeFile(file.s1e2); // S01E03 has no file
		expect(acrossSeasons?.fileId).toBe(file.s2e1);
		expect(acrossSeasons?.episode).toMatchObject({ seasonNumber: 2, episodeNumber: 1 });
	});

	it('returns null at the end, for films, quarantined shows and bad ids', async () => {
		expect(await nextEpisodeFile(file.s2e1)).toBeNull();
		expect(await nextEpisodeFile(file.dune1080)).toBeNull();
		expect(await nextEpisodeFile(file.q1)).toBeNull();
		expect(await nextEpisodeFile('bad')).toBeNull();
		expect(await nextEpisodeFile(MISSING_ID)).toBeNull();
	});

	it('picks the best file of the next episode', async () => {
		const ep2 = await insertEpisode(pitt, 0, 1); // a special never comes after S01
		await insertFile({ episodeId: ep2 });
		const fromSpecialSeason = await nextEpisodeFile(file.s1e1fhd);
		expect(fromSpecialSeason?.fileId).toBe(file.s1e2);
	});
});
