import { describe, expect, it } from 'vitest';
import {
	accumulate,
	browseHref,
	describeFilters,
	hasActiveFilters,
	type BrowseFilters
} from './browse';

const none: BrowseFilters = { genreId: null, decade: null, minRating: null, sortBy: 'popularity' };

describe('browseHref', () => {
	it('is the bare route when nothing is filtered', () => {
		expect(browseHref(none)).toBe('/movies');
	});

	it('writes only the filters that are set, in a stable order', () => {
		expect(browseHref({ genreId: 28, decade: 2010, minRating: 7, sortBy: 'rating' }, 1)).toBe(
			'/movies?genre=28&decade=2010&rating=7&sort=rating'
		);
	});

	it('omits the default sort and page 1, includes later pages', () => {
		expect(browseHref({ ...none, genreId: 18 })).toBe('/movies?genre=18');
		expect(browseHref({ ...none, genreId: 18 }, 3)).toBe('/movies?genre=18&page=3');
		expect(browseHref(none, 2)).toBe('/movies?page=2');
	});
});

describe('hasActiveFilters', () => {
	it('is false for the default view and true for any change', () => {
		expect(hasActiveFilters(none)).toBe(false);
		expect(hasActiveFilters({ ...none, sortBy: 'release' })).toBe(true);
		expect(hasActiveFilters({ ...none, minRating: 6 })).toBe(true);
	});
});

describe('describeFilters', () => {
	it('names the genre and reads naturally', () => {
		expect(
			describeFilters({ genreId: 28, decade: 2010, minRating: 7, sortBy: 'rating' }, 'Action')
		).toBe('Action · 2010s · 7+ rating · Top rated');
	});

	it('is empty for the default view', () => {
		expect(describeFilters(none)).toBe('');
	});
});

describe('accumulate', () => {
	const view = (key: string, page: number, ids: string[]) => ({
		key,
		page,
		items: ids.map((id) => ({ id }))
	});

	it('starts from the first view it sees', () => {
		expect(accumulate(null, view('a', 1, ['1', '2']))).toEqual(view('a', 1, ['1', '2']));
	});

	it('appends the next page of the same filters', () => {
		const merged = accumulate(view('a', 1, ['1', '2']), view('a', 2, ['3', '4']));
		expect(merged.page).toBe(2);
		expect(merged.items.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
	});

	it('drops a repeated film instead of listing it twice', () => {
		const merged = accumulate(view('a', 1, ['1', '2']), view('a', 2, ['2', '3']));
		expect(merged.items.map((item) => item.id)).toEqual(['1', '2', '3']);
	});

	it('starts over when the filters change', () => {
		const merged = accumulate(view('a', 2, ['1', '2', '3']), view('b', 1, ['9']));
		expect(merged).toEqual(view('b', 1, ['9']));
	});

	it('starts over on a jump that is not the next page', () => {
		expect(accumulate(view('a', 1, ['1']), view('a', 4, ['7']))).toEqual(view('a', 4, ['7']));
		expect(accumulate(view('a', 3, ['1']), view('a', 1, ['9']))).toEqual(view('a', 1, ['9']));
	});

	it('does not append the same page twice', () => {
		expect(accumulate(view('a', 2, ['1', '2']), view('a', 2, ['1', '2']))).toEqual(
			view('a', 2, ['1', '2'])
		);
	});
});
