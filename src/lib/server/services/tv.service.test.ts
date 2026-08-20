import { describe, expect, it, vi } from 'vitest';
import { getTop50IMDbTVShows, getTVShowDetails, TOP_50_IMDB_TV } from './tv.service';

describe('TV read service', () => {
	it('serves the committed catalog without external requests', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const shows = await getTop50IMDbTVShows();

		expect(shows).toHaveLength(TOP_50_IMDB_TV.length);
		expect(shows[0]).toMatchObject({
			rank: TOP_50_IMDB_TV[0].rank,
			tmdbId: TOP_50_IMDB_TV[0].tmdbId,
			title: TOP_50_IMDB_TV[0].title
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('resolves details from the committed catalog without inventing episode counts', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const source = TOP_50_IMDB_TV[0];

		const show = await getTVShowDetails(source.tmdbId);

		expect(show).toMatchObject({
			id: source.tmdbId,
			name: source.title,
			number_of_seasons: source.seasons,
			number_of_episodes: null
		});
		expect(show?.seasons).toHaveLength(source.seasons);
		expect(show?.seasons.every((season) => season.episode_count === null)).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('returns null for a title that is not in the local catalog', async () => {
		await expect(getTVShowDetails(999_999_999)).resolves.toBeNull();
	});
});
