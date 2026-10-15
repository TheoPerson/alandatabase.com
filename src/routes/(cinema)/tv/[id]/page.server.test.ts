import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import { TOP_50_IMDB_TV } from '$lib/server/services/tv.service';

const run = (id: string) => (load as (event: unknown) => Promise<any>)({ params: { id } });

describe('TV series detail loader', () => {
	it('returns the series with its real snapshot fields', async () => {
		const entry = TOP_50_IMDB_TV[0];
		const data = await run(String(entry.tmdbId));
		expect(data.show).toMatchObject({
			tmdbId: entry.tmdbId,
			title: entry.title,
			rank: entry.rank,
			rating: entry.imdbRating,
			years: entry.year,
			seasons: entry.seasons,
			posterPath: entry.posterPath,
			backdropPath: entry.backdropPath,
			genres: entry.genres
		});
	});

	it('suggests up to 12 other series that share a genre, never the series itself', async () => {
		const entry = TOP_50_IMDB_TV.find((show) => show.genres.includes('Drama'))!;
		const data = await run(String(entry.tmdbId));
		expect(data.similar.length).toBeGreaterThan(0);
		expect(data.similar.length).toBeLessThanOrEqual(12);
		for (const item of data.similar) {
			expect(item.href).not.toBe(`/tv/${entry.tmdbId}`);
			const other = TOP_50_IMDB_TV.find((show) => `/tv/${show.tmdbId}` === item.href)!;
			expect(other.genres.some((genre) => entry.genres.includes(genre))).toBe(true);
		}
	});

	it.each(['999999999', 'abc', '-1', '1.5', ''])('answers 404 for %s', async (id) => {
		await expect(run(id)).rejects.toMatchObject({ status: 404 });
	});
});
