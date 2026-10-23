import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { KNOWN_EXPLICIT_KEYWORD_IDS } from '../policies/standard-content';
import {
	getTvShowById,
	getTvShowByTmdbId,
	listTvShows,
	MAX_TV_PAGE_SIZE,
	prepareStandardTvShow,
	searchTvShows
} from './tv-db.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

interface ShowOptions {
	adult?: boolean;
	popularity?: number;
	overrides?: Record<string, unknown> | null;
	firstAirDate?: string | null;
	originalName?: string | null;
}

async function insertShow(tmdbId: number, name: string, options: ShowOptions = {}) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into tv_shows (tmdb_id, name, original_name, overview, poster_path, adult, popularity,
			first_air_date, local_overrides)
		 values ($1, $2, $3, 'Overview', '/p.jpg', $4, $5, $6, $7) returning id`,
		[
			tmdbId,
			name,
			options.originalName ?? null,
			options.adult ?? false,
			options.popularity ?? 10,
			options.firstAirDate === undefined ? '2016-07-15' : options.firstAirDate,
			options.overrides ? JSON.stringify(options.overrides) : null
		]
	);
	return rows[0].id;
}

async function insertSeason(showId: string, seasonNumber: number, episodes: number[]) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into tv_seasons (show_id, season_number, name) values ($1, $2, $3) returning id`,
		[showId, seasonNumber, `Season ${seasonNumber}`]
	);
	for (const episodeNumber of episodes) {
		await pg.query(
			`insert into tv_episodes (show_id, season_id, season_number, episode_number, name)
			 values ($1, $2, $3, $4, $5)`,
			[showId, rows[0].id, seasonNumber, episodeNumber, `Episode ${episodeNumber}`]
		);
	}
	return rows[0].id;
}

let standardId: string;
let quarantinedId: string;

beforeAll(async () => {
	await pg.query(`insert into genres (id, name) values (10765, 'Sci-Fi & Fantasy')`);
	await pg.query(`insert into keywords (id, name) values ($1, 'explicit'), (42, 'harmless')`, [
		KNOWN_EXPLICIT_KEYWORD_IDS[0]
	]);

	standardId = await insertShow(66732, 'Stranger Things', {
		popularity: 90,
		originalName: 'Stranger Things',
		overrides: { name: 'Stranger Things (VF)', firstAirDate: '2016-07-16' }
	});
	await pg.query(`insert into tv_genres (show_id, genre_id) values ($1, 10765)`, [standardId]);
	await pg.query(`insert into tv_keywords (show_id, keyword_id) values ($1, 42)`, [standardId]);
	// Inserted out of order on purpose: reads must sort seasons and episodes.
	await insertSeason(standardId, 2, [2, 1]);
	await insertSeason(standardId, 1, [3, 1, 2]);

	await insertShow(250307, 'The Pitt', { popularity: 50, firstAirDate: null });

	quarantinedId = await insertShow(900001, 'Quarantined Show', { popularity: 99 });
	await pg.query(`insert into tv_keywords (show_id, keyword_id) values ($1, $2)`, [
		quarantinedId,
		KNOWN_EXPLICIT_KEYWORD_IDS[0]
	]);
	await insertSeason(quarantinedId, 1, [1]);
	await insertShow(900002, 'Adult Show', { adult: true, popularity: 98 });
	await insertShow(-7, 'Custom Show', { popularity: 97 });
});

afterAll(async () => {
	await pg.close();
});

describe('prepareStandardTvShow', () => {
	it('fails closed without keyword classification and strips it otherwise', () => {
		expect(prepareStandardTvShow({ adult: false, tmdbId: 1, name: 'A' })).toBeNull();
		const prepared = prepareStandardTvShow({
			adult: false,
			tmdbId: 1,
			name: 'A',
			keywords: [],
			localOverrides: { name: 'B', numberOfSeasons: 9 }
		});
		expect(prepared).not.toBeNull();
		expect(prepared).not.toHaveProperty('keywords');
		expect(prepared).not.toHaveProperty('localOverrides');
		expect(prepared?.name).toBe('B');
		// Only text fields can be overridden: a count is never synthesised from overrides.
		expect(prepared).not.toHaveProperty('numberOfSeasons');
	});

	it('rejects adult, custom and explicitly tagged shows', () => {
		expect(prepareStandardTvShow({ adult: true, tmdbId: 1, keywords: [] })).toBeNull();
		expect(prepareStandardTvShow({ adult: false, tmdbId: -1, keywords: [] })).toBeNull();
		expect(
			prepareStandardTvShow({
				adult: false,
				tmdbId: 1,
				keywords: [{ keywordId: KNOWN_EXPLICIT_KEYWORD_IDS[1] }]
			})
		).toBeNull();
	});
});

describe('getTvShowByTmdbId', () => {
	it('returns the show with ordered seasons and episodes, overrides applied, no keywords', async () => {
		const show = await getTvShowByTmdbId(66732);
		expect(show).not.toBeNull();
		expect(show?.id).toBe(standardId);
		expect(show?.name).toBe('Stranger Things (VF)');
		expect(show?.firstAirDate).toBe('2016-07-16');
		expect(show?.genres).toEqual(['Sci-Fi & Fantasy']);
		expect(show).not.toHaveProperty('keywords');
		expect(show).not.toHaveProperty('localOverrides');
		expect(show).not.toHaveProperty('adult');
		expect(show?.seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
		expect(show?.seasons[0].episodes.map((episode) => episode.episodeNumber)).toEqual([1, 2, 3]);
		expect(show?.seasons[1].episodes.map((episode) => episode.episodeNumber)).toEqual([1, 2]);
	});

	it('keeps unknown dates and counts null instead of synthesising them', async () => {
		const show = await getTvShowByTmdbId(250307);
		expect(show?.firstAirDate).toBeNull();
		expect(show?.lastAirDate).toBeNull();
		expect(show?.numberOfSeasons).toBeNull();
		expect(show?.numberOfEpisodes).toBeNull();
		expect(show?.voteCount).toBeNull();
		expect(show?.seasons).toEqual([]);
	});

	it('makes quarantined, adult and custom shows unreachable', async () => {
		expect(await getTvShowByTmdbId(900001)).toBeNull();
		expect(await getTvShowByTmdbId(900002)).toBeNull();
		expect(await getTvShowByTmdbId(-7)).toBeNull();
		expect(await getTvShowById(quarantinedId)).toBeNull();
	});

	it('returns null for malformed identifiers without querying', async () => {
		for (const bad of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
			expect(await getTvShowByTmdbId(bad)).toBeNull();
		}
		expect(await getTvShowById('not-a-uuid')).toBeNull();
		expect(await getTvShowById("1' or '1'='1")).toBeNull();
	});

	it('also resolves a standard show by its row id', async () => {
		expect((await getTvShowById(standardId))?.tmdbId).toBe(66732);
	});
});

describe('listTvShows', () => {
	it('lists standard shows only, by popularity', async () => {
		const shows = await listTvShows(10, 0);
		expect(shows.map((show) => show.tmdbId)).toEqual([66732, 250307]);
		expect(shows[0]).not.toHaveProperty('keywords');
		expect(shows[0].genres).toEqual(['Sci-Fi & Fantasy']);
	});

	it('bounds limit and offset', async () => {
		expect(await listTvShows(1, 0)).toHaveLength(1);
		expect((await listTvShows(1, 1))[0].tmdbId).toBe(250307);
		expect(await listTvShows(Number.NaN, Number.NaN)).toHaveLength(1);
		expect(await listTvShows(10_000, -5)).toHaveLength(2);
		expect(MAX_TV_PAGE_SIZE).toBeLessThanOrEqual(100);
	});
});

describe('searchTvShows', () => {
	it('finds standard shows by name, original name or override', async () => {
		expect((await searchTvShows('stranger', 10)).map((show) => show.tmdbId)).toEqual([66732]);
		expect((await searchTvShows('(VF)', 10)).map((show) => show.tmdbId)).toEqual([66732]);
		expect((await searchTvShows('pitt', 10)).map((show) => show.tmdbId)).toEqual([250307]);
	});

	it('never returns quarantined, adult or custom shows', async () => {
		expect(await searchTvShows('Quarantined', 10)).toEqual([]);
		expect(await searchTvShows('Adult', 10)).toEqual([]);
		expect(await searchTvShows('Custom', 10)).toEqual([]);
		expect(await searchTvShows('Show', 10)).toEqual([]);
	});

	it('rejects empty or oversized queries and escapes LIKE wildcards', async () => {
		expect(await searchTvShows('   ', 10)).toEqual([]);
		expect(await searchTvShows('x'.repeat(500), 10)).toEqual([]);
		expect(await searchTvShows('%', 10)).toEqual([]);
		expect(await searchTvShows('_', 10)).toEqual([]);
		expect(await searchTvShows('s', 1)).toHaveLength(1);
	});
});
