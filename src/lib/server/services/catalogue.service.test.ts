import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { listCatalogue } from './catalogue.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

afterAll(async () => {
	await pg.close();
});

interface MovieOptions {
	adult?: boolean;
	popularity?: number;
	rating?: number | null;
	release?: string | null;
}

async function insertMovie(tmdbId: number, title: string, options: MovieOptions = {}) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into movies (tmdb_id, title, overview, poster_path, vote_count, vote_average, popularity, adult, release_date)
		 values ($1, $2, 'Overview', '/p.jpg', 2000, $3, $4, $5, $6) returning id`,
		[
			tmdbId,
			title,
			options.rating === undefined ? 7 : options.rating,
			options.popularity ?? 10,
			options.adult ?? false,
			options.release === undefined ? '2012-05-05' : options.release
		]
	);
	return rows[0].id;
}

async function tag(movieId: string, genreId: number) {
	await pg.query(`insert into genres (id, name) values ($1, $2) on conflict (id) do nothing`, [
		genreId,
		`Genre ${genreId}`
	]);
	await pg.query(`insert into movie_genres (movie_id, genre_id) values ($1, $2)`, [
		movieId,
		genreId
	]);
}

const base = { page: 1, genreId: null, decade: null, sortBy: 'popularity' as const, limit: 24 };
const titles = (rows: Array<{ title: string }>) => rows.map((row) => row.title);

describe('catalogue listing', () => {
	it('filters by genre without breaking the relational query', async () => {
		const action = await insertMovie(101, 'Action film', { popularity: 50 });
		const drama = await insertMovie(102, 'Drama film', { popularity: 40 });
		await tag(action, 28);
		await tag(drama, 18);

		const result = await listCatalogue({ ...base, genreId: 28 });

		expect(titles(result.movies)).toEqual(['Action film']);
		expect(result.totalCount).toBe(1);
	});

	it('combines genre, decade and rating sort', async () => {
		const a = await insertMovie(110, 'Old war', { release: '1994-01-01', rating: 9 });
		const b = await insertMovie(111, 'New war low', { release: '2015-01-01', rating: 5 });
		const c = await insertMovie(112, 'New war high', { release: '2016-01-01', rating: 8 });
		for (const id of [a, b, c]) await tag(id, 10752);

		const result = await listCatalogue({
			...base,
			genreId: 10752,
			decade: 2010,
			sortBy: 'rating'
		});

		expect(titles(result.movies)).toEqual(['New war high', 'New war low']);
	});

	it('keeps films without a rating or release date at the end of their sort', async () => {
		await insertMovie(120, 'Rated high', { rating: 9, release: '2000-01-01', popularity: 1 });
		await insertMovie(121, 'Unrated', { rating: null, release: null, popularity: 1 });
		await insertMovie(122, 'Rated low', { rating: 3, release: '1990-01-01', popularity: 1 });

		const byRating = await listCatalogue({ ...base, genreId: null, sortBy: 'rating', limit: 100 });
		const byRelease = await listCatalogue({ ...base, sortBy: 'release', limit: 100 });
		const ratingOrder = titles(byRating.movies);
		const releaseOrder = titles(byRelease.movies);

		expect(ratingOrder.indexOf('Unrated')).toBe(ratingOrder.length - 1);
		expect(releaseOrder.indexOf('Unrated')).toBe(releaseOrder.length - 1);
	});

	it('never lists adult or explicit-keyword films, nor counts them', async () => {
		const hidden = await insertMovie(130, 'Hidden adult', { adult: true });
		const keyworded = await insertMovie(131, 'Hidden keyword');
		const shown = await insertMovie(132, 'Shown');
		for (const id of [hidden, keyworded, shown]) await tag(id, 99);
		await pg.query(
			`insert into keywords (id, name) values (256466, 'explicit') on conflict do nothing`
		);
		await pg.query(`insert into movie_keywords (movie_id, keyword_id) values ($1, 256466)`, [
			keyworded
		]);

		const result = await listCatalogue({ ...base, genreId: 99 });

		expect(titles(result.movies)).toEqual(['Shown']);
		expect(result.totalCount).toBe(1);
	});

	it('pages with a bounded size and reports the total', async () => {
		for (let index = 0; index < 5; index += 1) {
			const id = await insertMovie(140 + index, `Paged ${index}`, { popularity: 100 - index });
			await tag(id, 36);
		}

		const first = await listCatalogue({ ...base, genreId: 36, limit: 2 });
		const second = await listCatalogue({ ...base, genreId: 36, limit: 2, page: 2 });

		expect(titles(first.movies)).toEqual(['Paged 0', 'Paged 1']);
		expect(titles(second.movies)).toEqual(['Paged 2', 'Paged 3']);
		expect(first.totalCount).toBe(5);
	});

	it('refuses an unbounded page size', async () => {
		const result = await listCatalogue({ ...base, limit: 100_000 });
		expect(result.movies.length).toBeLessThanOrEqual(60);
	});
});
