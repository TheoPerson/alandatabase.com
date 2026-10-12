import { describe, expect, it } from 'vitest';
import {
	MAX_CATALOG_PAGE,
	MAX_SEARCH_QUERY_LENGTH,
	parseCatalogParameters,
	parseSearchParameters
} from './request-bounds';

function url(search = ''): URL {
	return new URL(`https://example.test/path${search}`);
}

describe('search request bounds', () => {
	it('trims the query and supplies the route default limit', () => {
		expect(
			parseSearchParameters(url('?q=%20Alien%20'), {
				defaultLimit: 5,
				maximumLimit: 20
			})
		).toEqual({ ok: true, value: { query: 'Alien', limit: 5 } });
	});

	it('accepts a limit at the configured boundary', () => {
		expect(
			parseSearchParameters(url('?q=Alien&limit=20'), {
				defaultLimit: 5,
				maximumLimit: 20
			})
		).toEqual({ ok: true, value: { query: 'Alien', limit: 20 } });
	});

	it.each(['0', '-1', '21', '1.5', '2titles'])('rejects unsafe limit %s', (limit) => {
		expect(
			parseSearchParameters(url(`?q=Alien&limit=${encodeURIComponent(limit)}`), {
				defaultLimit: 5,
				maximumLimit: 20
			}).ok
		).toBe(false);
	});

	it('rejects oversized and control-character queries', () => {
		const oversizedQuery = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1);

		expect(
			parseSearchParameters(url(`?q=${oversizedQuery}`), {
				defaultLimit: 5,
				maximumLimit: 20
			}).ok
		).toBe(false);
		expect(
			parseSearchParameters(url('?q=Alien%0A'), {
				defaultLimit: 5,
				maximumLimit: 20
			}).ok
		).toBe(false);
	});
});

describe('catalog request bounds', () => {
	it('supplies safe defaults', () => {
		expect(parseCatalogParameters(url())).toEqual({
			ok: true,
			value: {
				page: 1,
				genreId: null,
				decade: null,
				sortBy: 'popularity'
			}
		});
	});

	it('accepts bounded catalog filters', () => {
		expect(
			parseCatalogParameters(url(`?page=${MAX_CATALOG_PAGE}&genre=878&decade=2020&sort=rating`))
		).toEqual({
			ok: true,
			value: {
				page: MAX_CATALOG_PAGE,
				genreId: 878,
				decade: 2020,
				sortBy: 'rating'
			}
		});
	});

	it.each([
		`?page=${MAX_CATALOG_PAGE + 1}`,
		'?page=0',
		'?page=1.5',
		'?genre=0',
		'?genre=-1',
		'?decade=2025',
		'?decade=2110',
		'?sort=unknown'
	])('rejects unsafe catalog parameters: %s', (search) => {
		expect(parseCatalogParameters(url(search)).ok).toBe(false);
	});
});
