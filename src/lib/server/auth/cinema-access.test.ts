import { describe, expect, it } from 'vitest';
import {
	isCinemaPageRoute,
	isCinemaRoute,
	getCinemaAccessRequirement,
	requiresCinemaSession,
	shouldUsePrivateResponseHeaders,
	validateReturnTo
} from './cinema-access';

describe('cinema-access rules', () => {
	it('should identify public routes', () => {
		expect(isCinemaRoute('/')).toBe(false);
		expect(isCinemaRoute('/auth/login')).toBe(false);
		expect(isCinemaRoute('/auth/register')).toBe(false);
		expect(isCinemaRoute('/404')).toBe(false);
	});

	it('keeps the public cinema catalogue browseable', () => {
		expect(isCinemaRoute('/movies')).toBe(true);
		expect(isCinemaRoute('/movies/123')).toBe(true);
		expect(isCinemaRoute('/tv')).toBe(true);
		expect(isCinemaRoute('/search')).toBe(true);
		expect(requiresCinemaSession('/movies')).toBe(false);
		expect(requiresCinemaSession('/movies/123')).toBe(false);
		expect(requiresCinemaSession('/movies/catalog/123')).toBe(false);
		expect(requiresCinemaSession('/tv')).toBe(false);
		expect(requiresCinemaSession('/discover')).toBe(false);
		expect(requiresCinemaSession('/search')).toBe(false);
	});

	it('protects personal, playback, mutation and data API surfaces', () => {
		expect(requiresCinemaSession('/admin')).toBe(true);
		expect(requiresCinemaSession('/setup')).toBe(true);
		expect(isCinemaRoute('/my/films')).toBe(true);
		expect(isCinemaRoute('/live')).toBe(true);
		expect(isCinemaRoute('/api/search')).toBe(true);
		expect(requiresCinemaSession('/api')).toBe(false);
		expect(requiresCinemaSession('/api/health')).toBe(false);
		expect(requiresCinemaSession('/api/search')).toBe(false);
		expect(requiresCinemaSession('/api/movies/catalog')).toBe(true);
		expect(requiresCinemaSession('/live')).toBe(true);
		expect(requiresCinemaSession('/my/films')).toBe(true);
		expect(requiresCinemaSession('/movies/custom')).toBe(true);
		expect(requiresCinemaSession('/movies/catalog/123/edit')).toBe(true);
		expect(requiresCinemaSession('/movies/catalog/123/merge')).toBe(true);
		expect(requiresCinemaSession('/movies/catalog/123/review')).toBe(true);
		expect(requiresCinemaSession('/movies/calendar')).toBe(true);
		expect(requiresCinemaSession('/movies/calendar/reminders/example.ics')).toBe(true);
		expect(getCinemaAccessRequirement('/my/films')).toBe('authenticated');
		expect(getCinemaAccessRequirement('/movies/catalog/123/review')).toBe('authenticated');
		expect(getCinemaAccessRequirement('/movies/catalog/123/edit')).toBe('catalog');
		expect(getCinemaAccessRequirement('/movies/catalog/123/merge')).toBe('catalog');
		expect(getCinemaAccessRequirement('/disclaimer')).toBe('catalog');
		expect(getCinemaAccessRequirement('/admin')).toBe('owner');
		expect(getCinemaAccessRequirement('/setup')).toBe('owner');
		expect(getCinemaAccessRequirement('/api/telemetry/events')).toBe('owner');
		expect(getCinemaAccessRequirement('/api/admin/calendar/sync')).toBe('owner');
		expect(getCinemaAccessRequirement('/movies/calendar')).toBe('authenticated');
	});

	it('prevents caching whenever a response can contain account or invitation data', () => {
		expect(shouldUsePrivateResponseHeaders('public', false, '/movies')).toBe(false);
		expect(shouldUsePrivateResponseHeaders('public', true, '/movies')).toBe(true);
		expect(shouldUsePrivateResponseHeaders('authenticated', false, '/my/films')).toBe(true);
		expect(shouldUsePrivateResponseHeaders('public', false, '/auth/register')).toBe(true);
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
		expect(validateReturnTo('/admin')).toBe('/admin');
		expect(validateReturnTo('/setup?step=hosting')).toBe('/setup?step=hosting');
		expect(validateReturnTo('https://evil.com/movies')).toBe('/movies'); // No absolute URLs allowed
	});
});
