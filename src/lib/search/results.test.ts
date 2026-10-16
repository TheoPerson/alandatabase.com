import { describe, expect, it } from 'vitest';
import { parseSearchResponse } from './results';

describe('parseSearchResponse', () => {
	it('keeps well-formed hits with their display fields', () => {
		const hits = parseSearchResponse({
			query: 'heat',
			results: [
				{
					id: '603',
					title: 'The Matrix',
					releaseDate: '1999-03-30',
					posterPath: '/p.jpg',
					voteAverage: 8.2
				}
			]
		});
		expect(hits).toEqual([
			{ id: '603', title: 'The Matrix', year: '1999', rating: '8.2', posterPath: '/p.jpg' }
		]);
	});

	it('accepts numeric ids and string ratings', () => {
		const [hit] = parseSearchResponse({
			results: [{ id: 7, title: 'Seven', releaseDate: null, posterPath: null, voteAverage: '8.36' }]
		});
		expect(hit).toEqual({ id: '7', title: 'Seven', year: null, rating: '8.4', posterPath: null });
	});

	it('leaves out a missing or zero rating and an unparsable date', () => {
		const [hit] = parseSearchResponse({
			results: [{ id: 'a1', title: 'Obscure', releaseDate: 'soon', voteAverage: 0 }]
		});
		expect(hit.year).toBeNull();
		expect(hit.rating).toBeNull();
		expect(hit.posterPath).toBeNull();
	});

	it('drops entries without a usable id or title', () => {
		const hits = parseSearchResponse({
			results: [
				null,
				'x',
				{ title: 'No id' },
				{ id: '', title: 'Empty id' },
				{ id: '9', title: '   ' },
				{ id: '9' },
				{ id: '10', title: 'Fine' }
			]
		});
		expect(hits.map((hit) => hit.id)).toEqual(['10']);
	});

	it('refuses ids that could escape the film URL', () => {
		const hits = parseSearchResponse({
			results: [
				{ id: '../admin', title: 'x' },
				{ id: '1/2', title: 'x' },
				{ id: 'a b', title: 'x' },
				{ id: 'ok-id_1', title: 'Fine' }
			]
		});
		expect(hits.map((hit) => hit.id)).toEqual(['ok-id_1']);
	});

	it('drops duplicate ids', () => {
		const hits = parseSearchResponse({
			results: [
				{ id: '1', title: 'A' },
				{ id: '1', title: 'B' }
			]
		});
		expect(hits).toHaveLength(1);
	});

	it('returns an empty list for anything that is not the expected shape', () => {
		expect(parseSearchResponse(null)).toEqual([]);
		expect(parseSearchResponse('nope')).toEqual([]);
		expect(parseSearchResponse({})).toEqual([]);
		expect(parseSearchResponse({ results: 'x' })).toEqual([]);
		expect(parseSearchResponse({ error: 'bad' })).toEqual([]);
	});

	it('keeps server text as plain strings (never markup)', () => {
		const [hit] = parseSearchResponse({
			results: [{ id: '1', title: '<img src=x onerror=alert(1)>' }]
		});
		expect(hit.title).toBe('<img src=x onerror=alert(1)>');
	});
});

describe('parseSearchResponse with series', () => {
	it('keeps series as their own hits after the films', () => {
		const hits = parseSearchResponse({
			results: [{ id: 'f1', title: 'Film', releaseDate: '2001-01-01', voteAverage: 7 }],
			series: [
				{ id: 1396, title: 'Breaking Bad', firstAirDate: '2008', rating: 9.5, posterPath: '/b.jpg' }
			]
		});
		expect(hits.map((h) => [h.id, h.type ?? 'movie', h.year])).toEqual([
			['f1', 'movie', '2001'],
			['1396', 'series', '2008']
		]);
	});

	it('drops malformed series entries', () => {
		expect(
			parseSearchResponse({ results: [], series: [{ id: '../x', title: 'Bad' }, null] })
		).toEqual([]);
	});
});
