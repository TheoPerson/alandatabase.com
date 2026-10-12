import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import {
	movies,
	userMovieInteractions,
	userReviews,
	userLists,
	userListItems
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { applyInteraction, parseInteractionUpdate } from '$lib/server/services/interaction.service';
import { logServerError } from '$lib/server/security/logging';
import { hasPermission } from '$lib/server/auth/permissions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kept for the existing validation test; the validator now lives in the service.
export const _parseInteractionUpdate = parseInteractionUpdate;

async function resolveMovieUuid(movieIdOrTmdb: string): Promise<string | null> {
	if (UUID_REGEX.test(movieIdOrTmdb)) {
		const existing = await db.query.movies
			.findFirst({
				where: and(eq(movies.id, movieIdOrTmdb), standardMovieVisibilityWhere()),
				columns: { id: true }
			})
			.catch(() => null);
		return existing?.id ?? null;
	}

	if (/^\d+$/.test(movieIdOrTmdb)) {
		const tmdbId = parseInt(movieIdOrTmdb, 10);
		const existing = await db.query.movies
			.findFirst({
				where: and(eq(movies.tmdbId, tmdbId), standardMovieVisibilityWhere()),
				columns: { id: true }
			})
			.catch(() => null);

		return existing?.id ?? null;
	}

	return null;
}

export async function load({ params, locals }) {
	const movie = await getMovieById(params.id);
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;

	if (!movie) {
		throw error(404, {
			message: 'Movie not found in the database.'
		});
	}

	let interaction = null;
	let review = null;
	let userCustomLists: any[] = [];

	if (user) {
		const dbUuid = await resolveMovieUuid(movie.id);

		if (dbUuid) {
			[interaction, review, userCustomLists] = await Promise.all([
				db.query.userMovieInteractions
					.findFirst({
						where: and(
							eq(userMovieInteractions.userId, user.id),
							eq(userMovieInteractions.movieId, dbUuid)
						)
					})
					.catch(() => null),
				db.query.userReviews
					.findFirst({
						where: and(eq(userReviews.userId, user.id), eq(userReviews.movieId, dbUuid))
					})
					.catch(() => null),
				db.query.userLists
					.findMany({
						where: eq(userLists.userId, user.id),
						with: {
							items: {
								where: eq(userListItems.movieId, dbUuid)
							}
						}
					})
					.catch(() => [])
			]);
		}
	}

	return {
		movie,
		userInteraction: interaction,
		userReview: review,
		userCustomLists,
		user
	};
}

export const actions = {
	logInteraction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to log films.' });
		}
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal film activity needs a signed-in account.' });
		}

		const formData = await request.formData();
		const rawMovieId = formData.get('movieId')?.toString();
		const type = formData.get('type')?.toString();
		const value = formData.get('value')?.toString();

		if (!rawMovieId || !type) {
			return fail(400, { error: 'Invalid payload.' });
		}
		const parsedUpdate = parseInteractionUpdate(type, value);
		if (!parsedUpdate.ok) return fail(400, { error: parsedUpdate.error });

		try {
			const interaction = await applyInteraction(locals.user.id, rawMovieId, parsedUpdate);
			if (!interaction) {
				return fail(404, { error: 'Could not resolve movie record.' });
			}
			return { success: true, interaction };
		} catch (err) {
			logServerError('Movie interaction update failed', err);
			return fail(500, { error: 'Failed to update interaction.' });
		}
	},

	toggleList: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to modify lists.' });
		}
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal lists need a signed-in account.' });
		}

		const formData = await request.formData();
		const listId = formData.get('listId')?.toString();
		const rawMovieId = formData.get('movieId')?.toString();

		if (!listId || !rawMovieId) {
			return fail(400, { error: 'Invalid payload.' });
		}

		const movieId = await resolveMovieUuid(rawMovieId);
		if (!movieId) {
			return fail(404, { error: 'Movie not found.' });
		}

		try {
			// Verify user owns list
			const list = await db.query.userLists.findFirst({
				where: and(eq(userLists.id, listId), eq(userLists.userId, locals.user.id))
			});

			if (!list) {
				return fail(403, { error: 'Unauthorized or list not found.' });
			}

			// Check if already in list
			const existingItem = await db.query.userListItems.findFirst({
				where: and(eq(userListItems.listId, listId), eq(userListItems.movieId, movieId))
			});

			if (existingItem) {
				await db
					.delete(userListItems)
					.where(and(eq(userListItems.listId, listId), eq(userListItems.movieId, movieId)));
			} else {
				// Find max position
				const items = await db.query.userListItems.findMany({
					where: eq(userListItems.listId, listId)
				});
				const nextPos = items.length;

				await db.insert(userListItems).values({
					listId,
					movieId,
					position: nextPos
				});
			}

			return { success: true };
		} catch (err) {
			logServerError('Movie list update failed', err);
			return fail(500, { error: 'Failed to update list.' });
		}
	}
};
