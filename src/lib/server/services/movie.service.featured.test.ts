import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { getFeaturedMovies, getGenres, toHeroItem, toPosterItem } from './movie.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

afterAll(async () => {
	await pg.close();
});

async function insertMovie(
	tmdbId: number,
	title: string,
	backdrop: string | null,
	votes: number,
	average: number,
	adult = false
) {
	await pg.query(
		`insert into movies (tmdb_id, title, overview, poster_path, backdrop_path, vote_count, vote_average, popularity, adult, metadata)
		 values ($1, $2, 'Overview', '/p.jpg', $3, $4, $5, 10, $6, $7)`,
		[
			tmdbId,
			title,
			backdrop,
			votes,
			average,
			adult,
			title === 'Logo' ? JSON.stringify({ logoPath: '/logo.png' }) : null
		]
	);
}

describe('getFeaturedMovies', () => {
	it('returns standard movies with a backdrop and enough votes, best rated first', async () => {
		await insertMovie(1, 'No backdrop', null, 5000, 9.5);
		await insertMovie(2, 'Few votes', '/b.jpg', 50, 9.4);
		await insertMovie(3, 'Adult', '/b.jpg', 5000, 9.3, true);
		await insertMovie(4, 'Good', '/b.jpg', 5000, 8.1);
		await insertMovie(5, 'Logo', '/b.jpg', 5000, 8.9);
		await pg.query(`insert into genres (id, name) values (18, 'Drama'), (28, 'Action')`);
		await pg.query(
			`insert into movie_genres (movie_id, genre_id) select id, 18 from movies where tmdb_id = 5`
		);

		const featured = await getFeaturedMovies(5);

		expect(featured.map((movie) => movie.title)).toEqual(['Logo', 'Good']);
		const hero = toHeroItem(featured[0]);
		expect(hero.logoPath).toBe('/logo.png');
		expect(hero.genres).toEqual(['Drama']);
		expect(hero.href).toBe(`/movies/${featured[0].id}`);
		expect(toPosterItem(featured[1]).genre).toBeNull();
	});

	it('lists only genres that a visible standard film uses, alphabetically', async () => {
		// TV-only genres share the genre table, but no film carries them.
		await pg.query(
			`insert into genres (id, name) values (10759, 'Action & Adventure'), (10764, 'Reality'),
			 (10765, 'Sci-Fi & Fantasy'), (35, 'Comedy'), (878, 'Science Fiction')`
		);
		// Comedy is carried only by the adult film, so standard surfaces must not offer it.
		await pg.query(
			`insert into movie_genres (movie_id, genre_id) select id, 35 from movies where tmdb_id = 3`
		);
		// Two films sharing Drama must not list it twice.
		await pg.query(
			`insert into movie_genres (movie_id, genre_id)
			 select id, g from movies, unnest(array[878, 18]) as g where tmdb_id = 4`
		);

		const list = await getGenres();

		expect(list.map((genre) => genre.name)).toEqual(['Drama', 'Science Fiction']);
		for (const tvOnly of [10759, 10764, 10765, 28, 35]) {
			expect(list.map((genre) => genre.id)).not.toContain(tvOnly);
		}
	});
});
