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
	getLaunchMovie,
	getLaunchShowForEpisode,
	getParsedTitle,
	listUnmatchedFiles
} from './catalogue';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function one<T = { id: string }>(sql: string, params: unknown[] = []): Promise<T> {
	const { rows } = await pg.query<T>(sql, params);
	return rows[0];
}

let counter = 0;
async function insertFile(link: {
	movieId?: string;
	episodeId?: string;
	parsed?: unknown;
	status?: string;
}) {
	counter++;
	return (
		await one(
			`insert into media_files (path, size_bytes, mtime_ms, duration_seconds, video, movie_id,
				episode_id, match_status, parsed)
			 values ($1, 1000, 1, 3600, $2, $3, $4, $5, $6) returning id`,
			[
				`F:\\MOVIES\\catalogue-${counter}.mkv`,
				JSON.stringify({ codec: 'hevc', width: 3840, height: 2160, hdr: 'hdr10', pixFmt: null }),
				link.movieId ?? null,
				link.episodeId ?? null,
				link.status ?? (link.movieId || link.episodeId ? 'matched' : 'unmatched'),
				link.parsed === undefined ? null : JSON.stringify(link.parsed)
			]
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
			`insert into tv_episodes (show_id, season_id, season_number, episode_number, name, runtime)
			 values ($1, $2, $3, $4, $5, 50) returning id`,
			[showId, seasonRow.id, season, episode, `Episode ${season}.${episode}`]
		)
	).id;
}

const ids: Record<string, string> = {};

beforeAll(async () => {
	ids.dune = (
		await one(
			`insert into movies (tmdb_id, title, overview, runtime, original_language, poster_path,
				backdrop_path, release_date, metadata)
			 values (438631, 'Dune', 'Spice.', 155, 'en', '/p.jpg', '/b.jpg', '2021-09-15',
				'{"logoPath":"/logo.png"}') returning id`
		)
	).id;
	ids.adult = (
		await one(
			`insert into movies (tmdb_id, title, adult) values (999001, 'Adult Film', true) returning id`
		)
	).id;
	ids.show = (
		await one(
			`insert into tv_shows (tmdb_id, name, poster_path, backdrop_path, first_air_date, original_language)
			 values (66732, 'Stranger Things', '/st.jpg', '/st-back.jpg', '2016-07-15', 'en') returning id`
		)
	).id;
	await pg.query(`insert into keywords (id, name) values (738, 'explicit')`);
	ids.quarantined = (
		await one(`insert into tv_shows (tmdb_id, name) values (900001, 'Hidden') returning id`)
	).id;
	await pg.query(`insert into tv_keywords (show_id, keyword_id) values ($1, 738)`, [
		ids.quarantined
	]);
	ids.s2e1 = await insertEpisode(ids.show, 2, 1);
	ids.s1e2 = await insertEpisode(ids.show, 1, 2);
	ids.s1e1 = await insertEpisode(ids.show, 1, 1);
	ids.special = await insertEpisode(ids.show, 0, 1);
	ids.hidden = await insertEpisode(ids.quarantined, 1, 1);

	ids.unmatchedB = await insertFile({
		parsed: { kind: 'movie', title: 'Usyk vs Dubois 2', year: 2025 }
	});
	ids.unmatchedA = await insertFile({
		parsed: { kind: 'unknown', title: 'Formula 1 GP', year: null },
		status: 'ambiguous'
	});
	ids.noParse = await insertFile({});
	ids.matched = await insertFile({ movieId: ids.dune, parsed: { kind: 'movie', title: 'Dune' } });
});

afterAll(async () => {
	await pg.close();
});

describe('getLaunchMovie', () => {
	it('returns the display fields of a standard film, logo included', async () => {
		expect(await getLaunchMovie(ids.dune)).toEqual({
			id: ids.dune,
			title: 'Dune',
			releaseDate: '2021-09-15',
			overview: 'Spice.',
			runtime: 155,
			originalLanguage: 'en',
			posterPath: '/p.jpg',
			backdropPath: '/b.jpg',
			logoPath: '/logo.png'
		});
	});

	it('fails closed for adult, unknown and malformed ids', async () => {
		expect(await getLaunchMovie(ids.adult)).toBeNull();
		expect(await getLaunchMovie(MISSING_ID)).toBeNull();
		expect(await getLaunchMovie("1' or '1'='1")).toBeNull();
	});
});

describe('getLaunchShowForEpisode', () => {
	it('returns the show and its regular episodes in (season, episode) order', async () => {
		const result = await getLaunchShowForEpisode(ids.s1e2);
		expect(result?.show).toMatchObject({ tmdbId: 66732, name: 'Stranger Things' });
		expect(result?.episode.id).toBe(ids.s1e2);
		expect(result?.episodes.map((episode) => episode.id)).toEqual([ids.s1e1, ids.s1e2, ids.s2e1]);
		expect(result?.episodes[0]).toMatchObject({ seasonNumber: 1, episodeNumber: 1, runtime: 50 });
	});

	it('keeps specials with specials', async () => {
		const result = await getLaunchShowForEpisode(ids.special);
		expect(result?.episodes.map((episode) => episode.id)).toEqual([ids.special]);
	});

	it('fails closed for quarantined shows and bad ids', async () => {
		expect(await getLaunchShowForEpisode(ids.hidden)).toBeNull();
		expect(await getLaunchShowForEpisode(MISSING_ID)).toBeNull();
		expect(await getLaunchShowForEpisode('nope')).toBeNull();
	});
});

describe('unmatched files', () => {
	it('reads a parsed title', async () => {
		expect(await getParsedTitle(ids.unmatchedB)).toEqual({ title: 'Usyk vs Dubois 2', year: 2025 });
		expect(await getParsedTitle(ids.noParse)).toBeNull();
		expect(await getParsedTitle('bad')).toBeNull();
	});

	it('lists unmatched and ambiguous files by title, without paths', async () => {
		const list = await listUnmatchedFiles();
		expect(list.map((entry) => entry.fileId)).toEqual([
			ids.unmatchedA,
			ids.noParse,
			ids.unmatchedB
		]);
		expect(list[0]).toEqual({
			fileId: ids.unmatchedA,
			title: 'Formula 1 GP',
			year: null,
			durationSeconds: 3600,
			resolution: '2160p'
		});
		expect(list[1].title).toBe('Untitled file');
		expect(JSON.stringify(list)).not.toMatch(/MOVIES|\.mkv|path/iu);
	});
});
