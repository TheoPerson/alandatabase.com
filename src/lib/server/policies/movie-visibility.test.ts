import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { movies } from '../db/schema';
import {
	isStandardMovie,
	KNOWN_EXPLICIT_KEYWORD_IDS,
	standardMovieVisibilityWhere
} from './movie-visibility';

describe('standard movie visibility policy', () => {
	it('allows a standard positive-TMDB movie', () => {
		expect(isStandardMovie({ adult: false, tmdbId: 27205, keywords: [] })).toBe(true);
	});

	it('fails closed when keyword classification was not loaded', () => {
		expect(isStandardMovie({ adult: false, tmdbId: 27205 })).toBe(false);
		expect(isStandardMovie({ adult: false, tmdbId: 27205, keywords: null })).toBe(false);
	});

	it('fails closed when the adult classification is missing or true', () => {
		expect(isStandardMovie({ tmdbId: 27205, keywords: [] })).toBe(false);
		expect(isStandardMovie({ adult: true, tmdbId: 27205, keywords: [] })).toBe(false);
	});

	it('quarantines custom and invalid TMDB identifiers', () => {
		expect(isStandardMovie({ adult: false, tmdbId: -10, keywords: [] })).toBe(false);
		expect(isStandardMovie({ adult: false, tmdbId: 0, keywords: [] })).toBe(false);
		expect(isStandardMovie({ adult: false, tmdbId: '27205', keywords: [] })).toBe(false);
	});

	it.each(KNOWN_EXPLICIT_KEYWORD_IDS)(
		'quarantines known explicit keyword %s across supported relation shapes',
		(keywordId) => {
			expect(isStandardMovie({ adult: false, tmdbId: 1, keywords: [keywordId] })).toBe(false);
			expect(isStandardMovie({ adult: false, tmdbId: 1, keywords: [{ keywordId }] })).toBe(false);
			expect(
				isStandardMovie({ adult: false, tmdbId: 1, keywords: [{ keyword: { id: keywordId } }] })
			).toBe(false);
		}
	);

	it('does not quarantine unrelated keywords', () => {
		expect(isStandardMovie({ adult: false, tmdbId: 27205, keywords: [{ keywordId: 42 }] })).toBe(
			true
		);
	});

	it('builds a parameterized database predicate with every quarantine rule', () => {
		const mockDb = drizzle.mock({ schema });
		const query = mockDb
			.select({ id: movies.id })
			.from(movies)
			.where(standardMovieVisibilityWhere())
			.toSQL();

		expect(query.sql).toContain('"movies"."adult" = $1');
		expect(query.sql).toContain('"movies"."tmdb_id" > $2');
		expect(query.sql).toContain('not exists (');
		expect(query.sql).not.toContain('not exists select');
		expect(query.sql).toContain('"movie_keywords"."keyword_id" in ($3, $4, $5)');
		expect(query.params).toEqual([false, 0, ...KNOWN_EXPLICIT_KEYWORD_IDS]);
	});
});
