import { error, fail, redirect } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import {
	activities,
	authAuditEvents,
	moviePersonalScores,
	movies,
	userMovieInteractions,
	userListItems,
	userReviews
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCatalogManager } from '$lib/server/auth/owner';
import { logServerError } from '$lib/server/security/logging';
import {
	ALAN_SCORE_DIMENSIONS,
	calculateAlanScore,
	normalizeAlanScoreTags,
	type AlanScoreValues
} from '$lib/alan-score';

export function _mergeReviewValues(
	existing: { content: string; containsSpoilers: boolean },
	source: { content: string; containsSpoilers: boolean }
) {
	return {
		content: `${existing.content}\n\n---\n\n${source.content}`,
		containsSpoilers: existing.containsSpoilers || source.containsSpoilers
	};
}

export function _mergeInteractionValues(
	existing: {
		watched: boolean;
		watchlist: boolean;
		favorite: boolean;
		rating: string | null;
		watchDate: string | null;
		rewatchCount: number;
		personalNotes: string | null;
	},
	source: {
		watched: boolean;
		watchlist: boolean;
		favorite: boolean;
		rating: string | null;
		watchDate: string | null;
		rewatchCount: number;
		personalNotes: string | null;
	}
) {
	const watchDates = [existing.watchDate, source.watchDate].filter((value): value is string =>
		Boolean(value)
	);
	const notes = [existing.personalNotes, source.personalNotes].filter((value): value is string =>
		Boolean(value)
	);

	return {
		watched: existing.watched || source.watched,
		watchlist: existing.watchlist || source.watchlist,
		favorite: existing.favorite || source.favorite,
		rating: existing.rating ?? source.rating,
		watchDate: watchDates.length > 0 ? watchDates.sort()[0] : null,
		rewatchCount: existing.rewatchCount + source.rewatchCount,
		personalNotes: notes.length > 0 ? notes.join('\n') : null,
		updatedAt: new Date()
	};
}

type StoredAlanScore = Pick<
	typeof moviePersonalScores.$inferSelect,
	| 'realism'
	| 'cinematography'
	| 'originalLanguageExperience'
	| 'tension'
	| 'cast'
	| 'atmosphere'
	| 'rewatchability'
	| 'note'
	| 'tags'
>;

export function _mergeAlanScoreValues(existing: StoredAlanScore, source: StoredAlanScore) {
	const numericValues = Object.fromEntries(
		ALAN_SCORE_DIMENSIONS.map(({ key }) => {
			const storedValue = existing[key] ?? source[key];
			return [key, storedValue === null ? null : Number(storedValue)];
		})
	) as AlanScoreValues;
	const calculation = calculateAlanScore(numericValues);
	const notes = [existing.note, source.note].filter((note): note is string => Boolean(note));

	return {
		...Object.fromEntries(
			ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, numericValues[key]?.toFixed(1) ?? null])
		),
		computedScore: calculation.score?.toFixed(1) ?? null,
		coverage: calculation.coverage,
		status: calculation.status,
		note: notes.length > 0 ? notes.join('\n\n---\n\n') : null,
		tags: normalizeAlanScoreTags([...existing.tags, ...source.tags]),
		updatedAt: new Date()
	};
}

export async function load({ params, locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	requireCatalogManager(locals.user);

	const sourceMovie = await getMovieById(params.id);
	if (!sourceMovie) {
		throw error(404, 'Source movie not found');
	}

	return {
		sourceMovie
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}
		requireCatalogManager(locals.user);
		const actorUserId = locals.user.id;

		const formData = await request.formData();
		const targetTmdbId = formData.get('targetTmdbId')?.toString();

		if (!targetTmdbId) {
			return fail(400, { error: 'Target TMDB ID is required' });
		}

		try {
			// Re-resolve both records inside the action. Direct POSTs must not
			// read, merge, or delete quarantined catalog rows.
			const [sourceMovie, targetMovie] = await Promise.all([
				getMovieById(params.id),
				getMovieById(targetTmdbId)
			]);

			if (!sourceMovie || !targetMovie) {
				return fail(400, {
					error: 'Both movies must exist in the approved local catalog.'
				});
			}

			if (targetMovie.id === sourceMovie.id) {
				return fail(400, { error: 'Cannot merge a movie into itself.' });
			}

			const sourceMovieId = sourceMovie.id;
			const targetMovieId = targetMovie.id;

			// Perform merge
			await db.transaction(async (tx) => {
				// 1. Move Reviews
				const sourceReviews = await tx.query.userReviews.findMany({
					where: eq(userReviews.movieId, sourceMovieId)
				});
				for (const rev of sourceReviews) {
					// Does user already have a review on target?
					const existing = await tx.query.userReviews.findFirst({
						where: and(eq(userReviews.userId, rev.userId), eq(userReviews.movieId, targetMovieId))
					});
					if (!existing) {
						await tx
							.update(userReviews)
							.set({ movieId: targetMovieId })
							.where(eq(userReviews.id, rev.id));
					} else {
						// Append review content
						await tx
							.update(userReviews)
							.set(_mergeReviewValues(existing, rev))
							.where(eq(userReviews.id, existing.id));
						// Delete old
						await tx.delete(userReviews).where(eq(userReviews.id, rev.id));
					}
				}

				// 2. Move List Items
				const sourceListItems = await tx.query.userListItems.findMany({
					where: eq(userListItems.movieId, sourceMovieId)
				});
				for (const item of sourceListItems) {
					const existing = await tx.query.userListItems.findFirst({
						where: and(
							eq(userListItems.listId, item.listId),
							eq(userListItems.movieId, targetMovieId)
						)
					});
					if (!existing) {
						// Workaround composite primary key update
						await tx
							.delete(userListItems)
							.where(
								and(eq(userListItems.listId, item.listId), eq(userListItems.movieId, sourceMovieId))
							);
						await tx.insert(userListItems).values({
							listId: item.listId,
							movieId: targetMovieId,
							position: item.position,
							addedAt: item.addedAt
						});
					} else {
						// Just delete duplicate
						await tx
							.delete(userListItems)
							.where(
								and(eq(userListItems.listId, item.listId), eq(userListItems.movieId, sourceMovieId))
							);
					}
				}

				// 3. Move Interactions (watched, rating, etc)
				const sourceInteractions = await tx.query.userMovieInteractions.findMany({
					where: eq(userMovieInteractions.movieId, sourceMovieId)
				});
				for (const interaction of sourceInteractions) {
					const existing = await tx.query.userMovieInteractions.findFirst({
						where: and(
							eq(userMovieInteractions.userId, interaction.userId),
							eq(userMovieInteractions.movieId, targetMovieId)
						)
					});
					if (!existing) {
						await tx
							.update(userMovieInteractions)
							.set({ movieId: targetMovieId })
							.where(eq(userMovieInteractions.id, interaction.id));
					} else {
						// Merge interactions
						await tx
							.update(userMovieInteractions)
							.set(_mergeInteractionValues(existing, interaction))
							.where(eq(userMovieInteractions.id, existing.id));

						await tx
							.delete(userMovieInteractions)
							.where(eq(userMovieInteractions.id, interaction.id));
					}
				}

				// 4. Move owner scores without losing target dimensions.
				const sourceScores = await tx.query.moviePersonalScores.findMany({
					where: eq(moviePersonalScores.movieId, sourceMovieId)
				});
				for (const score of sourceScores) {
					const existing = await tx.query.moviePersonalScores.findFirst({
						where: and(
							eq(moviePersonalScores.userId, score.userId),
							eq(moviePersonalScores.movieId, targetMovieId)
						)
					});
					if (!existing) {
						await tx
							.update(moviePersonalScores)
							.set({ movieId: targetMovieId })
							.where(eq(moviePersonalScores.id, score.id));
					} else {
						await tx
							.update(moviePersonalScores)
							.set(_mergeAlanScoreValues(existing, score))
							.where(eq(moviePersonalScores.id, existing.id));
						await tx.delete(moviePersonalScores).where(eq(moviePersonalScores.id, score.id));
					}
				}

				// 5. Preserve activity history before deleting the duplicate record.
				await tx
					.update(activities)
					.set({ movieId: targetMovieId })
					.where(eq(activities.movieId, sourceMovieId));

				// 6. Delete Source Movie (cascade will drop cast/crew links)
				await tx.delete(movies).where(eq(movies.id, sourceMovieId));

				await tx.insert(authAuditEvents).values({
					actorUserId,
					action: 'catalog.movie_merged',
					metadata: { sourceMovieId, targetMovieId }
				});
			});

			return { success: true, newId: targetMovieId };
		} catch (err) {
			logServerError('Movie merge failed', err);
			return fail(500, { error: 'Failed to merge movies' });
		}
	}
};
