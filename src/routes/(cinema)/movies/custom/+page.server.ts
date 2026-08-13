import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const actions = {
	createCustomMovie: async ({ request, locals }) => {
		// 1. Auth check
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to add a custom movie.' });
		}

		// 2. Parse form data
		const formData = await request.formData();
		const title = formData.get('title')?.toString();
		const customVideoUrl = formData.get('customVideoUrl')?.toString();
		const posterUrl = formData.get('posterUrl')?.toString();
		const backdropUrl = formData.get('backdropUrl')?.toString() || null;
		const releaseYear = formData.get('releaseYear')?.toString();
		const runtime = formData.get('runtime')?.toString();
		const overview = formData.get('overview')?.toString() || null;
		const isAdult = formData.get('isAdult') === 'true';

		// 3. Validate
		if (!title || !customVideoUrl || !posterUrl) {
			return fail(400, {
				error: 'Missing required fields: Title, Video URL, and Poster URL are mandatory.'
			});
		}

		try {
			// Generate pseudo TMDB ID: A negative random number between -1,000,000 and -9,999,999
			const pseudoTmdbId = -Math.floor(Math.random() * 9000000 + 1000000);

			// Safely parse numbers
			const parsedRuntime = runtime ? parseInt(runtime) : null;
			let parsedDate = null;
			if (releaseYear) {
				parsedDate = `${releaseYear}-01-01`; // Store as Jan 1st of that year for the Date column
			}

			// Insert Custom Movie
			const [movie] = await db
				.insert(movies)
				.values({
					tmdbId: pseudoTmdbId,
					title,
					posterPath: posterUrl,
					backdropPath: backdropUrl,
					overview,
					releaseDate: parsedDate,
					runtime: parsedRuntime,
					adult: isAdult,
					localOverrides: {
						customVideoUrl: customVideoUrl
					}
				})
				.returning();

			if (!movie) {
				return fail(500, { error: 'Failed to create custom movie.' });
			}

			// Redirect to the newly created movie page
			throw redirect(303, `/movies/${movie.id}`);
			
		} catch (err: any) {
			if (err?.status === 303) {
				throw err; // Re-throw SvelteKit redirects
			}
			console.error('Error creating custom movie:', err);
			return fail(500, { error: 'An unexpected error occurred while saving the movie.' });
		}
	}
};
