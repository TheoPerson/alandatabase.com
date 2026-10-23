import { describe, expect, it } from 'vitest';
import { validityMessage, withReturnTo, type ValidityLike } from './auth-form';

const valid: ValidityLike = {
	valid: true,
	valueMissing: false,
	typeMismatch: false,
	tooShort: false,
	tooLong: false,
	patternMismatch: false
};

describe('withReturnTo', () => {
	it('leaves the base untouched without a returnTo', () => {
		expect(withReturnTo('?/login', null)).toBe('?/login');
		expect(withReturnTo('/auth/login', '')).toBe('/auth/login');
		expect(withReturnTo('/auth/register', undefined)).toBe('/auth/register');
	});

	it('appends an encoded returnTo to an action or a page path', () => {
		expect(withReturnTo('?/login', '/my/films')).toBe('?/login&returnTo=%2Fmy%2Ffilms');
		expect(withReturnTo('/auth/register', '/my')).toBe('/auth/register?returnTo=%2Fmy');
	});

	it('round-trips values with query and hash characters exactly', () => {
		const returnTo = '/movies/12?tab=cast&x=1#top';
		const href = withReturnTo('/auth/login', returnTo);
		expect(new URL(href, 'https://example.test').searchParams.get('returnTo')).toBe(returnTo);
	});

	it('adds extra parameters and skips empty ones', () => {
		expect(withReturnTo('?/register', '/x', { invite: 'abc' })).toBe(
			'?/register&returnTo=%2Fx&invite=abc'
		);
		expect(withReturnTo('?/register', null, { invite: null })).toBe('?/register');
		expect(withReturnTo('?/register', null, { invite: 'a b' })).toBe('?/register&invite=a%20b');
	});
});

describe('validityMessage', () => {
	it('returns null for a valid field', () => {
		expect(validityMessage(valid, { label: 'Password' })).toBeNull();
	});

	it('asks for a missing value in English, with an optional override', () => {
		expect(
			validityMessage({ ...valid, valid: false, valueMissing: true }, { label: 'Password' })
		).toBe('Enter your password.');
		expect(
			validityMessage(
				{ ...valid, valid: false, valueMissing: true },
				{ label: 'Owner setup key', missing: 'Enter the owner setup key.' }
			)
		).toBe('Enter the owner setup key.');
	});

	it('explains length limits with the configured numbers', () => {
		expect(
			validityMessage(
				{ ...valid, valid: false, tooShort: true },
				{ label: 'Password', minLength: 12 }
			)
		).toBe('Use at least 12 characters.');
		expect(
			validityMessage(
				{ ...valid, valid: false, tooLong: true },
				{ label: 'Password', maxLength: 128 }
			)
		).toBe('Use at most 128 characters.');
	});

	it('uses the field hint for a pattern or type mismatch', () => {
		expect(
			validityMessage(
				{ ...valid, valid: false, patternMismatch: true },
				{ label: 'Username', patternHint: 'Use letters, numbers, dashes or underscores.' }
			)
		).toBe('Use letters, numbers, dashes or underscores.');
		expect(
			validityMessage({ ...valid, valid: false, typeMismatch: true }, { label: 'Email' })
		).toBe('Enter a valid email.');
	});

	it('falls back to a generic message for other invalid states', () => {
		expect(validityMessage({ ...valid, valid: false }, { label: 'Email' })).toBe(
			'Check your email.'
		);
	});
});
