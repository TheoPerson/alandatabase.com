import { error, fail, redirect } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load({ params, locals }) {
	// Only authenticated users can edit
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const movie = await getMovieById(params.id);
	if (!movie) {
		throw error(404, 'Movie not found');
	}

	return {
		movie
	};
}

export const actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const title = formData.get('title')?.toString();
		const originalTitle = formData.get('originalTitle')?.toString();
		const releaseDate = formData.get('releaseDate')?.toString();
		const overview = formData.get('overview')?.toString();
		const isLocked = formData.get('isLocked') === 'on';

		try {
			// Get current movie to merge existing overrides if any
			const movie = await db.query.movies.findFirst({
				where: eq(movies.id, params.id)
			});

			if (!movie) {
				return fail(404, { error: 'Movie not found' });
			}

			let localOverrides: any = movie.localOverrides || {};
			
			if (title && title !== movie.title) localOverrides.title = title;
			if (originalTitle && originalTitle !== movie.originalTitle) localOverrides.originalTitle = originalTitle;
			if (releaseDate && releaseDate !== movie.releaseDate) localOverrides.releaseDate = releaseDate;
			if (overview && overview !== movie.overview) localOverrides.overview = overview;

			// If empty, set to null
			if (Object.keys(localOverrides).length === 0) {
				localOverrides = null;
			}

			await db.update(movies).set({
				localOverrides,
				isLocked,
				updatedAt: new Date()
			}).where(eq(movies.id, params.id));

		} catch (err) {
			console.error('Failed to update overrides:', err);
			return fail(500, { error: 'Failed to update metadata overrides' });
		}

		throw redirect(302, `/movies/${params.id}`);
	}
};
