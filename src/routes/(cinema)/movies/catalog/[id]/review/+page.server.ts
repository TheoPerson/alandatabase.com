import { error, fail, redirect } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import { userReviews } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function load({ params, locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const movie = await getMovieById(params.id);
	if (!movie) {
		throw error(404, 'Movie not found');
	}

	// Fetch existing review if any
	const existingReview = await db.query.userReviews.findFirst({
		where: and(eq(userReviews.userId, locals.user.id), eq(userReviews.movieId, movie.id))
	});

	return {
		movie,
		existingReview
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const content = formData.get('content')?.toString();
		const containsSpoilers = formData.get('containsSpoilers') === 'on';

		if (!content || content.trim() === '') {
			return fail(400, { error: 'Review content cannot be empty' });
		}

		try {
			const existingReview = await db.query.userReviews.findFirst({
				where: and(eq(userReviews.userId, locals.user.id), eq(userReviews.movieId, params.id))
			});

			if (existingReview) {
				await db.update(userReviews)
					.set({ content, containsSpoilers, updatedAt: new Date() })
					.where(eq(userReviews.id, existingReview.id));
			} else {
				await db.insert(userReviews)
					.values({
						userId: locals.user.id,
						movieId: params.id,
						content,
						containsSpoilers
					});
			}

			return { success: true };
		} catch (err) {
			console.error('Failed to save review:', err);
			return fail(500, { error: 'Failed to save review' });
		}
	}
};
