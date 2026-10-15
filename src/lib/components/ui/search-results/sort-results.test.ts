import { describe, expect, it } from 'vitest';
import type { PosterItem } from '$lib/catalogue/items';
import { SEARCH_SORT_OPTIONS, sortResults } from './sort-results';

function item(id: string, extra: Partial<PosterItem> = {}): PosterItem {
	return { id, href: `/movies/${id}`, title: `Film ${id}`, posterPath: null, ...extra };
}

const ids = (items: PosterItem[]) => items.map((entry) => entry.id);

describe('sortResults', () => {
	it('keeps the server order for best match and never mutates its input', () => {
		const input = [item('a', { rating: 5 }), item('b', { rating: 9 }), item('c', { rating: 7 })];
		const snapshot = [...input];

		expect(ids(sortResults(input, 'relevance'))).toEqual(['a', 'b', 'c']);
		expect(ids(sortResults(input, 'rating'))).toEqual(['b', 'c', 'a']);
		expect(input).toEqual(snapshot);
	});

	it('sorts by rating, highest first, with numeric strings from the database', () => {
		const input = [
			item('a', { rating: '6.2' }),
			item('b', { rating: '8.1' }),
			item('c', { rating: 7.4 })
		];

		expect(ids(sortResults(input, 'rating'))).toEqual(['b', 'c', 'a']);
	});

	it('puts missing, empty, zero and invalid ratings last, in server order', () => {
		const input = [
			item('a', { rating: null }),
			item('b', { rating: 3 }),
			item('c', { rating: '' }),
			item('d', { rating: 0 }),
			item('e', { rating: 'n/a' }),
			item('f')
		];

		expect(ids(sortResults(input, 'rating'))).toEqual(['b', 'a', 'c', 'd', 'e', 'f']);
	});

	it('keeps ties in the server order so the list is stable', () => {
		const input = [
			item('a', { rating: 7 }),
			item('b', { rating: 7 }),
			item('c', { rating: 9 }),
			item('d', { rating: 7 })
		];

		expect(ids(sortResults(input, 'rating'))).toEqual(['c', 'a', 'b', 'd']);
		expect(ids(sortResults(sortResults(input, 'rating'), 'rating'))).toEqual(['c', 'a', 'b', 'd']);
	});

	it('sorts by release date, newest first, with undated films last', () => {
		const input = [
			item('a', { releaseDate: '1999-03-31' }),
			item('b', { releaseDate: null }),
			item('c', { releaseDate: '2021-10-22' }),
			item('d', { releaseDate: 'not a date' }),
			item('e', { releaseDate: '2010-07-16' }),
			item('f', { releaseDate: '' })
		];

		expect(ids(sortResults(input, 'recent'))).toEqual(['c', 'e', 'a', 'b', 'd', 'f']);
	});

	it('keeps same-day releases in the server order', () => {
		const input = [
			item('a', { releaseDate: '2020-01-01' }),
			item('b', { releaseDate: '2020-01-01' }),
			item('c', { releaseDate: '2020-01-01' })
		];

		expect(ids(sortResults(input, 'recent'))).toEqual(['a', 'b', 'c']);
	});

	it('handles an empty list', () => {
		expect(sortResults([], 'rating')).toEqual([]);
	});

	it('offers the three options in display order', () => {
		expect(SEARCH_SORT_OPTIONS.map((option) => option.value)).toEqual([
			'relevance',
			'rating',
			'recent'
		]);
		expect(SEARCH_SORT_OPTIONS.map((option) => option.label)).toEqual([
			'Best match',
			'Top rated',
			'Newest'
		]);
	});
});
