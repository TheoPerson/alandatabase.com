import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// The catalogue is unreachable here: the sitemap must still list the static public pages.
vi.mock('$lib/server/db', () => ({
	db: {
		select: () => {
			throw new Error('database offline');
		}
	}
}));

import { GET } from './+server';

const disallowed = readFileSync(resolve(process.cwd(), 'static/robots.txt'), 'utf8')
	.split(/\r?\n/u)
	.filter((line) => line.startsWith('Disallow:'))
	.map((line) => line.replace('Disallow:', '').trim())
	.filter(Boolean);

async function locations(): Promise<string[]> {
	const response = await GET({} as never);
	const xml = await response.text();
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
}

describe('sitemap.xml', () => {
	it('lists only pages on the canonical host', async () => {
		for (const location of await locations()) {
			expect(new URL(location).host).toBe('alandatabase.com');
		}
	});

	it('never lists a path that robots.txt disallows', async () => {
		for (const location of await locations()) {
			const { pathname } = new URL(location);
			for (const rule of disallowed) {
				expect(
					pathname === rule || pathname.startsWith(`${rule}/`),
					`${pathname} is disallowed by "${rule}"`
				).toBe(false);
			}
		}
	});

	it('still lists the main public pages when the database is down', async () => {
		const pages = (await locations()).map((location) => new URL(location).pathname);
		expect(pages).toEqual(expect.arrayContaining(['/', '/movies', '/tv', '/discover']));
	});
});
