import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

function redirectOf(search: string) {
	try {
		load({
			url: new URL(`https://alandatabase.com/movies/catalog${search}`)
		} as unknown as Parameters<typeof load>[0]);
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('expected the legacy catalogue route to redirect');
}

describe('legacy catalogue redirect', () => {
	it('moves the bare route to Browse permanently', () => {
		expect(redirectOf('')).toMatchObject({ status: 308, location: '/movies' });
	});

	it('keeps the genre, decade, rating, sort and page', () => {
		expect(redirectOf('?genre=28')).toMatchObject({ status: 308, location: '/movies?genre=28' });
		expect(redirectOf('?genre=28&decade=2010&rating=7&sort=rating&page=3')).toMatchObject({
			status: 308,
			location: '/movies?genre=28&decade=2010&rating=7&sort=rating&page=3'
		});
	});

	it('writes the canonical query: stable order, no default sort, no page 1', () => {
		expect(redirectOf('?page=1&sort=popularity&genre=18')).toMatchObject({
			location: '/movies?genre=18'
		});
		expect(redirectOf('?sort=release&genre=18')).toMatchObject({
			location: '/movies?genre=18&sort=release'
		});
	});

	it('drops unknown parameters', () => {
		expect(redirectOf('?genre=28&utm_source=mail&q=x')).toMatchObject({
			location: '/movies?genre=28'
		});
	});

	it.each(['?genre=abc', '?decade=2015', '?rating=99', '?sort=bogus', '?page=0'])(
		'sends invalid parameters (%s) to the plain Browse page',
		(query) => {
			expect(redirectOf(query)).toMatchObject({ status: 308, location: '/movies' });
		}
	);
});
