import { db } from '../db';
import { userMovieInteractions, activities, movieCrew, people } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import type { UserTasteProfile } from './types';

export async function getUserTasteProfile(userId?: string | null): Promise<UserTasteProfile> {
	if (!userId) {
		return createGuestTasteProfile();
	}

	try {
		// 1. Fetch user's interactions with movies & genres
		const interactions = await db.query.userMovieInteractions.findMany({
			where: eq(userMovieInteractions.userId, userId),
			with: {
				movie: {
					with: {
						genres: {
							with: {
								genre: true
							}
						}
					}
				}
			}
		});

		const watchedMovieIds = new Set<string>();
		const dislikedMovieIds = new Set<string>();
		const favoriteMovieIds = new Set<string>();
		const watchlistMovieIds = new Set<string>();

		const rawGenreScores: Record<string, number> = {};
		const decadeCounts: Record<string, number> = {};
		let totalRuntime = 0;
		let runtimeCount = 0;

		const highRatedMovieIds: string[] = [];

		for (const inter of interactions) {
			const m = inter.movie;
			if (!m) continue;

			if (inter.watched) {
				watchedMovieIds.add(m.id);
			}
			if (inter.favorite) {
				favoriteMovieIds.add(m.id);
			}
			if (inter.watchlist) {
				watchlistMovieIds.add(m.id);
			}

			const ratingNum = inter.rating ? parseFloat(inter.rating) : null;
			if (ratingNum !== null && ratingNum <= 2.0) {
				dislikedMovieIds.add(m.id);
			}
			if (inter.favorite || (ratingNum !== null && ratingNum >= 4.0)) {
				highRatedMovieIds.push(m.id);
			}

			// Weighting: Favorites get 2.5x, High rating 2.0x, Watched 1.0x, Low rating 0x
			let interactionWeight = 1.0;
			if (inter.favorite) interactionWeight += 1.5;
			if (ratingNum !== null) {
				if (ratingNum >= 4.5) interactionWeight += 1.5;
				else if (ratingNum >= 4.0) interactionWeight += 1.0;
				else if (ratingNum <= 2.0) interactionWeight = 0;
			}

			if (interactionWeight > 0 && m.genres) {
				for (const mg of m.genres) {
					const gName = (mg as any).genre?.name;
					if (gName) {
						rawGenreScores[gName] = (rawGenreScores[gName] || 0) + interactionWeight;
					}
				}
			}

			if (m.releaseDate) {
				const year = new Date(m.releaseDate).getFullYear();
				if (!isNaN(year)) {
					const decade = `${Math.floor(year / 10) * 10}s`;
					decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
				}
			}

			if (m.runtime && m.runtime > 0) {
				totalRuntime += m.runtime;
				runtimeCount++;
			}
		}

		// 2. Resolve favorite directors from high rated / favorite films
		const favoriteDirectors = new Set<string>();
		if (highRatedMovieIds.length > 0) {
			try {
				const directors = await db
					.select({ name: people.name })
					.from(movieCrew)
					.innerJoin(people, eq(movieCrew.personId, people.id))
					.where(
						and(
							inArray(movieCrew.movieId, highRatedMovieIds.slice(0, 50)),
							eq(movieCrew.job, 'Director')
						)
					);

				for (const d of directors) {
					if (d.name) favoriteDirectors.add(d.name.toLowerCase());
				}
			} catch {
				// Non-blocking
			}
		}

		// 3. Normalize genre weights (0.0 to 1.0)
		const maxGenreScore = Math.max(...Object.values(rawGenreScores), 1);
		const genreWeights: Record<string, number> = {};
		for (const [genre, score] of Object.entries(rawGenreScores)) {
			genreWeights[genre] = Math.min(1.0, Math.round((score / maxGenreScore) * 100) / 100);
		}

		const topGenres = Object.entries(genreWeights)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([g]) => g);

		// 4. Fetch recent "not tonight" skips from activities
		const recentSkippedMovieIds = new Set<string>();
		try {
			const recentSkips = await db
				.select({ movieId: activities.movieId })
				.from(activities)
				.where(
					and(
						eq(activities.userId, userId),
						eq(activities.actionType, 'picker_not_tonight'),
						sql`${activities.createdAt} > NOW() - INTERVAL '14 days'`
					)
				)
				.limit(100);

			for (const skip of recentSkips) {
				if (skip.movieId) recentSkippedMovieIds.add(skip.movieId);
			}
		} catch {
			// Non-blocking
		}

		return {
			genreWeights,
			topGenres,
			favoriteDirectors,
			preferredDecades: decadeCounts,
			avgRuntime: runtimeCount > 0 ? Math.round(totalRuntime / runtimeCount) : 115,
			totalLogged: interactions.length,
			watchedMovieIds,
			dislikedMovieIds,
			favoriteMovieIds,
			watchlistMovieIds,
			recentSkippedMovieIds
		};
	} catch (err) {
		console.warn('Failed to build user taste profile, falling back to guest profile:', err);
		return createGuestTasteProfile();
	}
}

function createGuestTasteProfile(): UserTasteProfile {
	return {
		genreWeights: {
			Drama: 0.8,
			Thriller: 0.8,
			Crime: 0.75,
			'Science Fiction': 0.7,
			Action: 0.65,
			Comedy: 0.5,
			Mystery: 0.6
		},
		topGenres: ['Drama', 'Thriller', 'Crime', 'Science Fiction'],
		favoriteDirectors: new Set<string>([
			'christopher nolan',
			'martin scorsese',
			'quentin tarantino',
			'david fincher',
			'denis villeneuve',
			'stanley kubrick',
			'steven spielberg',
			'ridley scott'
		]),
		preferredDecades: { '1990s': 3, '2000s': 4, '2010s': 5, '2020s': 3 },
		avgRuntime: 118,
		totalLogged: 0,
		watchedMovieIds: new Set(),
		dislikedMovieIds: new Set(),
		favoriteMovieIds: new Set(),
		watchlistMovieIds: new Set(),
		recentSkippedMovieIds: new Set()
	};
}
