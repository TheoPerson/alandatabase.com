import { describe, expect, it } from 'vitest';
import { GO_TO_LINKS, buildPaletteModel, type PaletteModelInput } from './model';
import type { SearchHit } from './results';

const hit = (id: string, title = `Film ${id}`): SearchHit => ({
	id,
	title,
	year: '1999',
	rating: '8.2',
	posterPath: '/p.jpg'
});

function input(overrides: Partial<PaletteModelInput> = {}): PaletteModelInput {
	return { query: '', recents: [], status: 'idle', hits: [], ...overrides };
}

const values = (items: { value: string }[]) => items.map((item) => item.value);

describe('GO_TO_LINKS', () => {
	it('lists the pages the palette can open', () => {
		expect(GO_TO_LINKS.map((link) => [link.label, link.href])).toEqual([
			['Home', '/'],
			['Movies', '/movies'],
			['TV', '/tv'],
			['Discover', '/discover'],
			['Picker', '/cinema/picker'],
			['Library', '/my/films'],
			['Status', '/status']
		]);
	});
});

describe('buildPaletteModel with an empty query', () => {
	it('shows only the Go to group when nothing was searched before', () => {
		const model = buildPaletteModel(input());
		expect(model.top).toEqual([]);
		expect(model.groups.map((group) => group.id)).toEqual(['goto']);
		expect(model.groups[0].heading).toBe('Go to');
		expect(values(model.groups[0].items)).toEqual(GO_TO_LINKS.map((link) => `link:${link.href}`));
		expect(model.note).toBeNull();
		expect(model.placeholders).toBe(0);
	});

	it('puts Recent searches first, each re-running its search, then a Clear action', () => {
		const model = buildPaletteModel(input({ recents: ['heat', 'the matrix'] }));
		expect(model.groups.map((group) => group.id)).toEqual(['recent', 'goto']);
		const recent = model.groups[0];
		expect(recent.heading).toBe('Recent searches');
		expect(recent.items).toMatchObject([
			{ kind: 'recent', label: 'heat', href: '/search?q=heat', query: 'heat' },
			{ kind: 'recent', label: 'the matrix', href: '/search?q=the%20matrix' },
			{ kind: 'clear', value: 'clear-recent', label: 'Clear recent searches' }
		]);
	});

	it('treats whitespace as empty', () => {
		const model = buildPaletteModel(input({ query: '   ', recents: ['heat'] }));
		expect(model.groups.map((group) => group.id)).toEqual(['recent', 'goto']);
	});
});

describe('buildPaletteModel while typing', () => {
	it('always starts with a See all results item so Enter has a predictable target', () => {
		for (const status of ['idle', 'loading', 'ready', 'error'] as const) {
			const model = buildPaletteModel(input({ query: 'matrix', status }));
			expect(model.top).toEqual([
				{
					kind: 'search',
					value: 'search',
					label: 'See all results for “matrix”',
					href: '/search?q=matrix',
					query: 'matrix'
				}
			]);
		}
	});

	it('hides recent searches and the Go to group once the user types', () => {
		const model = buildPaletteModel(input({ query: 'ma', recents: ['heat'], status: 'loading' }));
		expect(model.groups.some((group) => group.id === 'recent' || group.id === 'goto')).toBe(false);
	});

	it('does not preview films for a single character and says why', () => {
		const model = buildPaletteModel(input({ query: 'a', status: 'idle' }));
		expect(model.groups).toEqual([]);
		expect(model.placeholders).toBe(0);
		expect(model.note).toEqual({
			tone: 'hint',
			text: 'Type at least 2 characters to preview films'
		});
	});

	it('shows skeleton rows while the first results load', () => {
		const model = buildPaletteModel(input({ query: 'matrix', status: 'loading' }));
		expect(model.placeholders).toBe(4);
		expect(model.groups).toEqual([]);
		expect(model.busy).toBe(true);
		expect(model.announcement).toBe('Searching…');
	});

	it('treats an unanswered searchable query as loading, never as empty', () => {
		const model = buildPaletteModel(input({ query: 'matrix', status: 'idle' }));
		expect(model.busy).toBe(true);
		expect(model.placeholders).toBe(4);
		expect(model.note).toBeNull();
	});

	it('keeps the previous films visible (busy) while a refined query loads', () => {
		const model = buildPaletteModel(
			input({ query: 'matrix r', status: 'loading', hits: [hit('1'), hit('2')] })
		);
		expect(model.placeholders).toBe(0);
		expect(model.busy).toBe(true);
		expect(values(model.groups[0].items)).toEqual(['movie:1', 'movie:2']);
	});

	it('lists films under Movies with their detail URL', () => {
		const model = buildPaletteModel(
			input({ query: 'matrix', status: 'ready', hits: [hit('603', 'The Matrix')] })
		);
		expect(model.busy).toBe(false);
		expect(model.groups).toHaveLength(1);
		expect(model.groups[0].id).toBe('movies');
		expect(model.groups[0].heading).toBe('Movies');
		expect(model.groups[0].items).toEqual([
			{
				kind: 'movie',
				value: 'movie:603',
				label: 'The Matrix',
				href: '/movies/603',
				hit: hit('603', 'The Matrix'),
				query: 'matrix'
			}
		]);
		expect(model.note).toBeNull();
		expect(model.announcement).toBe('1 film found');
	});

	it('announces plural counts', () => {
		const model = buildPaletteModel(
			input({ query: 'matrix', status: 'ready', hits: [hit('1'), hit('2'), hit('3')] })
		);
		expect(model.announcement).toBe('3 films found');
	});

	it('explains an empty result and offers the catalogue', () => {
		const model = buildPaletteModel(input({ query: 'zzzz', status: 'ready' }));
		expect(model.note).toEqual({ tone: 'info', text: 'No films match “zzzz”' });
		expect(model.groups).toHaveLength(1);
		expect(model.groups[0].items).toMatchObject([
			{ kind: 'browse', value: 'browse', label: 'Browse all films', href: '/movies' }
		]);
		expect(model.announcement).toBe('No films match “zzzz”');
	});

	it('reports an unavailable search as an error with a retry action', () => {
		const model = buildPaletteModel(input({ query: 'matrix', status: 'error' }));
		expect(model.note).toEqual({ tone: 'error', text: 'Search is unavailable right now' });
		expect(model.groups).toHaveLength(1);
		expect(model.groups[0].items).toMatchObject([
			{ kind: 'retry', value: 'retry', label: 'Try again' }
		]);
		// The alert role announces it; the live region stays quiet.
		expect(model.announcement).toBe('');
	});

	it('normalises the query shown in labels', () => {
		const model = buildPaletteModel(input({ query: '  the   matrix ', status: 'loading' }));
		expect(model.top[0].label).toBe('See all results for “the matrix”');
		expect(model.top[0]).toMatchObject({ href: '/search?q=the%20matrix' });
	});
});
