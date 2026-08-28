import { db } from '$lib/server/db';
import { movies, movieGenres } from '$lib/server/db/schema';
import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm';
import { applyLocalOverrides } from '$lib/server/services/movie.service';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';

// Helper to fetch movies by vibe (genre IDs)
async function getVibeMovies(genreIds: number[], limit = 12) {
	const vibeMovies = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			exists(
				db
					.select({ movieId: movieGenres.movieId })
					.from(movieGenres)
					.where(and(eq(movieGenres.movieId, movies.id), inArray(movieGenres.genreId, genreIds)))
			)
		),
		orderBy: [desc(movies.popularity), desc(movies.id)],
		limit,
		with: { keywords: true, genres: { with: { genre: true } } }
	});

	return vibeMovies.map(applyLocalOverrides);
}

export async function load() {
	// Keep each public rail independent: a temporarily unavailable query should
	// produce an honest empty rail instead of taking the whole page down.
	const [masterpiecesResult, mindBendingResult, lateNightChillResult, adrenalineRushResult] =
		await Promise.allSettled([
			db.query.movies.findMany({
				where: and(sql`${movies.voteCount} > 1000`, standardMovieVisibilityWhere()),
				orderBy: [desc(movies.voteAverage)],
				limit: 10,
				with: { keywords: true, genres: { with: { genre: true } } }
			}),
			getVibeMovies([878, 53, 9648]),
			getVibeMovies([35, 10749, 10402]),
			getVibeMovies([28, 80, 10752])
		]);

	// Stable for the whole UTC day so "daily" does not change on refresh.
	const masterpieces = masterpiecesResult.status === 'fulfilled' ? masterpiecesResult.value : [];
	const utcDay = Math.floor(Date.now() / 86_400_000);
	const dailyMasterpiece =
		masterpieces.length > 0
			? applyLocalOverrides(masterpieces[utcDay % masterpieces.length])
			: null;

	const mindBending = mindBendingResult.status === 'fulfilled' ? mindBendingResult.value : [];
	const lateNightChill =
		lateNightChillResult.status === 'fulfilled' ? lateNightChillResult.value : [];
	const adrenalineRush =
		adrenalineRushResult.status === 'fulfilled' ? adrenalineRushResult.value : [];
	const customCinema: Awaited<ReturnType<typeof getVibeMovies>> = [];
	const degraded = [
		masterpiecesResult,
		mindBendingResult,
		lateNightChillResult,
		adrenalineRushResult
	].some((result) => result.status === 'rejected');

	return {
		dailyMasterpiece,
		degraded,
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
