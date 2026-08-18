import { describe, it, expect, vi } from 'vitest';
import { isCinemaRoute, validateReturnTo } from './cinema-access';

describe('cinema-access rules', () => {
	it('should identify public routes', () => {
		expect(isCinemaRoute('/')).toBe(false);
		expect(isCinemaRoute('/auth/login')).toBe(false);
		expect(isCinemaRoute('/auth/register')).toBe(false);
		expect(isCinemaRoute('/404')).toBe(false);
	});

	it('should identify protected cinema routes', () => {
		expect(isCinemaRoute('/movies')).toBe(true);
		expect(isCinemaRoute('/movies/123')).toBe(true);
		expect(isCinemaRoute('/tv')).toBe(true);
		expect(isCinemaRoute('/search')).toBe(true);
		expect(isCinemaRoute('/my/films')).toBe(true);
	});

	it('should validate returnTo securely', () => {
		expect(validateReturnTo(null)).toBe('/movies');
		expect(validateReturnTo('/movies/123')).toBe('/movies/123');
		expect(validateReturnTo('/auth/login')).toBe('/movies'); // Shouldn't redirect to login
		expect(validateReturnTo('https://evil.com/movies')).toBe('/movies'); // No absolute URLs allowed
	});
});
