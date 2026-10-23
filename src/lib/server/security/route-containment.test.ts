import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '../../..');

const localOnlyRoutes = [
	'routes/(cinema)/search/+page.server.ts',
	'routes/(cinema)/movies/+page.server.ts',
	'routes/(cinema)/movies/catalog/+page.server.ts',
	'routes/(cinema)/movies/catalog/[id]/+page.server.ts',
	'routes/api/search/+server.ts',
	'routes/api/movies/catalog/+server.ts'
];

const protectedLoaders = [
	'routes/(cinema)/movies/+page.server.ts',
	'routes/(cinema)/movies/catalog/+page.server.ts',
	'routes/(cinema)/movies/catalog/[id]/+page.server.ts',
	'routes/(cinema)/tv/+page.server.ts',
	'routes/(cinema)/tv/[id]/+page.server.ts'
];

describe('route side-effect containment', () => {
	for (const relativePath of localOnlyRoutes) {
		it(`${relativePath} has no external lookup or notification fallback`, () => {
			const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');

			expect(source).not.toMatch(/TMDBClient|\$lib\/server\/tmdb|searchMovies/u);
			expect(source).not.toMatch(/notifySearchPerformed|ingestMovie/u);
			expect(source).not.toMatch(/\bfetch\s*\(/u);
		});
	}

	for (const relativePath of protectedLoaders) {
		it(`${relativePath} does not declare public caching`, () => {
			const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');

			expect(source).not.toMatch(/cache-control[\s\S]{0,80}public/iu);
			expect(source).not.toMatch(/s-maxage/iu);
		});
	}

	it('keeps the legacy catalogue page a pure redirect to Browse: no reads, no writes', () => {
		const source = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/catalog/+page.server.ts'),
			'utf8'
		);

		expect(source).toMatch(/redirect\(308/u);
		expect(source).not.toMatch(/\$lib\/server\/(db|services)|locals|actions/u);
		expect(() =>
			readFileSync(resolve(sourceRoot, 'routes/(cinema)/movies/catalog/+page.svelte'), 'utf8')
		).toThrow(/ENOENT/u);
	});

	it('keeps Browse a public, read-only loader with no account state or form actions', () => {
		const source = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/+page.server.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/export const actions|locals|interaction\.service|toggleWatchlist/u);
		expect(source).toMatch(/listCatalogue/u);
	});

	it('keeps the public status route safe while exposing bounded liveness', () => {
		const serverSource = readFileSync(
			resolve(sourceRoot, 'routes/(hub)/status/+page.server.ts'),
			'utf8'
		);
		const pageSource = readFileSync(
			resolve(sourceRoot, 'routes/(hub)/status/+page.svelte'),
			'utf8'
		);

		expect(serverSource).toMatch(/\$lib\/server\/db|drizzle-orm|SELECT 1/iu);
		expect(serverSource).not.toMatch(/\bfetch\s*\(/u);
		expect(serverSource).toMatch(/\.execute\s*\(/u);
		expect(serverSource).not.toMatch(/error\.message|stack|connectionString|DATABASE_URL/iu);
		expect(pageSource).not.toMatch(/EventSource|\/api\/telemetry\/events/u);
	});
});
