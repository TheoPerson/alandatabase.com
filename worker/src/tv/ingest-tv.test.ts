import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { createWorkerTestDatabase } from '../library/test-db.js';
import { BLOCKED_TMDB_KEYWORD_IDS } from '../tmdb/ingest-safety.js';
import {
	episodeKey,
	ingestTvShow,
	type TmdbSeasonDetail,
	type TmdbTvDetail,
	type TvSource,
	type WorkerDb
} from './ingest-tv.js';

function show(overrides: Partial<TmdbTvDetail> = {}): TmdbTvDetail {
	return {
		id: 250307,
		name: 'The Pitt',
		original_name: 'The Pitt',
		overview: 'A day in a Pittsburgh emergency room.',
		tagline: '',
		poster_path: '/pitt.jpg',
		backdrop_path: null,
		first_air_date: '2025-01-09',
		last_air_date: '',
		status: 'Returning Series',
		number_of_seasons: 2,
		number_of_episodes: 30,
		vote_average: 8.712,
		vote_count: 400,
		popularity: 120.5,
		original_language: 'en',
		adult: false,
		genres: [
			{ id: 18, name: 'Drama' },
			{ id: 10765, name: 'Sci-Fi & Fantasy' }
		],
		keywords: { results: [{ id: 6149, name: 'hospital' }] },
		external_ids: { imdb_id: 'tt31938062' },
		seasons: [
			{ season_number: 1, name: 'Season 1', episode_count: 15, air_date: '2025-01-09' },
			{ season_number: 2, name: 'Season 2', episode_count: 15, air_date: null }
		],
		...overrides
	};
}

function season(number: number, episodes: number[]): TmdbSeasonDetail {
	return {
		season_number: number,
		name: `Season ${number}`,
		episodes: episodes.map((episode) => ({
			episode_number: episode,
			name: `Episode ${episode}`,
			air_date: episode === 1 ? '2025-01-09' : '',
			runtime: episode === 1 ? 52 : null,
			vote_average: 0,
			vote_count: 0
		}))
	};
}

class FakeSource implements TvSource {
	calls: string[] = [];
	constructor(
		private readonly detail: TmdbTvDetail | null,
		private readonly seasons: Record<number, TmdbSeasonDetail> = {}
	) {}
	async getShow(id: number) {
		this.calls.push(`show:${id}`);
		return this.detail;
	}
	async getSeason(id: number, n: number) {
		this.calls.push(`season:${id}:${n}`);
		return this.seasons[n] ?? null;
	}
}

let pg: PGlite;
let db: WorkerDb;

before(async () => {
	({ pg, db } = await createWorkerTestDatabase());
	await pg.query(`insert into genres (id, name) values (18, 'Drame')`);
});

after(async () => {
	await pg.close();
});

async function count(table: string, where = 'true'): Promise<number> {
	const { rows } = await pg.query<{ n: number }>(
		`select count(*)::int as n from ${table} where ${where}`
	);
	return rows[0].n;
}

describe('ingestTvShow', () => {
	it('stores the show, genres (incl. TV ids), keywords, seasons and requested episodes', async () => {
		const source = new FakeSource(show(), { 1: season(1, [1, 2, 3]) });
		const result = await ingestTvShow(250307, { seasons: [1], db, source });

		assert.equal(result.status, 'ingested');
		assert.ok(result.status === 'ingested');
		assert.equal(result.episodes.size, 3);
		assert.ok(result.episodes.get(episodeKey(1, 2)));
		assert.deepEqual(source.calls, ['show:250307', 'season:250307:1']);

		const { rows } = await pg.query<Record<string, unknown>>(
			`select name, tagline, last_air_date, vote_average, imdb_id, adult from tv_shows where tmdb_id = 250307`
		);
		assert.equal(rows[0].name, 'The Pitt');
		assert.equal(rows[0].tagline, null);
		assert.equal(rows[0].last_air_date, null);
		assert.equal(rows[0].vote_average, '8.7');
		assert.equal(rows[0].imdb_id, 'tt31938062');
		assert.equal(rows[0].adult, false);

		// Existing genre names are kept; the TV-only genre id is added.
		const genres = await pg.query<{ id: number; name: string }>(
			`select id, name from genres where id in (18, 10765) order by id`
		);
		assert.deepEqual(genres.rows, [
			{ id: 18, name: 'Drame' },
			{ id: 10765, name: 'Sci-Fi & Fantasy' }
		]);
		assert.equal(await count('tv_genres'), 2);
		assert.equal(await count('tv_keywords'), 1);
		assert.equal(await count('tv_seasons'), 2);
		assert.equal(await count('tv_episodes'), 3);

		// Unknowns stay null: no synthesised dates, runtimes or 0.0 ratings.
		const episodes = await pg.query<Record<string, unknown>>(
			`select episode_number, air_date, runtime, vote_average from tv_episodes order by episode_number`
		);
		assert.equal(episodes.rows[1].air_date, null);
		assert.equal(episodes.rows[1].runtime, null);
		assert.equal(episodes.rows[0].vote_average, null);
		const unknownSeason = await pg.query<{ air_date: string | null }>(
			`select air_date from tv_seasons where season_number = 2`
		);
		assert.equal(unknownSeason.rows[0].air_date, null);
	});

	it('is idempotent and adds a newly requested season without duplicating rows', async () => {
		const source = new FakeSource(
			show({ genres: [{ id: 18, name: 'Drama' }], keywords: { results: [] } }),
			{ 1: season(1, [1, 2, 3]), 2: season(2, [1]) }
		);
		const first = await ingestTvShow(250307, { seasons: [1, 2], db, source });
		const second = await ingestTvShow(250307, { seasons: [1, 2], db, source });
		assert.equal(first.status, 'ingested');
		assert.equal(second.status, 'ingested');
		assert.equal(await count('tv_shows'), 1);
		assert.equal(await count('tv_seasons'), 2);
		assert.equal(await count('tv_episodes'), 4);
		// Stale junction rows are removed when TMDB drops them.
		assert.equal(await count('tv_genres'), 1);
		assert.equal(await count('tv_keywords'), 0);
	});

	for (const keywordId of BLOCKED_TMDB_KEYWORD_IDS) {
		it(`blocks explicit keyword ${keywordId} before any write`, async () => {
			const source = new FakeSource(
				show({ id: 900000 + keywordId, keywords: { results: [{ id: keywordId, name: 'x' }] } }),
				{ 1: season(1, [1]) }
			);
			const result = await ingestTvShow(900000 + keywordId, { seasons: [1], db, source });
			assert.deepEqual(result, { status: 'blocked', reason: 'explicit-keyword' });
			assert.equal(await count('tv_shows', `tmdb_id = ${900000 + keywordId}`), 0);
			// No season was even fetched.
			assert.deepEqual(source.calls, [`show:${900000 + keywordId}`]);
		});
	}

	it('blocks adult and unclassified shows', async () => {
		for (const detail of [
			show({ id: 800001, adult: true }),
			show({ id: 800002, adult: undefined }),
			show({ id: 800003, keywords: undefined })
		]) {
			const result = await ingestTvShow(detail.id, { db, source: new FakeSource(detail) });
			assert.equal(result.status, 'blocked');
			assert.equal(await count('tv_shows', `tmdb_id = ${detail.id}`), 0);
		}
	});

	it('never modifies a locked show but still reports its episodes', async () => {
		await pg.query(`update tv_shows set is_locked = true, name = 'Edited' where tmdb_id = 250307`);
		const source = new FakeSource(show({ name: 'Renamed upstream' }), { 3: season(3, [1]) });
		const result = await ingestTvShow(250307, { seasons: [3], db, source });
		assert.equal(result.status, 'locked');
		assert.ok(result.status === 'locked');
		assert.equal(result.episodes.size, 4);
		const { rows } = await pg.query<{ name: string }>(
			`select name from tv_shows where tmdb_id = 250307`
		);
		assert.equal(rows[0].name, 'Edited');
		assert.equal(await count('tv_seasons'), 2);
	});

	it('reports missing shows and bad ids without writing', async () => {
		assert.deepEqual(await ingestTvShow(4242, { db, source: new FakeSource(null) }), {
			status: 'not-found'
		});
		assert.equal((await ingestTvShow(-1, { db, source: new FakeSource(show()) })).status, 'failed');
	});

	it('keeps the safety check before the first insert in the source', () => {
		const source = readFileSync(new URL('./ingest-tv.ts', import.meta.url), 'utf8');
		const safety = source.indexOf('evaluateTMDBIngestionSafety({');
		const firstInsert = source.indexOf('.insert(');
		assert.notEqual(safety, -1);
		assert.ok(safety < firstInsert);
	});
});
