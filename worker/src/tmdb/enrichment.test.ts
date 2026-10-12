import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectLogoPath, selectWatchProviderRows } from './enrichment.js';

const netflix = {
	provider_id: 8,
	provider_name: 'Netflix',
	logo_path: '/n.jpg',
	display_priority: 1
};
const canal = { provider_id: 381, provider_name: 'Canal+', logo_path: null, display_priority: 3 };
const apple = {
	provider_id: 2,
	provider_name: 'Apple TV',
	logo_path: '/a.jpg',
	display_priority: 2
};

describe('selectWatchProviderRows', () => {
	it('flattens the configured regions and kinds, keeping the region link', () => {
		const rows = selectWatchProviderRows({
			FR: {
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR',
				flatrate: [netflix],
				rent: [apple]
			},
			US: { link: 'https://www.themoviedb.org/movie/1/watch?locale=US', buy: [apple] },
			DE: { link: 'x', flatrate: [netflix] }
		});

		assert.deepEqual(rows, [
			{
				region: 'FR',
				kind: 'flatrate',
				providerId: 8,
				providerName: 'Netflix',
				logoPath: '/n.jpg',
				displayPriority: 1,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR'
			},
			{
				region: 'FR',
				kind: 'rent',
				providerId: 2,
				providerName: 'Apple TV',
				logoPath: '/a.jpg',
				displayPriority: 2,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR'
			},
			{
				region: 'US',
				kind: 'buy',
				providerId: 2,
				providerName: 'Apple TV',
				logoPath: '/a.jpg',
				displayPriority: 2,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=US'
			}
		]);
	});

	it('tolerates missing regions, missing kinds and providers without a logo', () => {
		assert.deepEqual(selectWatchProviderRows(undefined), []);
		assert.deepEqual(selectWatchProviderRows({}), []);
		const rows = selectWatchProviderRows({ FR: { link: 'l', flatrate: [canal] } });
		assert.equal(rows[0].logoPath, null);
		assert.equal(rows[0].displayPriority, 3);
	});

	it('drops malformed providers instead of throwing', () => {
		const rows = selectWatchProviderRows({
			FR: { link: 'l', flatrate: [{ provider_id: 'x', provider_name: 'Bad' } as never, netflix] }
		});
		assert.equal(rows.length, 1);
		assert.equal(rows[0].providerId, 8);
	});
});

describe('selectLogoPath', () => {
	it('prefers an English or language-neutral PNG with the best vote', () => {
		const path = selectLogoPath([
			{ file_path: '/fr.png', iso_639_1: 'fr', vote_average: 9 },
			{ file_path: '/en-low.png', iso_639_1: 'en', vote_average: 3 },
			{ file_path: '/neutral.png', iso_639_1: null, vote_average: 5 },
			{ file_path: '/en.svg', iso_639_1: 'en', vote_average: 8 }
		]);
		assert.equal(path, '/neutral.png');
	});

	it('returns null when there is no usable logo', () => {
		assert.equal(selectLogoPath(undefined), null);
		assert.equal(selectLogoPath([]), null);
		assert.equal(
			selectLogoPath([{ file_path: '/de.png', iso_639_1: 'de', vote_average: 9 }]),
			null
		);
	});
});
