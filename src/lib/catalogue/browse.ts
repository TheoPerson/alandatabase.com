// Pure helpers for the Browse page: filter URLs and page accumulation. No server imports,
// so the page component and the loader share one definition of what a "view" is.

export type BrowseSort = 'popularity' | 'rating' | 'release';

export interface BrowseFilters {
	genreId: number | null;
	decade: number | null;
	// Lowest TMDB average (1-9), or null for any.
	minRating: number | null;
	sortBy: BrowseSort;
}

export const DEFAULT_SORT: BrowseSort = 'popularity';
export const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960] as const;
export const MIN_RATINGS = [6, 7, 8] as const;
export const SORT_OPTIONS: ReadonlyArray<{ value: BrowseSort; label: string }> = [
	{ value: 'popularity', label: 'Popular' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'release', label: 'Newest' }
];

export const BROWSE_PATH = '/movies';

export function browseHref(filters: BrowseFilters, page = 1): string {
	const params = new URLSearchParams();
	if (filters.genreId !== null) params.set('genre', String(filters.genreId));
	if (filters.decade !== null) params.set('decade', String(filters.decade));
	if (filters.minRating !== null) params.set('rating', String(filters.minRating));
	if (filters.sortBy !== DEFAULT_SORT) params.set('sort', filters.sortBy);
	if (page > 1) params.set('page', String(page));
	const query = params.toString();
	return query ? `${BROWSE_PATH}?${query}` : BROWSE_PATH;
}

export function hasActiveFilters(filters: BrowseFilters): boolean {
	return (
		filters.genreId !== null ||
		filters.decade !== null ||
		filters.minRating !== null ||
		filters.sortBy !== DEFAULT_SORT
	);
}

export function filterKey(filters: BrowseFilters): string {
	return browseHref(filters, 1);
}

/** A short human summary such as "Action · 2010s · 7+ rating · Top rated". */
export function describeFilters(filters: BrowseFilters, genreName?: string | null): string {
	const parts: string[] = [];
	if (filters.genreId !== null && genreName) parts.push(genreName);
	if (filters.decade !== null) parts.push(`${filters.decade}s`);
	if (filters.minRating !== null) parts.push(`${filters.minRating}+ rating`);
	if (filters.sortBy !== DEFAULT_SORT) {
		parts.push(SORT_OPTIONS.find((option) => option.value === filters.sortBy)?.label ?? '');
	}
	return parts.filter(Boolean).join(' · ');
}

export interface BrowseView<T extends { id: string }> {
	key: string;
	page: number;
	items: T[];
}

/**
 * Folds a freshly loaded page into what the visitor already sees. The next page of the same
 * filters is appended; any other change (new filters, a jump, a reload) starts over so the
 * list always matches the address bar.
 */
export function accumulate<T extends { id: string }>(
	previous: BrowseView<T> | null,
	next: BrowseView<T>
): BrowseView<T> {
	if (!previous || previous.key !== next.key || next.page !== previous.page + 1) return next;
	const seen = new Set(previous.items.map((item) => item.id));
	return {
		key: next.key,
		page: next.page,
		items: [...previous.items, ...next.items.filter((item) => !seen.has(item.id))]
	};
}
