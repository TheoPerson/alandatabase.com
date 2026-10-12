import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { collectionMovies, getMovieById, similarMovies } from './movie.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

afterAll(async () => {
	await pg.close();
});

interface MovieOptions {
	adult?: boolean;
	collection?: string | null;
	popularity?: number;
	release?: string;
}

async function insertMovie(tmdbId: number, title: string, options: MovieOptions = {}) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into movies (tmdb_id, title, overview, poster_path, backdrop_path, vote_count, vote_average, popularity, adult, collection_id, release_date)
		 values ($1, $2, 'Overview', '/p.jpg', '/b.jpg', 2000, 7.5, $3, $4, $5, $6) returning id`,
		[
			tmdbId,
			title,
			options.popularity ?? 10,
			options.adult ?? false,
			options.collection ?? null,
			options.release ?? '2001-01-01'
		]
	);
	return rows[0].id;
}

describe('movie detail reads', () => {
	it('loads watch providers and a deep crew for a standard movie', async () => {
		const movieId = await insertMovie(1, 'Film');
		await pg.query(
			`insert into movie_watch_providers (movie_id, region, kind, provider_id, provider_name) values ($1, 'FR', 'flatrate', 8, 'Netflix')`,
			[movieId]
		);
		await pg.query(
			`insert into people (tmdb_id, name) select 9000 + g, 'Crew ' || g from generate_series(1, 25) g`
		);
		await pg.query(
			`insert into movie_crew (movie_id, person_id, department, job) select $1, id, 'Production', 'Producer' from people where tmdb_id between 9001 and 9024`,
			[movieId]
		);
		await pg.query(
			`insert into movie_crew (movie_id, person_id, department, job) select $1, id, 'Directing', 'Director' from people where tmdb_id = 9025`,
			[movieId]
		);

		const movie = await getMovieById(movieId);

		expect(movie?.watchProviders).toHaveLength(1);
		expect(movie?.watchProviders[0].providerName).toBe('Netflix');
		expect(movie?.crew).toHaveLength(25);
		expect(movie?.crew.some((row: { job: string | null }) => row.job === 'Director')).toBe(true);
	});

	it('similar and collection reads exclude the film itself and quarantined rows', async () => {
		const { rows: collectionRows } = await pg.query<{ id: string }>(
			`insert into collections (tmdb_id, name) values (77, 'Saga') returning id`
		);
		const collection = collectionRows[0].id;
		await pg.query(`insert into genres (id, name) values (28, 'Action') on conflict do nothing`);
		const base = await insertMovie(10, 'Base', {
			collection,
			popularity: 50,
			release: '2000-01-01'
		});
		const sibling = await insertMovie(11, 'Sibling', {
			collection,
			popularity: 5,
			release: '2003-01-01'
		});
		const adultSibling = await insertMovie(12, 'Adult sibling', { collection, adult: true });
		const popular = await insertMovie(13, 'Popular action', { popularity: 99 });
		const custom = await insertMovie(-5, 'Custom action', { popularity: 999 });
		for (const id of [base, sibling, adultSibling, popular, custom]) {
			await pg.query(`insert into movie_genres (movie_id, genre_id) values ($1, 28)`, [id]);
		}

		const similar = await similarMovies(base, 28);
		expect(similar.map((movie) => movie.title)).toEqual(['Popular action', 'Sibling']);

		const saga = await collectionMovies(collection, base);
		expect(saga.map((movie) => movie.title)).toEqual(['Sibling']);
		expect(await collectionMovies(null, base)).toEqual([]);
		expect(await similarMovies(base, null)).toEqual([]);
	});
});
