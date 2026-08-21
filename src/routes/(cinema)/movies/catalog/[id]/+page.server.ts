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
import { logActivity } from '$lib/server/services/interaction.service';
import { ingestMovie } from '$lib/server/tmdb';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveMovieUuid(movieIdOrTmdb: string): Promise<string | null> {
	if (UUID_REGEX.test(movieIdOrTmdb)) {
		return movieIdOrTmdb;
	}

	if (/^\d+$/.test(movieIdOrTmdb)) {
		const tmdbId = parseInt(movieIdOrTmdb, 10);
		const existing = await db.query.movies
			.findFirst({
				where: eq(movies.tmdbId, tmdbId)
			})
			.catch(() => null);

		if (existing) {
			return existing.id;
		}

		try {
			const newUuid = await ingestMovie(tmdbId, { notifyTelegram: false });
			if (newUuid) return newUuid;
		} catch (err) {
			console.warn('Auto-ingest on resolveMovieUuid failed:', err);
		}
	}

	return null;
}

export async function load({ params, locals, setHeaders }) {
	const movie = await getMovieById(params.id);

	if (!movie) {
		throw error(404, {
			message: 'Movie not found in the database.'
		});
	}

	if (!locals.user) {
		setHeaders({
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
		});
	}

	let interaction = null;
	let review = null;
	let userCustomLists: any[] = [];

	if (locals.user) {
		const dbUuid = await resolveMovieUuid(movie.id);

		if (dbUuid) {
			[interaction, review, userCustomLists] = await Promise.all([
				db.query.userMovieInteractions
					.findFirst({
						where: and(
							eq(userMovieInteractions.userId, locals.user.id),
							eq(userMovieInteractions.movieId, dbUuid)
						)
					})
					.catch(() => null),
				db.query.userReviews
					.findFirst({
						where: and(eq(userReviews.userId, locals.user.id), eq(userReviews.movieId, dbUuid))
					})
					.catch(() => null),
				db.query.userLists
					.findMany({
						where: eq(userLists.userId, locals.user.id),
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
		user: locals.user
	};
}

export const actions = {
	logInteraction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to log films.' });
		}

		const formData = await request.formData();
		const rawMovieId = formData.get('movieId')?.toString();
		const type = formData.get('type')?.toString(); // 'watched' | 'watchlist' | 'favorite' | 'rating'
		const value = formData.get('value')?.toString();

		if (!rawMovieId || !type) {
			return fail(400, { error: 'Invalid payload.' });
		}

		const movieId = await resolveMovieUuid(rawMovieId);
		if (!movieId) {
			return fail(404, { error: 'Could not resolve movie record.' });
		}

		try {
			// Find existing interaction
			let interaction = await db.query.userMovieInteractions.findFirst({
				where: and(
					eq(userMovieInteractions.userId, locals.user.id),
					eq(userMovieInteractions.movieId, movieId)
				)
			});

			// Prepare update payload
			const payload: any = {
				updatedAt: new Date()
			};

			if (type === 'watched') payload.watched = value === 'true';
			if (type === 'watchlist') payload.watchlist = value === 'true';
			if (type === 'favorite') payload.favorite = value === 'true';
			if (type === 'rating') payload.rating = value ? parseFloat(value) : null;
			if (type === 'watched' && value === 'true' && (!interaction || !interaction.watchDate)) {
				payload.watchDate = new Date().toISOString().split('T')[0];
			}

			if (interaction) {
				await db
					.update(userMovieInteractions)
					.set(payload)
					.where(eq(userMovieInteractions.id, interaction.id));
			} else {
				payload.userId = locals.user.id;
				payload.movieId = movieId;
				await db.insert(userMovieInteractions).values(payload);
			}

			// Log activity (non-blocking)
			if (type === 'rating' && value) {
				logActivity(locals.user.id, 'rated', movieId, undefined, { rating: parseFloat(value) });
			} else if (type === 'watched' && value === 'true') {
				logActivity(locals.user.id, 'watched', movieId);
			} else if (type === 'favorite' && value === 'true') {
				logActivity(locals.user.id, 'favorited', movieId);
			} else if (type === 'watchlist' && value === 'true') {
				logActivity(locals.user.id, 'watchlisted', movieId);
			}

			return { success: true };
		} catch (err) {
			console.error('Interaction error:', err);
			return fail(500, { error: 'Failed to update interaction.' });
		}
	},

	toggleList: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to modify lists.' });
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
			console.error('Toggle list error:', err);
			return fail(500, { error: 'Failed to update list.' });
		}
	}
};
