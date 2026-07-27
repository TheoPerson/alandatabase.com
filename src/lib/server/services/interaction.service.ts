import { db } from '../db/index.js';
import { userMovieInteractions, userLists, userListItems, userReviews, users, movies } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ensureTablesExist } from '../db/migrate.js';

async function checkDbReady() {
	await ensureTablesExist();
}

export async function getOrCreateDefaultUser() {
	await checkDbReady();
	const existing = await db.query.users.findFirst({
		where: eq(users.username, 'cinephile')
	});
	if (existing) return existing;

	const [created] = await db
		.insert(users)
		.values({
			email: 'cinephile@alan.local',
			username: 'cinephile',
			passwordHash: 'default_hash',
			displayName: 'Cinema Enthusiast'
		})
		.onConflictDoNothing()
		.returning();

	if (created) return created;
	const user = await db.query.users.findFirst({ where: eq(users.username, 'cinephile') });
	return user!;
}

const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveMovieUuid(movieId: string): Promise<string | null> {
	if (!movieId) return null;
	if (isUuidRegex.test(movieId)) return movieId;

	const isNumeric = /^\d+$/.test(movieId);
	if (isNumeric) {
		const tmdbId = parseInt(movieId, 10);
		const found = await db.query.movies.findFirst({
			where: eq(movies.tmdbId, tmdbId)
		});
		if (found) return found.id;
	}
	return null;
}

export async function getUserInteraction(userId: string, movieId: string) {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return null;

	return db.query.userMovieInteractions.findFirst({
		where: and(
			eq(userMovieInteractions.userId, userId),
			eq(userMovieInteractions.movieId, resolvedUuid)
		)
	});
}

export async function toggleWatchlist(userId: string, movieId: string) {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return { watchlist: false };

	const existing = await getUserInteraction(userId, resolvedUuid);

	if (existing) {
		const newWatchlistState = !existing.watchlist;
		const [updated] = await db
			.update(userMovieInteractions)
			.set({ watchlist: newWatchlistState, updatedAt: new Date() })
			.where(eq(userMovieInteractions.id, existing.id))
			.returning();
		return updated;
	} else {
		const [created] = await db
			.insert(userMovieInteractions)
			.values({
				userId,
				movieId: resolvedUuid,
				watchlist: true
			})
			.returning();
		return created;
	}
}

export async function toggleFavorite(userId: string, movieId: string) {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return { favorite: false };

	const existing = await getUserInteraction(userId, resolvedUuid);

	if (existing) {
		const newFavState = !existing.favorite;
		const [updated] = await db
			.update(userMovieInteractions)
			.set({ favorite: newFavState, updatedAt: new Date() })
			.where(eq(userMovieInteractions.id, existing.id))
			.returning();
		return updated;
	} else {
		const [created] = await db
			.insert(userMovieInteractions)
			.values({
				userId,
				movieId: resolvedUuid,
				favorite: true
			})
			.returning();
		return created;
	}
}

export async function setMovieWatched(
	userId: string,
	movieId: string,
	watched: boolean,
	rating?: number,
	personalNotes?: string
) {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return null;

	const existing = await getUserInteraction(userId, resolvedUuid);

	const updateFields: any = {
		watched,
		updatedAt: new Date()
	};

	if (rating !== undefined && rating > 0) {
		updateFields.rating = rating.toString();
	}
	if (personalNotes !== undefined) {
		updateFields.personalNotes = personalNotes;
	}
	if (watched) {
		updateFields.watchDate = new Date().toISOString().split('T')[0];
	}

	if (existing) {
		const [updated] = await db
			.update(userMovieInteractions)
			.set(updateFields)
			.where(eq(userMovieInteractions.id, existing.id))
			.returning();
		return updated;
	} else {
		const [created] = await db
			.insert(userMovieInteractions)
			.values({
				userId,
				movieId: resolvedUuid,
				...updateFields
			})
			.returning();
		return created;
	}
}

export async function getUserWatchlist(userId: string): Promise<any[]> {
	await checkDbReady();
	const items = await db.query.userMovieInteractions.findMany({
		where: and(
			eq(userMovieInteractions.userId, userId),
			eq(userMovieInteractions.watchlist, true)
		),
		orderBy: [desc(userMovieInteractions.updatedAt)],
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
	return items as any[];
}

export async function getUserFavorites(userId: string): Promise<any[]> {
	await checkDbReady();
	const items = await db.query.userMovieInteractions.findMany({
		where: and(
			eq(userMovieInteractions.userId, userId),
			eq(userMovieInteractions.favorite, true)
		),
		orderBy: [desc(userMovieInteractions.updatedAt)],
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
	return items as any[];
}

export async function getUserWatchedHistory(userId: string): Promise<any[]> {
	await checkDbReady();
	const items = await db.query.userMovieInteractions.findMany({
		where: and(
			eq(userMovieInteractions.userId, userId),
			eq(userMovieInteractions.watched, true)
		),
		orderBy: [desc(userMovieInteractions.updatedAt)],
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
	return items as any[];
}

export async function addUserReview(
	userId: string,
	movieId: string,
	content: string,
	containsSpoilers = false
) {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return null;

	const [review] = await db
		.insert(userReviews)
		.values({
			userId,
			movieId: resolvedUuid,
			content,
			containsSpoilers
		})
		.onConflictDoUpdate({
			target: [userReviews.userId, userReviews.movieId],
			set: {
				content,
				containsSpoilers,
				updatedAt: new Date()
			}
		})
		.returning();

	return review;
}

export async function getUserMovieReviews(movieId: string): Promise<any[]> {
	await checkDbReady();
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return [];

	const reviews = await db.query.userReviews.findMany({
		where: eq(userReviews.movieId, resolvedUuid),
		orderBy: [desc(userReviews.createdAt)],
		with: {
			user: true
		}
	});
	return reviews as any[];
}

export async function getUserStats(userId: string) {
	await checkDbReady();
	
	const [watchedResult] = await db.select({ count: sql<number>`count(*)` }).from(userMovieInteractions).where(and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.watched, true)));
	const [watchlistResult] = await db.select({ count: sql<number>`count(*)` }).from(userMovieInteractions).where(and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.watchlist, true)));
	const [favoritesResult] = await db.select({ count: sql<number>`count(*)` }).from(userMovieInteractions).where(and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.favorite, true)));

	const watchedCount = Number(watchedResult.count) || 0;
	const watchlistCount = Number(watchlistResult.count) || 0;
	const favoritesCount = Number(favoritesResult.count) || 0;

	// Optimization: only load watched movies for genre distribution and total runtime
	const watched = await db.query.userMovieInteractions.findMany({
		where: and(
			eq(userMovieInteractions.userId, userId),
			eq(userMovieInteractions.watched, true)
		),
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

	let totalRuntime = 0;
	const genreCounts: Record<string, number> = {};

	for (const item of watched) {
		if (item.movie?.runtime) {
			totalRuntime += item.movie.runtime;
		}
		if (item.movie?.genres) {
			for (const g of item.movie.genres) {
				const name = (g as any).genre?.name;
				if (name) {
					genreCounts[name] = (genreCounts[name] || 0) + 1;
				}
			}
		}
	}

	return {
		watchedCount,
		watchlistCount,
		favoritesCount,
		totalRuntimeMinutes: totalRuntime,
		totalRuntimeHours: Math.round((totalRuntime / 60) * 10) / 10,
		genreCounts
	};
}
