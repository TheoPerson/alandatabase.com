import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import { TOP_50_IMDB_TV } from '$lib/server/services/tv.service';

const run = (search = '') =>
	(load as (event: unknown) => Promise<any>)({
		url: new URL(`https://alandatabase.com/tv${search}`)
	});

describe('TV landing loader', () => {
	it('features the five best-ranked series with backdrops and links', async () => {
		const data = await run();
		expect(data.featured).toHaveLength(5);
		expect(data.featured[0]).toMatchObject({ href: expect.stringMatching(/^\/tv\/\d+$/u) });
		expect(data.featured.every((item: { backdropPath: string | null }) => item.backdropPath)).toBe(
			true
		);
		// Raw TMDB paths: the kit picks responsive sizes instead of the 1 MB "original".
		expect(data.featured[0].backdropPath).toMatch(/^\/[^/]+\.jpg$/u);
	});

	it('ranks the top 10 in chart order', async () => {
		const data = await run();
		const expected = [...TOP_50_IMDB_TV].sort((a, b) => a.rank - b.rank).slice(0, 10);
		// The TV chart carries IMDb ratings: posters must not call them TMDB.
		expect(
			data.top10.every((item: { ratingSource?: string }) => item.ratingSource === 'IMDb')
		).toBe(true);
		expect(data.top10.map((item: { title: string }) => item.title)).toEqual(
			expected.map((show) => show.title)
		);
	});

	it('lists every series and the sorted genre list by default', async () => {
		const data = await run();
		expect(data.shows).toHaveLength(TOP_50_IMDB_TV.length);
		expect(data.genre).toBeNull();
		expect(data.genres).toEqual([...data.genres].sort());
		expect(data.genres).toContain('Drama');
	});

	it('filters by a known genre and ignores an unknown one', async () => {
		const drama = await run('?genre=Drama');
		expect(drama.genre).toBe('Drama');
		expect(drama.shows.length).toBeGreaterThan(0);
		expect(drama.shows.length).toBeLessThan(TOP_50_IMDB_TV.length);
		for (const show of drama.shows) expect(show.genres).toContain('Drama');

		const unknown = await run('?genre=%3Cscript%3E');
		expect(unknown.genre).toBeNull();
		expect(unknown.shows).toHaveLength(TOP_50_IMDB_TV.length);
	});
});
