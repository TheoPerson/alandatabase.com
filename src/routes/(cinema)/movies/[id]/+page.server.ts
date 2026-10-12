import { error, fail, isHttpError } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import { applyInteraction, parseInteractionUpdate } from '$lib/server/services/interaction.service';
import { hasPermission } from '$lib/server/auth/permissions';
import type { Actions, PageServerLoad } from './$types';
import { logServerError } from '$lib/server/security/logging';

export const actions: Actions = {
	// One field per submit: watched | watchlist | favorite as 'true'/'false', or rating 0.5–5 ('' clears).
	logInteraction: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to log films.' });
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal film activity needs a signed-in account.' });
		}

		const data = await request.formData();
		const update = parseInteractionUpdate(
			data.get('type')?.toString(),
			data.get('value')?.toString()
		);
		if (!update.ok) return fail(400, { error: update.error });

		try {
			const interaction = await applyInteraction(locals.user.id, params.id, update);
			if (!interaction) return fail(404, { error: 'Could not resolve movie record.' });
			return { success: true, interaction };
		} catch (err) {
			logServerError('Movie interaction update failed', err);
			return fail(500, { error: 'Failed to update interaction.' });
		}
	}
};

export const load: PageServerLoad = async ({ params }) => {
	const movieId = params.id;

	try {
		const movie = await getMovieById(movieId);

		if (!movie) {
			throw error(404, 'Movie not found');
		}

		return {
			movie,
			credits: (movie.cast ?? []).map((credit: any) => ({
				id: credit.person.id,
				name: credit.person.name,
				profilePath: credit.person.profilePath,
				character: credit.character
			}))
		};
	} catch (e: unknown) {
		if (isHttpError(e)) throw e;
		logServerError('Movie details load failed', e);
		throw error(500, 'Failed to load movie details');
	}
};
