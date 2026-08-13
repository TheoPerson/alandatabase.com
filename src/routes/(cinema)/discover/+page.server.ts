import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';

export async function load() {
	// 1. Trending (Popularity)
	const trending = await getTrendingMovies(12);

	// 2. Top Rated Masterpieces
	const topRated = await getTopRatedMovies(12);

	// 3. Recent Releases
	const recentReleases = await db.query.movies.findMany({
		where: sql`${movies.releaseDate} IS NOT NULL`,
		orderBy: [desc(movies.releaseDate)],
		limit: 12,
		with: {
			genres: {
				with: {
					genre: true
				}
			}
		}
	});

	// 4. Custom Private Cinema (Hidden Gems)
	// We identify them by adult = true OR negative tmdbId
	const customCinema = await db.query.movies.findMany({
		where: sql`${movies.tmdbId} < 0 OR ${movies.adult} = true`,
		orderBy: [desc(movies.createdAt)],
		limit: 12,
		with: {
			genres: {
				with: {
					genre: true
				}
			}
		}
	});

	return {
		trending,
		topRated,
		recentReleases,
		customCinema
	};
}
