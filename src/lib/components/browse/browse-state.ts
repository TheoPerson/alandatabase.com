// Pure state helpers for the Browse screen: which films are on screen, what an in-flight
// navigation means for them, and the words that describe them. No Svelte, no server imports.

import {
	BROWSE_PATH,
	DEFAULT_SORT,
	accumulate,
	type BrowseFilters,
	type BrowseView
} from '$lib/catalogue/browse';

/** The films on screen: one or more consecutive pages of the same filters. */
export interface ShownFilms<T extends { id: string }> extends BrowseView<T> {
	/** The first page that is part of `items`; `page` is the last one. */
	firstPage: number;
}

export type FoldDirection = 'reset' | 'append' | 'prepend' | 'refresh';

export interface FoldResult<T extends { id: string }> {
	shown: ShownFilms<T>;
	/** How many films joined the list (0 for a reset or a refresh). */
	added: number;
	direction: FoldDirection;
}

/**
 * Folds a freshly loaded page into what the visitor already sees. The next page is appended,
 * the page before the first one is put in front, a reload of a visible page refreshes it in
 * place, and anything else (new filters, a jump) starts over so the list matches the address.
 */
export function fold<T extends { id: string }>(
	previous: ShownFilms<T> | null,
	next: BrowseView<T>
): FoldResult<T> {
	if (previous && previous.key === next.key) {
		if (next.page === previous.page + 1) {
			const merged = accumulate(previous, next);
			return {
				shown: { ...merged, firstPage: previous.firstPage },
				added: merged.items.length - previous.items.length,
				direction: 'append'
			};
		}
		if (next.page === previous.firstPage - 1) {
			const seen = new Set(previous.items.map((item) => item.id));
			const earlier = next.items.filter((item) => !seen.has(item.id));
			return {
				shown: {
					key: previous.key,
					firstPage: next.page,
					page: previous.page,
					items: [...earlier, ...previous.items]
				},
				added: earlier.length,
				direction: 'prepend'
			};
		}
		// Nothing on screen yet (an earlier read failed): there is nothing to refresh, start fresh.
		const showsPage = next.page >= previous.firstPage && next.page <= previous.page;
		if (showsPage && previous.items.length > 0) {
			const latest = new Map(next.items.map((item) => [item.id, item]));
			return {
				shown: { ...previous, items: previous.items.map((item) => latest.get(item.id) ?? item) },
				added: 0,
				direction: 'refresh'
			};
		}
	}
	return {
		shown: { key: next.key, firstPage: next.page, page: next.page, items: next.items },
		added: 0,
		direction: 'reset'
	};
}

export interface BrowseTarget {
	/** True when the destination has the same genre, decade, rating and sort as the screen. */
	sameFilters: boolean;
	page: number;
}

function wholeNumber(value: string | null): number | null {
	if (value === null || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

/** What an in-flight navigation means for the Browse screen, or null when it leads elsewhere. */
export function browseTarget(current: BrowseFilters, target: URL): BrowseTarget | null {
	if (target.pathname !== BROWSE_PATH) return null;
	const params = target.searchParams;
	const sameFilters =
		wholeNumber(params.get('genre')) === current.genreId &&
		wholeNumber(params.get('decade')) === current.decade &&
		wholeNumber(params.get('rating')) === current.minRating &&
		(params.get('sort') || DEFAULT_SORT) === current.sortBy;
	const page = wholeNumber(params.get('page'));
	return { sameFilters, page: page !== null && page >= 1 ? Math.trunc(page) : 1 };
}

function filmWord(count: number): string {
	return count === 1 ? 'film' : 'films';
}

export interface CountLineInput {
	shownCount: number;
	totalCount: number;
	firstPage: number;
	pageSize: number;
	/** describeFilters() output, empty when nothing is filtered. */
	summary: string;
	/** True when any filter is on, even one that has no readable name (an unknown genre id). */
	filtered?: boolean;
}

/** The one-line, polite status above the grid: "Showing 24 of 178 films · Action · 2010s". */
export function countLine({
	shownCount,
	totalCount,
	firstPage,
	pageSize,
	summary,
	filtered = false
}: CountLineInput): string {
	const suffix = summary ? ` · ${summary}` : '';
	if (totalCount === 0) return summary || filtered ? `No films match${suffix}` : 'No films yet';
	const offset = (firstPage - 1) * pageSize;
	const shown = firstPage > 1 ? `${offset + 1}–${offset + shownCount}` : String(shownCount);
	return `Showing ${shown} of ${totalCount} ${filmWord(totalCount)}${suffix}`;
}

/** What a screen reader hears once "Load more" has appended films. */
export function addedAnnouncement(added: number): string {
	return `${added} more ${filmWord(added)} loaded.`;
}
