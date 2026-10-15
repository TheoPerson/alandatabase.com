import { describe, expect, it } from 'vitest';
import {
	MAX_QUERY_LENGTH,
	MIN_PREVIEW_LENGTH,
	canPreview,
	normalizeQuery,
	searchHref
} from './query';

describe('normalizeQuery', () => {
	it('trims and collapses whitespace', () => {
		expect(normalizeQuery('  the   matrix \t')).toBe('the matrix');
	});

	it('turns control characters into spaces so the API never rejects the request', () => {
		expect(normalizeQuery('blade\u0000runner\n2049')).toBe('blade runner 2049');
		expect(normalizeQuery('a\u007fb')).toBe('a b');
	});

	it('bounds the length to what the API accepts', () => {
		expect(normalizeQuery('x'.repeat(500))).toHaveLength(MAX_QUERY_LENGTH);
		expect(MAX_QUERY_LENGTH).toBe(120);
	});

	it('does not leave a trailing space after truncating', () => {
		const query = `${'x'.repeat(MAX_QUERY_LENGTH - 1)} tail`;
		expect(normalizeQuery(query).endsWith(' ')).toBe(false);
	});

	it('returns an empty string for non-strings', () => {
		expect(normalizeQuery(undefined)).toBe('');
		expect(normalizeQuery(null)).toBe('');
		expect(normalizeQuery(42 as unknown as string)).toBe('');
	});
});

describe('canPreview', () => {
	it('needs at least two characters', () => {
		expect(MIN_PREVIEW_LENGTH).toBe(2);
		expect(canPreview('')).toBe(false);
		expect(canPreview('a')).toBe(false);
		expect(canPreview('  a  ')).toBe(false);
		expect(canPreview('ab')).toBe(true);
	});

	it('counts characters, not UTF-16 units', () => {
		expect(canPreview('🎬')).toBe(false);
		expect(canPreview('🎬🎬')).toBe(true);
	});
});

describe('searchHref', () => {
	it('encodes the query for the results page', () => {
		expect(searchHref('the matrix')).toBe('/search?q=the%20matrix');
		expect(searchHref('a&b=c')).toBe('/search?q=a%26b%3Dc');
	});

	it('goes to the bare search page without a query', () => {
		expect(searchHref('')).toBe('/search');
		expect(searchHref('   ')).toBe('/search');
	});
});
