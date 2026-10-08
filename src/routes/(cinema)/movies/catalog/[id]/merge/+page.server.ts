import { error, fail, redirect } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import {
	activities,
	authAuditEvents,
	movieCast,
	movieCrew,
	movieGenres,
	movieKeywords,
	movieProductionCompanies,
	movieVideos,
	movies,
	userMovieInteractions,
	userListItems,
	userReviews
} from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireCatalogManager } from '$lib/server/auth/owner';
import { logServerError } from '$lib/server/security/logging';

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
				// 1. Move Reviews (batched: one read per side, no per-row lookup)
				const sourceReviews = await tx.query.userReviews.findMany({
					where: eq(userReviews.movieId, sourceMovieId)
				});
				const reviewUserIds = [...new Set(sourceReviews.map((rev) => rev.userId))];
				const targetReviews =
					reviewUserIds.length > 0
						? await tx.query.userReviews.findMany({
								where: and(
									eq(userReviews.movieId, targetMovieId),
									inArray(userReviews.userId, reviewUserIds)
								)
							})
						: [];
				const targetReviewByUser = new Map(targetReviews.map((rev) => [rev.userId, rev]));
				for (const rev of sourceReviews) {
					const existing = targetReviewByUser.get(rev.userId);
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

				// 2. Move List Items (batched conflict check)
				const sourceListItems = await tx.query.userListItems.findMany({
					where: eq(userListItems.movieId, sourceMovieId)
				});
				const sourceListIds = [...new Set(sourceListItems.map((item) => item.listId))];
				const targetListItems =
					sourceListIds.length > 0
						? await tx.query.userListItems.findMany({
								where: and(
									eq(userListItems.movieId, targetMovieId),
									inArray(userListItems.listId, sourceListIds)
								)
							})
						: [];
				const targetListIds = new Set(targetListItems.map((item) => item.listId));
				for (const item of sourceListItems) {
					// Workaround composite primary key update
					await tx
						.delete(userListItems)
						.where(
							and(eq(userListItems.listId, item.listId), eq(userListItems.movieId, sourceMovieId))
						);
					if (!targetListIds.has(item.listId)) {
						await tx.insert(userListItems).values({
							listId: item.listId,
							movieId: targetMovieId,
							position: item.position,
							addedAt: item.addedAt
						});
					}
					// Else: target already has this list entry; the duplicate is dropped.
				}

				// 3. Move Interactions (batched conflict check)
				const sourceInteractions = await tx.query.userMovieInteractions.findMany({
					where: eq(userMovieInteractions.movieId, sourceMovieId)
				});
				const interactionUserIds = [...new Set(sourceInteractions.map((i) => i.userId))];
				const targetInteractions =
					interactionUserIds.length > 0
						? await tx.query.userMovieInteractions.findMany({
								where: and(
									eq(userMovieInteractions.movieId, targetMovieId),
									inArray(userMovieInteractions.userId, interactionUserIds)
								)
							})
						: [];
				const targetInteractionByUser = new Map(
					targetInteractions.map((i) => [i.userId, i])
				);
				for (const interaction of sourceInteractions) {
					const existing = targetInteractionByUser.get(interaction.userId);
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

				// 4. Preserve activity history before deleting the duplicate record.
				await tx
					.update(activities)
					.set({ movieId: targetMovieId })
					.where(eq(activities.movieId, sourceMovieId));

				// 5. Re-link taxonomy and media the target lacks. Without this,
				// the source delete below would cascade-drop genres, keywords,
				// companies, videos, and cast/crew credits that exist only here.
				const [sourceGenres, sourceKeywords, sourceCompanies] = await Promise.all([
					tx.query.movieGenres.findMany({ where: eq(movieGenres.movieId, sourceMovieId) }),
					tx.query.movieKeywords.findMany({ where: eq(movieKeywords.movieId, sourceMovieId) }),
					tx.query.movieProductionCompanies.findMany({
						where: eq(movieProductionCompanies.movieId, sourceMovieId)
					})
				]);
				if (sourceGenres.length > 0) {
					await tx
						.insert(movieGenres)
						.values(
							sourceGenres.map((row) => ({ movieId: targetMovieId, genreId: row.genreId }))
						)
						.onConflictDoNothing();
				}
				if (sourceKeywords.length > 0) {
					await tx
						.insert(movieKeywords)
						.values(
							sourceKeywords.map((row) => ({ movieId: targetMovieId, keywordId: row.keywordId }))
						)
						.onConflictDoNothing();
				}
				if (sourceCompanies.length > 0) {
					await tx
						.insert(movieProductionCompanies)
						.values(
							sourceCompanies.map((row) => ({
								movieId: targetMovieId,
								companyId: row.companyId
							}))
						)
						.onConflictDoNothing();
				}

				// Videos, cast, and crew carry their own ids with a uniqueness
				// rule per (movie, key) / (movie, person, role). Rows that would
				// collide with an existing target row are exact duplicates, so
				// only the non-conflicting ones are re-linked.
				const [sourceVideos, targetVideos, sourceCast, targetCast, sourceCrew, targetCrew] =
					await Promise.all([
						tx.query.movieVideos.findMany({ where: eq(movieVideos.movieId, sourceMovieId) }),
						tx.query.movieVideos.findMany({ where: eq(movieVideos.movieId, targetMovieId) }),
						tx.query.movieCast.findMany({ where: eq(movieCast.movieId, sourceMovieId) }),
						tx.query.movieCast.findMany({ where: eq(movieCast.movieId, targetMovieId) }),
						tx.query.movieCrew.findMany({ where: eq(movieCrew.movieId, sourceMovieId) }),
						tx.query.movieCrew.findMany({ where: eq(movieCrew.movieId, targetMovieId) })
					]);
				const targetVideoKeys = new Set(targetVideos.map((row) => row.key));
				const movableVideoIds = sourceVideos
					.filter((row) => !targetVideoKeys.has(row.key))
					.map((row) => row.id);
				if (movableVideoIds.length > 0) {
					await tx
						.update(movieVideos)
						.set({ movieId: targetMovieId })
						.where(inArray(movieVideos.id, movableVideoIds));
				}
				const targetCastKeys = new Set(
					targetCast.map((row) => `${row.personId}|${row.character ?? ''}`)
				);
				const movableCastIds = sourceCast
					.filter((row) => !targetCastKeys.has(`${row.personId}|${row.character ?? ''}`))
					.map((row) => row.id);
				if (movableCastIds.length > 0) {
					await tx
						.update(movieCast)
						.set({ movieId: targetMovieId })
						.where(inArray(movieCast.id, movableCastIds));
				}
				const targetCrewKeys = new Set(
					targetCrew.map((row) => `${row.personId}|${row.job ?? ''}`)
				);
				const movableCrewIds = sourceCrew
					.filter((row) => !targetCrewKeys.has(`${row.personId}|${row.job ?? ''}`))
					.map((row) => row.id);
				if (movableCrewIds.length > 0) {
					await tx
						.update(movieCrew)
						.set({ movieId: targetMovieId })
						.where(inArray(movieCrew.id, movableCrewIds));
				}

				// Keep the source collection when the target has none.
				const targetRow = await tx.query.movies.findFirst({
					where: eq(movies.id, targetMovieId),
					columns: { collectionId: true }
				});
				const sourceRow = await tx.query.movies.findFirst({
					where: eq(movies.id, sourceMovieId),
					columns: { collectionId: true }
				});
				if (targetRow && sourceRow && !targetRow.collectionId && sourceRow.collectionId) {
					await tx
						.update(movies)
						.set({ collectionId: sourceRow.collectionId })
						.where(eq(movies.id, targetMovieId));
				}

				// 6. Delete Source Movie (cascade drops only re-linked or duplicate rows)
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
