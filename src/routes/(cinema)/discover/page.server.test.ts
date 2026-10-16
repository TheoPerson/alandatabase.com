import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('$lib/server/db', async () => {
	const { createMigratedTestDatabase } = await import('$lib/server/testing/pglite');
	const schema = await import('$lib/server/db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '$lib/server/db';
import { load } from './+page.server';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;
const run = () => (load as () => Promise<any>)();

async function film(
	tmdbId: number,
	title: string,
	release: string,
	genreId: number,
	adult = false
) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into movies (tmdb_id, title, poster_path, backdrop_path, vote_count, vote_average, popularity, adult, release_date)
		 values ($1, $2, '/p.jpg', '/b.jpg', 5000, 8, 50, $3, $4) returning id`,
		[tmdbId, title, adult, release]
	);
	await pg.query(
		`insert into genres (id, name) values ($1::int, 'G' || $1::text) on conflict do nothing`,
		[genreId]
	);
	await pg.query(`insert into movie_genres (movie_id, genre_id) values ($1, $2)`, [
		rows[0].id,
		genreId
	]);
}

beforeAll(async () => {
	await film(1, 'Dream Heist', '2010-07-16', 878);
	await film(2, 'Night Laughs', '1999-03-01', 35);
	await film(3, 'Car Chase', '1988-06-01', 28);
	await film(4, 'Hidden Adult', '2012-01-01', 878, true);
});

afterAll(async () => {
	await pg.close();
});

describe('Discover loader', () => {
	it('builds mood rails as poster items linking to film pages', async () => {
		const data = await run();
		const mind = data.moods.find((rail: { key: string }) => rail.key === 'mind-bending');
		expect(mind.items.map((item: { title: string }) => item.title)).toEqual(['Dream Heist']);
		expect(mind.items[0].href).toMatch(/^\/movies\/[0-9a-f-]{36}$/u);
	});

	it('builds decade rails with a See all link to Browse, skipping empty decades', async () => {
		const data = await run();
		const titles = Object.fromEntries(
			data.decades.map((rail: { decade: number; items: Array<{ title: string }> }) => [
				rail.decade,
				rail.items.map((item) => item.title)
			])
		);
		expect(titles[2010]).toEqual(['Dream Heist']);
		expect(titles[1990]).toEqual(['Night Laughs']);
		expect(titles[1980]).toEqual(['Car Chase']);
		expect(titles[2000]).toBeUndefined();
		const tens = data.decades.find((rail: { decade: number }) => rail.decade === 2010);
		expect(tens.seeAllHref).toBe('/movies?decade=2010&sort=rating');
	});

	it('never shows a quarantined film anywhere', async () => {
		const data = await run();
		const everything = [
			...(data.pick ? [data.pick] : []),
			...data.moods.flatMap((rail: { items: unknown[] }) => rail.items),
			...data.decades.flatMap((rail: { items: unknown[] }) => rail.items)
		] as Array<{ title: string }>;
		expect(everything.map((item) => item.title)).not.toContain('Hidden Adult');
	});

	it('offers a pick of the day from well-rated films', async () => {
		const data = await run();
		expect(data.pick).toMatchObject({ href: expect.stringMatching(/^\/movies\//u) });
		expect(data.degraded).toBe(false);
	});
});
