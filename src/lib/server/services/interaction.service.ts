import { db } from '../db/index.js';
import { userMovieInteractions, userReviews, movies, activities } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isStandardMovie, standardMovieVisibilityWhere } from '../policies/movie-visibility.js';
import { prepareStandardMovie } from './movie.service.js';

// ── Activity Logging ────────────────────────────────────────────────────────
export async function logActivity(
	userId: string,
	actionType: string,
	movieId?: string,
	listId?: string,
	metadata?: Record<string, unknown>
) {
	try {
		await db.insert(activities).values({
			userId,
			actionType,
			...(movieId ? { movieId } : {}),
			...(listId ? { listId } : {}),
			...(metadata ? { metadata } : {})
		});
	} catch {
		// Non-blocking — never fail the main action due to logging
	}
}

const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Personal-library reads stay bounded: a single page must never scan a
// lifetime of interactions. 500 keeps every realistic library intact while
// capping the worst case.
const MAX_INTERACTION_ITEMS = 500;

function prepareInteractionItems(items: any[]) {
	return items
		.map((item) => {
			const movie = prepareStandardMovie(item.movie);
			return movie ? { ...item, movie } : null;
		})
		.filter((item): item is NonNullable<typeof item> => item !== null);
}

async function resolveMovieUuid(movieId: string): Promise<string | null> {
	if (!movieId) return null;
	if (isUuidRegex.test(movieId)) {
		const found = await db.query.movies.findFirst({
			where: and(eq(movies.id, movieId), standardMovieVisibilityWhere()),
			columns: { id: true }
		});
		return found?.id ?? null;
	}

	const isNumeric = /^\d+$/.test(movieId);
	if (isNumeric) {
		const tmdbId = parseInt(movieId, 10);
		const found = await db.query.movies.findFirst({
			where: and(eq(movies.tmdbId, tmdbId), standardMovieVisibilityWhere()),
			columns: { id: true }
		});
		if (found) return found.id;
	}
	return null;
}

// ── Single-field interaction updates (shared by the catalogue and detail routes) ──
const BOOLEAN_INTERACTION_TYPES = ['watched', 'watchlist', 'favorite'] as const;
type BooleanInteractionType = (typeof BOOLEAN_INTERACTION_TYPES)[number];

export type ParsedInteractionUpdate =
	| { ok: true; type: BooleanInteractionType; value: boolean }
	| { ok: true; type: 'rating'; value: number | null }
	| { ok: false; error: string };

export interface InteractionState {
	watched: boolean;
	watchlist: boolean;
	favorite: boolean;
	rating: number | null;
}

function isBooleanInteractionType(type: string | undefined): type is BooleanInteractionType {
	return BOOLEAN_INTERACTION_TYPES.includes(type as BooleanInteractionType);
}

/** Validates one `type`/`value` pair from a form: exact booleans, or a 0.5–5 half-star rating ('' clears it). */
export function parseInteractionUpdate(
	type: string | undefined,
	value: string | undefined
): ParsedInteractionUpdate {
	if (isBooleanInteractionType(type)) {
		if (value !== 'true' && value !== 'false') {
			return { ok: false, error: 'Interaction value must be true or false.' };
		}
		return { ok: true, type, value: value === 'true' };
	}

	if (type === 'rating') {
		if (value === '') return { ok: true, type, value: null };
		const rating = Number(value);
		if (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) {
			return { ok: false, error: 'Rating must be between 0.5 and 5 in half-star steps.' };
		}
		return { ok: true, type, value: rating };
	}

	return { ok: false, error: 'Unknown interaction type.' };
}

function toInteractionState(row: {
	watched: boolean;
	watchlist: boolean;
	favorite: boolean;
	rating: string | null;
}): InteractionState {
	return {
		watched: row.watched,
		watchlist: row.watchlist,
		favorite: row.favorite,
		rating: row.rating === null ? null : Number(row.rating)
	};
}

/**
 * Applies one validated update to the user's row for a standard movie and
 * returns the resulting state, or null when the movie is unknown or
 * quarantined (nothing is written in that case).
 */
export async function applyInteraction(
	userId: string,
	movieIdOrTmdb: string,
	update: ParsedInteractionUpdate
): Promise<InteractionState | null> {
	if (!update.ok) return null;
	const movieId = await resolveMovieUuid(movieIdOrTmdb);
	if (!movieId) return null;

	const payload: Partial<typeof userMovieInteractions.$inferInsert> = { updatedAt: new Date() };
	if (update.type === 'rating') {
		payload.rating = update.value === null ? null : update.value.toFixed(1);
	} else {
		payload[update.type] = update.value;
	}
	const today = new Date().toISOString().split('T')[0];
	const stampsWatchDate = update.type === 'watched' && update.value;

	// One atomic statement: two first interactions racing on the same film cannot collide on the
	// unique (user, movie) index, and the first watch date is kept once set.
	const [row] = await db
		.insert(userMovieInteractions)
		.values({ userId, movieId, ...payload, ...(stampsWatchDate ? { watchDate: today } : {}) })
		.onConflictDoUpdate({
			target: [userMovieInteractions.userId, userMovieInteractions.movieId],
			set: {
				...payload,
				...(stampsWatchDate
					? { watchDate: sql`coalesce(${userMovieInteractions.watchDate}, ${today})` }
					: {})
			}
		})
		.returning();
	if (!row) return null;

	// Activity feed semantics unchanged from the catalogue action: only positive events are logged.
	if (update.type === 'rating' && update.value !== null) {
		logActivity(userId, 'rated', movieId, undefined, { rating: update.value });
	} else if (update.type === 'watched' && update.value) {
		logActivity(userId, 'watched', movieId);
	} else if (update.type === 'favorite' && update.value) {
		logActivity(userId, 'favorited', movieId);
	} else if (update.type === 'watchlist' && update.value) {
		logActivity(userId, 'watchlisted', movieId);
	}

	return toInteractionState(row);
}

export async function getUserInteraction(userId: string, movieId: string) {
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
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return { watchlist: false };

	// Atomic: the flip happens in the database, so a concurrent first interaction cannot collide.
	const [row] = await db
		.insert(userMovieInteractions)
		.values({ userId, movieId: resolvedUuid, watchlist: true })
		.onConflictDoUpdate({
			target: [userMovieInteractions.userId, userMovieInteractions.movieId],
			set: { watchlist: sql`not ${userMovieInteractions.watchlist}`, updatedAt: new Date() }
		})
		.returning();
	if (row?.watchlist) logActivity(userId, 'watchlisted', resolvedUuid);
	return row;
}

export async function toggleFavorite(userId: string, movieId: string) {
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return { favorite: false };

	// Atomic: the flip happens in the database, so a concurrent first interaction cannot collide.
	const [row] = await db
		.insert(userMovieInteractions)
		.values({ userId, movieId: resolvedUuid, favorite: true })
		.onConflictDoUpdate({
			target: [userMovieInteractions.userId, userMovieInteractions.movieId],
			set: { favorite: sql`not ${userMovieInteractions.favorite}`, updatedAt: new Date() }
		})
		.returning();
	if (row?.favorite) logActivity(userId, 'favorited', resolvedUuid);
	return row;
}

export async function setMovieWatched(
	userId: string,
	movieId: string,
	watched: boolean,
	rating?: number,
	personalNotes?: string
) {
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
		if (watched)
			logActivity(
				userId,
				rating ? 'rated' : 'watched',
				resolvedUuid,
				undefined,
				rating ? { rating } : undefined
			);
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
		if (watched)
			logActivity(
				userId,
				rating ? 'rated' : 'watched',
				resolvedUuid,
				undefined,
				rating ? { rating } : undefined
			);
		return created;
	}
}

export async function getUserWatchlist(userId: string): Promise<any[]> {
	const items = await db.query.userMovieInteractions.findMany({
		where: and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.watchlist, true)),
		orderBy: [desc(userMovieInteractions.updatedAt)],
		limit: MAX_INTERACTION_ITEMS,
		with: {
			movie: {
				with: {
					keywords: true,
					genres: {
						with: {
							genre: true
						}
					}
				}
			}
		}
	});
	return prepareInteractionItems(items);
}

export async function getUserFavorites(userId: string): Promise<any[]> {
	const items = await db.query.userMovieInteractions.findMany({
		where: and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.favorite, true)),
		orderBy: [desc(userMovieInteractions.updatedAt)],
		limit: MAX_INTERACTION_ITEMS,
		with: {
			movie: {
				with: {
					keywords: true,
					genres: {
						with: {
							genre: true
						}
					}
				}
			}
		}
	});
	return prepareInteractionItems(items);
}

export async function getUserWatchedHistory(userId: string): Promise<any[]> {
	const items = await db.query.userMovieInteractions.findMany({
		where: and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.watched, true)),
		orderBy: [desc(userMovieInteractions.updatedAt)],
		limit: MAX_INTERACTION_ITEMS,
		with: {
			movie: {
				with: {
					keywords: true,
					genres: {
						with: {
							genre: true
						}
					}
				}
			}
		}
	});
	return prepareInteractionItems(items);
}

export async function addUserReview(
	userId: string,
	movieId: string,
	content: string,
	containsSpoilers = false
) {
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
	const resolvedUuid = await resolveMovieUuid(movieId);
	if (!resolvedUuid) return [];

	const reviews = await db.query.userReviews.findMany({
		where: eq(userReviews.movieId, resolvedUuid),
		orderBy: [desc(userReviews.createdAt)],
		limit: MAX_INTERACTION_ITEMS,
		with: {
			user: {
				columns: {
					id: true,
					username: true,
					displayName: true
				}
			}
		}
	});
	return reviews as any[];
}

export async function getUserStats(userId: string) {
	const interactions = await db.query.userMovieInteractions.findMany({
		where: eq(userMovieInteractions.userId, userId),
		limit: MAX_INTERACTION_ITEMS,
		with: {
			movie: {
				with: {
					keywords: true,
					genres: {
						with: {
							genre: true
						}
					}
				}
			}
		}
	});
	const visibleInteractions = interactions.filter((item) => isStandardMovie(item.movie));
	const watched = visibleInteractions.filter((item) => item.watched);
	const watchedCount = watched.length;
	const watchlistCount = visibleInteractions.filter((item) => item.watchlist).length;
	const favoritesCount = visibleInteractions.filter((item) => item.favorite).length;

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
