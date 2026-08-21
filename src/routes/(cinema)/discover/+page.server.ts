import { db } from '$lib/server/db';
import { movies, movieGenres } from '$lib/server/db/schema';
import { desc, eq, and, sql, inArray } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service';

// Helper to fetch movies by vibe (genre IDs)
async function getVibeMovies(genreIds: number[], limit = 12) {
	// First get movie IDs that match these genres
	const genreMovieIds = await db
		.select({ movieId: movieGenres.movieId })
		.from(movieGenres)
		.where(inArray(movieGenres.genreId, genreIds))
		.limit(100); // Get a pool to sort

	if (genreMovieIds.length === 0) return [];

	const ids = genreMovieIds.map((g) => g.movieId);

	const vibeMovies = await db.query.movies.findMany({
		where: and(inArray(movies.id, ids), eq(movies.adult, false)),
		orderBy: [desc(movies.popularity)], // Sort by popularity for discovery
		limit,
		with: { genres: { with: { genre: true } } }
	});

	return vibeMovies.map(applyLocalOverrides);
}

export async function load({ locals }) {
	// 1. Daily Masterpiece (Random top rated movie)
	// For now, we take one of the highest rated movies with high vote count
	const masterpieces = await db.query.movies.findMany({
		where: and(sql`${movies.voteCount} > 1000`, eq(movies.adult, false)),
		orderBy: [desc(movies.voteAverage)],
		limit: 10,
		with: { genres: { with: { genre: true } } }
	});
	// Pick a random one for the daily masterpiece
	const dailyMasterpiece =
		masterpieces.length > 0
			? applyLocalOverrides(masterpieces[Math.floor(Math.random() * masterpieces.length)])
			: null;

	// 2. Vibes Clusters
	// Sci-Fi (878), Thriller (53), Mystery (964)
	const mindBending = await getVibeMovies([878, 53, 964]);

	// Comedy (35), Romance (10749), Music (10402)
	const lateNightChill = await getVibeMovies([35, 10749, 10402]);

	// Action (28), Crime (80), War (10752)
	const adrenalineRush = await getVibeMovies([28, 80, 10752]);

	// 3. Custom Private Cinema (Hidden Gems & Adult)
	let customCinema: any[] = [];
	const isAdultEnabled = locals?.user?.settings?.adultEnabled === true;

	if (isAdultEnabled) {
		const rawCustom = await db.query.movies.findMany({
			where: sql`${movies.tmdbId} < 0 OR ${movies.adult} = true`,
			orderBy: [desc(movies.createdAt)],
			limit: 12,
			with: { genres: { with: { genre: true } } }
		});
		customCinema = rawCustom.map(applyLocalOverrides);
	}

	return {
		dailyMasterpiece,
		vibes: [
			{ title: '🧠 Mind-Bending & Psychological', movies: mindBending },
			{ title: '🍷 Late Night Chill', movies: lateNightChill },
			{ title: '⚡ Adrenaline Rush', movies: adrenalineRush }
		],
		customCinema
	};
}
