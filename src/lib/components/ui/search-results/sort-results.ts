import type { PosterItem } from '$lib/catalogue/items';

// Re-orders results that are already on the page. The server order is the "best match"
// order (popularity), so every other sort falls back to it for ties: the list is stable
// and films without a value always sit last.

export type SearchSort = 'relevance' | 'rating' | 'recent';

export const SEARCH_SORT_OPTIONS: ReadonlyArray<{ value: SearchSort; label: string }> = [
	{ value: 'relevance', label: 'Best match' },
	{ value: 'rating', label: 'Top rated' },
	{ value: 'recent', label: 'Newest' }
];

function ratingOf(item: PosterItem): number | null {
	if (item.rating === null || item.rating === undefined || item.rating === '') return null;
	const value = Number(item.rating);
	return Number.isFinite(value) && value > 0 ? value : null;
}

function releaseOf(item: PosterItem): number | null {
	if (typeof item.releaseDate !== 'string' || !item.releaseDate.trim()) return null;
	const time = Date.parse(item.releaseDate);
	return Number.isNaN(time) ? null : time;
}

export function sortResults(items: readonly PosterItem[], sort: SearchSort): PosterItem[] {
	if (sort === 'relevance') return [...items];
	const keyOf = sort === 'rating' ? ratingOf : releaseOf;

	return items
		.map((item, position) => ({ item, position, key: keyOf(item) }))
		.sort((left, right) => {
			if (left.key === null && right.key === null) return left.position - right.position;
			if (left.key === null) return 1;
			if (right.key === null) return -1;
			return right.key - left.key || left.position - right.position;
		})
		.map(({ item }) => item);
}
