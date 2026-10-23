import { describe, expect, it } from 'vitest';
import { browseHref, type BrowseFilters } from '$lib/catalogue/browse';
import {
	activeFilterCount,
	filterGroups,
	filterSummary,
	resetFiltersHref,
	showResultsLabel
} from './filter-groups';

const none: BrowseFilters = { genreId: null, decade: null, minRating: null, sortBy: 'popularity' };

describe('filterGroups', () => {
	it('lists Sort, Decade and Rating with one selected option each', () => {
		const groups = filterGroups(none);
		expect(groups.map((group) => group.label)).toEqual(['Sort', 'Decade', 'Rating']);
		for (const group of groups) {
			expect(group.options.filter((option) => option.selected)).toHaveLength(1);
		}
		expect(groups[1].options.map((option) => option.label)).toEqual([
			'Any',
			'2020s',
			'2010s',
			'2000s',
			'1990s',
			'1980s',
			'1970s',
			'1960s'
		]);
		expect(groups[2].options.map((option) => option.label)).toEqual(['Any', '6+', '7+', '8+']);
	});

	it('builds each link with browseHref and keeps the other filters, genre included', () => {
		const filters: BrowseFilters = { genreId: 28, decade: 2010, minRating: null, sortBy: 'rating' };
		const [sort, decade, rating] = filterGroups(filters);

		expect(sort.options.find((option) => option.label === 'Newest')?.href).toBe(
			browseHref({ ...filters, sortBy: 'release' })
		);
		expect(decade.options[0]).toEqual({
			label: 'Any',
			href: '/movies?genre=28&sort=rating',
			selected: false
		});
		expect(decade.options.find((option) => option.selected)?.label).toBe('2010s');
		expect(rating.options.find((option) => option.label === '7+')?.href).toBe(
			'/movies?genre=28&decade=2010&rating=7&sort=rating'
		);
	});
});

describe('activeFilterCount and filterSummary', () => {
	it('count nothing and name every group by default', () => {
		expect(activeFilterCount(none)).toBe(0);
		expect(filterSummary(none)).toBe('Popular · Any decade · Any rating');
	});

	it('count sort, decade and rating but never the genre', () => {
		const filters: BrowseFilters = { genreId: 12, decade: 1990, minRating: 8, sortBy: 'release' };
		expect(activeFilterCount(filters)).toBe(3);
		expect(activeFilterCount({ ...none, genreId: 12 })).toBe(0);
		expect(filterSummary(filters)).toBe('Newest · 1990s · 8+ rating');
	});
});

describe('the sheet actions', () => {
	it('Reset clears sort, decade and rating but keeps the chosen genre', () => {
		const filters: BrowseFilters = { genreId: 28, decade: 1990, minRating: 7, sortBy: 'rating' };
		expect(resetFiltersHref(filters)).toBe('/movies?genre=28');
		expect(resetFiltersHref(none)).toBe('/movies');
	});

	it('the primary action names how many films the filters show', () => {
		expect(showResultsLabel(296)).toBe('Show 296 films');
		expect(showResultsLabel(1)).toBe('Show 1 film');
		expect(showResultsLabel(12345)).toBe('Show 12,345 films');
		expect(showResultsLabel(0)).toBe('No films match');
		expect(showResultsLabel(null)).toBe('Done');
	});
});
