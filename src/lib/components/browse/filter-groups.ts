import {
	DECADES,
	DEFAULT_SORT,
	MIN_RATINGS,
	SORT_OPTIONS,
	browseHref,
	type BrowseFilters
} from '$lib/catalogue/browse';

// Sort, Decade and Rating as plain link options. The desktop strip and the phone sheet render
// the same list, so both offer exactly the same addresses and work without JavaScript.

export interface FilterOption {
	label: string;
	href: string;
	selected: boolean;
}

export interface FilterGroup {
	key: 'sort' | 'decade' | 'rating';
	label: string;
	options: FilterOption[];
}

export function filterGroups(filters: BrowseFilters): FilterGroup[] {
	return [
		{
			key: 'sort',
			label: 'Sort',
			options: SORT_OPTIONS.map((option) => ({
				label: option.label,
				href: browseHref({ ...filters, sortBy: option.value }),
				selected: filters.sortBy === option.value
			}))
		},
		{
			key: 'decade',
			label: 'Decade',
			options: [
				{
					label: 'Any',
					href: browseHref({ ...filters, decade: null }),
					selected: filters.decade === null
				},
				...DECADES.map((decade) => ({
					label: `${decade}s`,
					href: browseHref({ ...filters, decade }),
					selected: filters.decade === decade
				}))
			]
		},
		{
			key: 'rating',
			label: 'Rating',
			options: [
				{
					label: 'Any',
					href: browseHref({ ...filters, minRating: null }),
					selected: filters.minRating === null
				},
				...MIN_RATINGS.map((rating) => ({
					label: `${rating}+`,
					href: browseHref({ ...filters, minRating: rating }),
					selected: filters.minRating === rating
				}))
			]
		}
	];
}

/** How many of Sort, Decade and Rating differ from their defaults (the genre is not counted). */
export function activeFilterCount(filters: BrowseFilters): number {
	return (
		Number(filters.sortBy !== DEFAULT_SORT) +
		Number(filters.decade !== null) +
		Number(filters.minRating !== null)
	);
}

/** Names all three groups, e.g. "Popular · Any decade · Any rating", so phones see what the sheet holds. */
export function filterSummary(filters: BrowseFilters): string {
	const sort = SORT_OPTIONS.find((option) => option.value === filters.sortBy)?.label ?? 'Popular';
	const decade = filters.decade === null ? 'Any decade' : `${filters.decade}s`;
	const rating = filters.minRating === null ? 'Any rating' : `${filters.minRating}+ rating`;
	return [sort, decade, rating].join(' · ');
}

/** The sheet's Reset: back to the default sort, decade and rating, keeping the chosen genre. */
export function resetFiltersHref(filters: BrowseFilters): string {
	return browseHref({ ...filters, sortBy: DEFAULT_SORT, decade: null, minRating: null });
}

/** The sheet's primary action, e.g. "Show 296 films"; "Done" when the count is unknown. */
export function showResultsLabel(total: number | null): string {
	if (total === null) return 'Done';
	if (total === 0) return 'No films match';
	return `Show ${total.toLocaleString('en-US')} ${total === 1 ? 'film' : 'films'}`;
}
