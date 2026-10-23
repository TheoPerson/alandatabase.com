import { describe, expect, it } from 'vitest';
import { isActivePath, PRIMARY_LINKS, TAB_LINKS } from './links';

describe('navigation links', () => {
	it('matches the root only exactly and other sections by prefix', () => {
		expect(isActivePath('/', '/')).toBe(true);
		expect(isActivePath('/movies', '/')).toBe(false);
		expect(isActivePath('/movies', '/movies')).toBe(true);
		expect(isActivePath('/movies/abc', '/movies')).toBe(true);
		expect(isActivePath('/moviesx', '/movies')).toBe(false);
		expect(isActivePath('/tv/123', '/movies')).toBe(false);
	});

	it('maps the library tab to every personal route', () => {
		expect(isActivePath('/my/lists/1', '/my/films')).toBe(true);
		expect(isActivePath('/auth/login', '/my/films')).toBe(false);
	});

	it('exposes five tabs with unique hrefs and the primary sections', () => {
		expect(TAB_LINKS.map((link) => link.label)).toEqual([
			'Home',
			'Movies',
			'TV',
			'Search',
			'Library'
		]);
		expect(new Set(TAB_LINKS.map((link) => link.href)).size).toBe(5);
		expect(PRIMARY_LINKS.map((link) => link.href)).toEqual([
			'/',
			'/movies',
			'/tv',
			'/discover',
			'/cinema/picker'
		]);
	});
});
