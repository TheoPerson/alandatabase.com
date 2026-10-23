import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { createMigratedTestDatabase } from '../testing/pglite';
import { KNOWN_EXPLICIT_KEYWORD_IDS, standardMovieVisibilityWhere } from './movie-visibility';

type TestContext = Awaited<ReturnType<typeof createMigratedTestDatabase>>;

let context: TestContext;

beforeAll(async () => {
	context = await createMigratedTestDatabase();
	const { database } = context;

	const [, , , explicit] = await database
		.insert(schema.movies)
		.values([
			{ tmdbId: 101, title: 'Standard Film' },
			{ tmdbId: 102, title: 'Adult Film', adult: true },
			{ tmdbId: -5, title: 'Custom Film' },
			{ tmdbId: 104, title: 'Explicit Keyword Film' }
		])
		.returning();

	await database.insert(schema.keywords).values([
		{ id: KNOWN_EXPLICIT_KEYWORD_IDS[0], name: 'explicit' },
		{ id: 42, name: 'harmless' }
	]);
	await database.insert(schema.movieKeywords).values({
		movieId: explicit.id,
		keywordId: KNOWN_EXPLICIT_KEYWORD_IDS[0]
	});
});

afterAll(async () => {
	await context?.pg.close();
});

describe('standard movie visibility predicate against PostgreSQL', () => {
	it('works in the core query builder', async () => {
		const rows = await context.database
			.select({ title: schema.movies.title })
			.from(schema.movies)
			.where(standardMovieVisibilityWhere());

		expect(rows.map((row) => row.title)).toEqual(['Standard Film']);
	});

	it('works in the relational query builder used by catalogue, search and detail reads', async () => {
		const rows = await context.database.query.movies.findMany({
			where: standardMovieVisibilityWhere(),
			with: { keywords: true }
		});

		expect(rows.map((row) => row.title)).toEqual(['Standard Film']);
	});

	it('works in findFirst combined with another condition', async () => {
		const row = await context.database.query.movies.findFirst({
			where: (movies, { and, eq }) => and(eq(movies.tmdbId, 104), standardMovieVisibilityWhere()),
			with: { keywords: true }
		});

		expect(row).toBeUndefined();
	});
});
