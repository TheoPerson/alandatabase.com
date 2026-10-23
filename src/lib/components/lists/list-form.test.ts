import { describe, expect, it } from 'vitest';
import { MAX_LIST_DESCRIPTION, MAX_LIST_NAME } from '$lib/server/security/list-input';
import {
	LIST_DESCRIPTION_MAX,
	LIST_NAME_MAX,
	LIST_PREVIEW_LIMIT,
	LIST_STARTERS,
	listPrefill,
	fieldStatus,
	filmCount,
	previewCountLabel,
	submittedLength,
	toListPosterItem,
	validateListForm
} from './list-form';

describe('list limits', () => {
	it('mirror the server bounds', () => {
		expect(LIST_NAME_MAX).toBe(MAX_LIST_NAME);
		expect(LIST_DESCRIPTION_MAX).toBe(MAX_LIST_DESCRIPTION);
		expect(LIST_PREVIEW_LIMIT).toBe(4);
	});
});

describe('submittedLength', () => {
	it('counts what the server measures: trimmed text', () => {
		expect(submittedLength('  Noir  ')).toBe(4);
		expect(submittedLength('')).toBe(0);
	});

	it('counts a line break as two characters in multiline text (CRLF on submit)', () => {
		expect(submittedLength('a\nb', true)).toBe(4);
		expect(submittedLength('a\r\nb', true)).toBe(4);
		expect(submittedLength('a\n\n', true)).toBe(1);
	});
});

describe('fieldStatus', () => {
	it('reports the visible counter and the remaining characters', () => {
		const status = fieldStatus('Best of 1999', LIST_NAME_MAX);
		expect(status).toMatchObject({ length: 12, remaining: 108, over: false });
		expect(status.counter).toBe('12/120');
		expect(status.announcement).toBe('108 characters left');
	});

	it('uses the singular for one character left', () => {
		expect(fieldStatus('x'.repeat(119), LIST_NAME_MAX).announcement).toBe('1 character left');
	});

	it('flags text over the limit', () => {
		const status = fieldStatus('x'.repeat(123), LIST_NAME_MAX);
		expect(status).toMatchObject({ length: 123, remaining: -3, over: true });
		expect(status.announcement).toBe('3 characters over the limit');
	});
});

describe('validateListForm', () => {
	it('accepts a name and an optional description', () => {
		expect(validateListForm('Noir', '')).toBeNull();
		expect(validateListForm('Noir', 'Rain and neon')).toBeNull();
	});

	it('requires a name that is not only spaces', () => {
		expect(validateListForm('   ', '')).toEqual({
			field: 'name',
			message: 'List name is required.'
		});
	});

	it('rejects a name or description over the limit with the server wording', () => {
		expect(validateListForm('x'.repeat(121), '')).toEqual({
			field: 'name',
			message: 'List name must be 120 characters or fewer.'
		});
		expect(validateListForm('Noir', 'x'.repeat(1001))).toEqual({
			field: 'description',
			message: 'Description must be 1000 characters or fewer.'
		});
	});
});

describe('previewCountLabel', () => {
	it('gives exact counts below the preview limit', () => {
		expect(previewCountLabel(0)).toBe('Empty');
		expect(previewCountLabel(1)).toBe('1 film');
		expect(previewCountLabel(3)).toBe('3 films');
	});

	it('never claims an exact count when the preview is full', () => {
		expect(previewCountLabel(4)).toBe('4+ films');
	});
});

describe('filmCount', () => {
	it('pluralises an exact count', () => {
		expect(filmCount(0)).toBe('0 films');
		expect(filmCount(1)).toBe('1 film');
		expect(filmCount(12)).toBe('12 films');
	});
});

describe('toListPosterItem', () => {
	it('maps a catalogue movie to a poster card linking to its page', () => {
		expect(
			toListPosterItem({
				id: 'abc',
				title: 'Heat',
				posterPath: '/heat.jpg',
				releaseDate: '1995-12-15',
				voteAverage: 7.9
			})
		).toEqual({
			id: 'abc',
			href: '/movies/abc',
			title: 'Heat',
			posterPath: '/heat.jpg',
			releaseDate: '1995-12-15',
			rating: 7.9
		});
	});

	it('keeps missing artwork and dates as null', () => {
		expect(toListPosterItem({ id: 'x', title: 'Untitled' })).toMatchObject({
			posterPath: null,
			releaseDate: null,
			rating: null
		});
	});
});

describe('fieldStatus counter visibility', () => {
	it('stays quiet until 80% of the limit', () => {
		expect(fieldStatus('x'.repeat(95), LIST_NAME_MAX)).toMatchObject({
			showCounter: false,
			near: false
		});
		expect(fieldStatus('x'.repeat(96), LIST_NAME_MAX)).toMatchObject({
			showCounter: true,
			near: true
		});
	});

	it('keeps the counter visible, and not merely near, once over the limit', () => {
		expect(fieldStatus('x'.repeat(130), LIST_NAME_MAX)).toMatchObject({
			showCounter: true,
			near: false,
			over: true
		});
	});
});

describe('LIST_STARTERS and listPrefill', () => {
	it('offers short starters whose links prefill the create form', () => {
		expect(LIST_STARTERS.length).toBeGreaterThanOrEqual(2);
		for (const starter of LIST_STARTERS) {
			const url = new URL(starter.href, 'https://alandatabase.com');
			expect(url.pathname).toBe('/my/lists/create');
			expect(listPrefill(url.searchParams)).toEqual({
				name: starter.name,
				description: starter.description
			});
		}
	});

	it('reads name and description, trimmed and cut to the limits', () => {
		const params = new URLSearchParams({
			name: `  ${'n'.repeat(200)}  `,
			description: 'd'.repeat(1500)
		});
		const prefill = listPrefill(params);
		expect(prefill.name).toHaveLength(LIST_NAME_MAX);
		expect(prefill.description).toHaveLength(LIST_DESCRIPTION_MAX);
	});

	it('gives empty strings when nothing is asked for', () => {
		expect(listPrefill(new URLSearchParams())).toEqual({ name: '', description: '' });
	});
});
