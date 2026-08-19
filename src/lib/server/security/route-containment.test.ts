import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '../../..');

const localOnlyRoutes = [
	'routes/(cinema)/search/+page.server.ts',
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

	it('keeps the public status route free of infrastructure probes', () => {
		const serverSource = readFileSync(
			resolve(sourceRoot, 'routes/(hub)/status/+page.server.ts'),
			'utf8'
		);
		const pageSource = readFileSync(
			resolve(sourceRoot, 'routes/(hub)/status/+page.svelte'),
			'utf8'
		);

		expect(serverSource).not.toMatch(/\$lib\/server\/db|drizzle-orm|TMDB_API_KEY/iu);
		expect(serverSource).not.toMatch(/\bfetch\s*\(|\.execute\s*\(/u);
		expect(pageSource).not.toMatch(/EventSource|\/api\/telemetry\/events/u);
	});
});
