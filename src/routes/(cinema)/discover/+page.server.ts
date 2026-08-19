import { db } from '$lib/server/db';
import { movies, movieGenres } from '$lib/server/db/schema';
import { desc, and, sql, inArray } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';

// Helper to fetch movies by vibe (genre IDs)
async function getVibeMovies(genreIds: number[], limit = 12) {
	// First get movie IDs that match these genres
	const genreMovieIds = await db
		.select({ movieId: movieGenres.movieId })
		.from(movieGenres)
		.where(inArray(movieGenres.genreId, genreIds))
		.limit(100); // Get a pool to sort

	if (genreMovieIds.length === 0) return [];

	const ids = genreMovieIds.map((item) => item.movieId);

	const vibeMovies = await db.query.movies.findMany({
		where: and(inArray(movies.id, ids), standardMovieVisibilityWhere()),
		orderBy: [desc(movies.popularity)], // Sort by popularity for discovery
		limit,
		with: { keywords: true, genres: { with: { genre: true } } }
	});

	return vibeMovies.map(applyLocalOverrides);
}

export async function load() {
	// Stable for the whole UTC day so "daily" does not change on refresh.
	const masterpieces = await db.query.movies.findMany({
		where: and(sql`${movies.voteCount} > 1000`, standardMovieVisibilityWhere()),
		orderBy: [desc(movies.voteAverage)],
		limit: 10,
		with: { keywords: true, genres: { with: { genre: true } } }
	});
	const utcDay = Math.floor(Date.now() / 86_400_000);
	const dailyMasterpiece =
		masterpieces.length > 0
			? applyLocalOverrides(masterpieces[utcDay % masterpieces.length])
			: null;

	// 2. Vibes Clusters
	// Sci-Fi (878), Thriller (53), Mystery (964)
	const mindBending = await getVibeMovies([878, 53, 964]);

	// Comedy (35), Romance (10749), Music (10402)
	const lateNightChill = await getVibeMovies([35, 10749, 10402]);

	// Action (28), Crime (80), War (10752)
	const adrenalineRush = await getVibeMovies([28, 80, 10752]);
	const customCinema: Awaited<ReturnType<typeof getVibeMovies>> = [];

	return {
		dailyMasterpiece,
		vibes: [
			{ title: '🧠 Mind-Bending & Psychological', movies: mindBending },
			{ title: '🍷 Late Night Chill', movies: lateNightChill },
			{ title: '⚡ Adrenaline Rush', movies: adrenalineRush }
		],
		// Dedicated adult/custom access remains disabled until its server-side
		// classification, intent gate, artwork, and cache boundaries are complete.
		customCinema
	};
}
