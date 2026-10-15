import { describe, expect, it } from 'vitest';
import type { BrowseFilters } from '$lib/catalogue/browse';
import { addedAnnouncement, browseTarget, countLine, fold, type ShownFilms } from './browse-state';

const none: BrowseFilters = { genreId: null, decade: null, minRating: null, sortBy: 'popularity' };

function films(from: number, to: number) {
	return Array.from({ length: to - from + 1 }, (_, index) => ({ id: `film-${from + index}` }));
}

function shown(
	firstPage: number,
	page: number,
	items: Array<{ id: string }>,
	key = '/movies'
): ShownFilms<{ id: string }> {
	return { key, firstPage, page, items };
}

describe('fold', () => {
	it('starts from the first view it is given', () => {
		const result = fold(null, { key: '/movies', page: 3, items: films(49, 72) });

		expect(result.shown).toMatchObject({ firstPage: 3, page: 3 });
		expect(result.shown.items).toHaveLength(24);
		expect(result.added).toBe(0);
		expect(result.direction).toBe('reset');
	});

	it('appends the next page and keeps where the visitor started', () => {
		const previous = shown(1, 1, films(1, 24));
		const result = fold(previous, { key: '/movies', page: 2, items: films(25, 48) });

		expect(result.direction).toBe('append');
		expect(result.shown).toMatchObject({ firstPage: 1, page: 2 });
		expect(result.shown.items).toHaveLength(48);
		expect(result.added).toBe(24);
	});

	it('never shows the same film twice when pages overlap', () => {
		const previous = shown(1, 1, films(1, 24));
		const result = fold(previous, { key: '/movies', page: 2, items: films(20, 30) });

		expect(result.shown.items.map((item) => item.id)).toEqual(films(1, 30).map((item) => item.id));
		expect(result.added).toBe(6);
	});

	it('puts an earlier page in front and remembers the last page loaded', () => {
		const previous = shown(3, 3, films(49, 72));
		const result = fold(previous, { key: '/movies', page: 2, items: films(25, 48) });

		expect(result.direction).toBe('prepend');
		expect(result.shown).toMatchObject({ firstPage: 2, page: 3 });
		expect(result.shown.items[0].id).toBe('film-25');
		expect(result.shown.items).toHaveLength(48);
		expect(result.added).toBe(24);
	});

	it('keeps appending after an earlier page was added in front', () => {
		const earlier = fold(shown(3, 3, films(49, 72)), {
			key: '/movies',
			page: 2,
			items: films(25, 48)
		}).shown;
		const result = fold(earlier, { key: '/movies', page: 4, items: films(73, 96) });

		expect(result.direction).toBe('append');
		expect(result.shown).toMatchObject({ firstPage: 2, page: 4 });
		expect(result.shown.items).toHaveLength(72);
	});

	it('starts over when the filters change', () => {
		const previous = shown(1, 2, films(1, 48));
		const result = fold(previous, { key: '/movies?genre=28', page: 1, items: films(100, 110) });

		expect(result.direction).toBe('reset');
		expect(result.shown).toMatchObject({ key: '/movies?genre=28', firstPage: 1, page: 1 });
		expect(result.shown.items).toHaveLength(11);
		expect(result.added).toBe(0);
	});

	it('starts over when the visitor jumps to a page that is not adjacent', () => {
		const previous = shown(1, 1, films(1, 24));
		const result = fold(previous, { key: '/movies', page: 5, items: films(97, 120) });

		expect(result.direction).toBe('reset');
		expect(result.shown).toMatchObject({ firstPage: 5, page: 5 });
	});

	it('refreshes a page it already shows without dropping the other pages', () => {
		const previous = shown(1, 2, [
			...films(1, 24),
			...Array.from({ length: 24 }, (_, index) => ({ id: `film-${25 + index}`, title: 'old' }))
		]);
		const refreshed = Array.from({ length: 24 }, (_, index) => ({
			id: `film-${25 + index}`,
			title: 'new'
		}));
		const result = fold(previous, { key: '/movies', page: 2, items: refreshed });

		expect(result.direction).toBe('refresh');
		expect(result.shown).toMatchObject({ firstPage: 1, page: 2 });
		expect(result.shown.items).toHaveLength(48);
		expect((result.shown.items[30] as { title?: string }).title).toBe('new');
		expect(result.added).toBe(0);
	});
});

describe('fold after a failed read', () => {
	it('fills an empty view when the same page is read again', () => {
		const result = fold(shown(1, 1, []), { key: '/movies', page: 1, items: films(1, 24) });

		expect(result.shown.items).toHaveLength(24);
		expect(result.direction).toBe('reset');
	});
});

describe('browseTarget', () => {
	it('ignores navigations that leave the browse page', () => {
		expect(browseTarget(none, new URL('https://x.test/movies/abc'))).toBeNull();
		expect(browseTarget(none, new URL('https://x.test/search?q=a'))).toBeNull();
	});

	it('recognises the next page of the same filters', () => {
		expect(browseTarget(none, new URL('https://x.test/movies?page=2'))).toEqual({
			sameFilters: true,
			page: 2
		});
		expect(
			browseTarget(
				{ ...none, genreId: 28, sortBy: 'rating' },
				new URL('https://x.test/movies?genre=28&sort=rating&page=3')
			)
		).toEqual({ sameFilters: true, page: 3 });
	});

	it('flags any change of genre, decade, rating or sort', () => {
		const current = { ...none, genreId: 28 };
		expect(browseTarget(current, new URL('https://x.test/movies'))?.sameFilters).toBe(false);
		expect(browseTarget(current, new URL('https://x.test/movies?genre=18'))?.sameFilters).toBe(
			false
		);
		expect(browseTarget(none, new URL('https://x.test/movies?decade=2010'))?.sameFilters).toBe(
			false
		);
		expect(browseTarget(none, new URL('https://x.test/movies?rating=7'))?.sameFilters).toBe(false);
		expect(browseTarget(none, new URL('https://x.test/movies?sort=release'))?.sameFilters).toBe(
			false
		);
	});

	it('treats the default sort and empty values as no filter', () => {
		expect(
			browseTarget(none, new URL('https://x.test/movies?sort=popularity&genre=&page=1'))
		).toEqual({ sameFilters: true, page: 1 });
	});

	it('falls back to page 1 for a malformed page', () => {
		expect(browseTarget(none, new URL('https://x.test/movies?page=abc'))?.page).toBe(1);
	});
});

describe('countLine', () => {
	const base = { firstPage: 1, pageSize: 24, summary: '' };

	it('says how many films are shown out of the total', () => {
		expect(countLine({ ...base, shownCount: 24, totalCount: 178 })).toBe('Showing 24 of 178 films');
	});

	it('appends the active filters', () => {
		expect(countLine({ ...base, shownCount: 24, totalCount: 178, summary: 'Action · 2010s' })).toBe(
			'Showing 24 of 178 films · Action · 2010s'
		);
	});

	it('reads as a range when the list starts after the first page', () => {
		expect(countLine({ ...base, firstPage: 3, shownCount: 24, totalCount: 178 })).toBe(
			'Showing 49–72 of 178 films'
		);
	});

	it('uses the singular for one film', () => {
		expect(countLine({ ...base, shownCount: 1, totalCount: 1 })).toBe('Showing 1 of 1 film');
	});

	it('is honest when nothing matches', () => {
		expect(countLine({ ...base, shownCount: 0, totalCount: 0 })).toBe('No films yet');
		expect(countLine({ ...base, shownCount: 0, totalCount: 0, summary: '8+ rating' })).toBe(
			'No films match · 8+ rating'
		);
	});

	it('says no film matches even when the filters have no readable name', () => {
		// A genre id that is not in the genre list still filters, it just has no label.
		expect(countLine({ ...base, shownCount: 0, totalCount: 0, filtered: true })).toBe(
			'No films match'
		);
	});
});

describe('addedAnnouncement', () => {
	it('tells a screen reader how many films arrived and where that leaves the list', () => {
		expect(addedAnnouncement(24, 48, 178)).toBe('24 more films loaded. Showing 48 of 178.');
		expect(addedAnnouncement(1, 25, 25)).toBe('1 more film loaded. Showing 25 of 25.');
	});
});
