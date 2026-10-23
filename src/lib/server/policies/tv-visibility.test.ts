import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { createMigratedTestDatabase } from '../testing/pglite';
import { KNOWN_EXPLICIT_KEYWORD_IDS } from './standard-content';
import { isStandardTvShow, standardTvShowVisibilityWhere } from './tv-visibility';

describe('standard TV show visibility policy (in memory)', () => {
	it('allows a standard show and fails closed on missing classification', () => {
		expect(isStandardTvShow({ adult: false, tmdbId: 1399, keywords: [] })).toBe(true);
		expect(isStandardTvShow({ adult: false, tmdbId: 1399 })).toBe(false);
		expect(isStandardTvShow({ tmdbId: 1399, keywords: [] })).toBe(false);
		expect(isStandardTvShow(null)).toBe(false);
	});

	it.each(KNOWN_EXPLICIT_KEYWORD_IDS)('quarantines explicit keyword %s', (keywordId) => {
		expect(isStandardTvShow({ adult: false, tmdbId: 1, keywords: [{ keywordId }] })).toBe(false);
		expect(isStandardTvShow({ adult: false, tmdbId: 1, keywords: [keywordId] })).toBe(false);
	});

	it('quarantines adult and custom rows', () => {
		expect(isStandardTvShow({ adult: true, tmdbId: 1, keywords: [] })).toBe(false);
		expect(isStandardTvShow({ adult: false, tmdbId: -1, keywords: [] })).toBe(false);
	});
});

describe('standard TV show visibility predicate against PostgreSQL', () => {
	let context: Awaited<ReturnType<typeof createMigratedTestDatabase>>;

	beforeAll(async () => {
		context = await createMigratedTestDatabase();
		const { database } = context;
		const [, , , explicit] = await database
			.insert(schema.tvShows)
			.values([
				{ tmdbId: 201, name: 'Standard Show' },
				{ tmdbId: 202, name: 'Adult Show', adult: true },
				{ tmdbId: -3, name: 'Custom Show' },
				{ tmdbId: 204, name: 'Explicit Show' }
			])
			.returning();
		await database.insert(schema.keywords).values({
			id: KNOWN_EXPLICIT_KEYWORD_IDS[2],
			name: 'explicit'
		});
		await database.insert(schema.tvKeywords).values({
			showId: explicit.id,
			keywordId: KNOWN_EXPLICIT_KEYWORD_IDS[2]
		});
	});

	afterAll(async () => {
		await context?.pg.close();
	});

	it('works in the core and relational query builders', async () => {
		const core = await context.database
			.select({ name: schema.tvShows.name })
			.from(schema.tvShows)
			.where(standardTvShowVisibilityWhere());
		expect(core.map((row) => row.name)).toEqual(['Standard Show']);

		const relational = await context.database.query.tvShows.findMany({
			where: standardTvShowVisibilityWhere(),
			with: { keywords: true }
		});
		expect(relational.map((row) => row.name)).toEqual(['Standard Show']);
	});
});
