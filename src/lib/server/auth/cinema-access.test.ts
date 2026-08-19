import { describe, expect, it } from 'vitest';
import {
	isCinemaPageRoute,
	isCinemaRoute,
	requiresCinemaSession,
	validateReturnTo
} from './cinema-access';

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
		expect(isCinemaRoute('/live')).toBe(true);
		expect(isCinemaRoute('/api/search')).toBe(true);
		expect(requiresCinemaSession('/api/search')).toBe(true);
		expect(requiresCinemaSession('/api/movies/catalog')).toBe(true);
		expect(requiresCinemaSession('/live')).toBe(true);
	});

	it('should exempt only explicitly authenticated service routes from browser sessions', () => {
		expect(requiresCinemaSession('/api/telegram/webhook')).toBe(false);
		expect(requiresCinemaSession('/api/telegram/webhook/extra')).toBe(true);
		expect(isCinemaRoute('/api/telegram/webhook')).toBe(true);
		expect(isCinemaPageRoute('/api/search')).toBe(false);
	});

	it('should not overmatch similarly named public paths', () => {
		expect(isCinemaRoute('/moviesevil')).toBe(false);
		expect(isCinemaRoute('/live-score')).toBe(false);
		expect(isCinemaRoute('/apiary')).toBe(false);
	});

	it('should validate returnTo securely', () => {
		expect(validateReturnTo(null)).toBe('/movies');
		expect(validateReturnTo('/movies/123')).toBe('/movies/123');
		expect(validateReturnTo('/auth/login')).toBe('/movies'); // Shouldn't redirect to login
		expect(validateReturnTo('/api/search')).toBe('/movies');
		expect(validateReturnTo('/live')).toBe('/live');
		expect(validateReturnTo('https://evil.com/movies')).toBe('/movies'); // No absolute URLs allowed
	});
});
