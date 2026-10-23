import { and, desc, eq, exists, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { movieGenres, movies } from '../db/schema';
import { standardMovieVisibilityWhere } from '../policies/movie-visibility';
import { prepareStandardMovies } from '../queries/local-movie-search';
import type { CatalogSort } from '../security/request-bounds';

// The most one request may ask for; the callers pass 24 today.
const MAX_CATALOGUE_PAGE_SIZE = 60;

export interface CatalogueQuery {
	page: number;
	limit: number;
	genreId: number | null;
	decade: number | null;
	minRating: number | null;
	sortBy: CatalogSort;
}

function orderFor(sortBy: CatalogSort): SQL[] {
	// Films without a rating or date sink to the end instead of leading a descending sort.
	if (sortBy === 'rating') return [sql`${movies.voteAverage} desc nulls last`, desc(movies.id)];
	if (sortBy === 'release') return [sql`${movies.releaseDate} desc nulls last`, desc(movies.id)];
	return [sql`${movies.popularity} desc nulls last`, desc(movies.id)];
}

function whereFor({
	genreId,
	decade,
	minRating
}: Pick<CatalogueQuery, 'genreId' | 'decade' | 'minRating'>) {
	const conditions: Array<SQL | undefined> = [standardMovieVisibilityWhere()];
	if (genreId !== null) {
		// A query-builder subquery keeps its own table names; hand-written SQL that names
		// movie_genres columns is re-aliased to `movies` by the relational query builder.
		conditions.push(
			exists(
				db
					.select({ movieId: movieGenres.movieId })
					.from(movieGenres)
					.where(and(eq(movieGenres.movieId, movies.id), eq(movieGenres.genreId, genreId)))
			)
		);
	}
	if (decade !== null) {
		conditions.push(
			sql`${movies.releaseDate} >= ${`${decade}-01-01`}::date`,
			sql`${movies.releaseDate} < ${`${decade + 10}-01-01`}::date`
		);
	}
	if (minRating !== null) conditions.push(sql`${movies.voteAverage} >= ${minRating}`);
	return and(...conditions);
}

/** One bounded, quarantine-safe page of the standard catalogue plus the filtered total. */
export async function listCatalogue(query: CatalogueQuery) {
	const limit = Math.min(Math.max(Math.trunc(query.limit) || 1, 1), MAX_CATALOGUE_PAGE_SIZE);
	const page = Math.max(Math.trunc(query.page) || 1, 1);
	const where = whereFor(query);

	const [rows, count] = await Promise.all([
		db.query.movies.findMany({
			where,
			orderBy: orderFor(query.sortBy),
			limit,
			offset: (page - 1) * limit,
			with: { keywords: true, genres: { with: { genre: true } } }
		}),
		db
			.select({ count: sql<number>`count(*)` })
			.from(movies)
			.where(where)
	]);

	return { movies: prepareStandardMovies(rows), totalCount: Number(count[0]?.count ?? 0) };
}
