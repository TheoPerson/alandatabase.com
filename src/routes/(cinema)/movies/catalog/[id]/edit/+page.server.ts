import { error, fail, redirect } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireOwnerUser } from '$lib/server/auth/owner';
import { logServerError } from '$lib/server/security/logging';

export async function load({ params, locals }) {
	// Only authenticated users can edit
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	requireOwnerUser(locals.user);

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
		requireOwnerUser(locals.user);

		const formData = await request.formData();
		const title = formData.get('title')?.toString();
		const originalTitle = formData.get('originalTitle')?.toString();
		const releaseDate = formData.get('releaseDate')?.toString();
		const overview = formData.get('overview')?.toString();
		const isLocked = formData.get('isLocked') === 'on';

		try {
			// Re-resolve inside the action so a direct POST cannot target a
			// quarantined adult, custom, or explicit-keyword record.
			const visibleMovie = await getMovieById(params.id);

			if (!visibleMovie) {
				return fail(404, { error: 'Movie not found' });
			}

			// Raw override JSON is read only after visibility validation and is never
			// returned to the browser. This preserves unrelated safe overrides while
			// keeping legacy source fields out of serialized movie data.
			const movie = await db.query.movies.findFirst({
				where: eq(movies.id, visibleMovie.id),
				columns: {
					id: true,
					title: true,
					originalTitle: true,
					releaseDate: true,
					overview: true,
					localOverrides: true
				}
			});
			if (!movie) return fail(404, { error: 'Movie not found' });

			const allowedFields = ['title', 'originalTitle', 'releaseDate', 'overview'] as const;
			const existingOverrides =
				movie.localOverrides &&
				typeof movie.localOverrides === 'object' &&
				!Array.isArray(movie.localOverrides)
					? (movie.localOverrides as Record<string, unknown>)
					: {};
			const localOverrides: Record<string, string> = {};
			for (const field of allowedFields) {
				if (typeof existingOverrides[field] === 'string') {
					localOverrides[field] = existingOverrides[field];
				}
			}

			const submitted = { title, originalTitle, releaseDate, overview };
			for (const field of allowedFields) {
				const value = submitted[field];
				if (!value || value === movie[field]) delete localOverrides[field];
				else localOverrides[field] = value;
			}

			const storedOverrides = Object.keys(localOverrides).length === 0 ? null : localOverrides;

			await db
				.update(movies)
				.set({
					localOverrides: storedOverrides,
					isLocked,
					updatedAt: new Date()
				})
				.where(eq(movies.id, visibleMovie.id));
		} catch (err) {
			logServerError('Metadata override update failed', err);
			return fail(500, { error: 'Failed to update metadata overrides' });
		}

		throw redirect(302, `/movies/${params.id}`);
	}
};
