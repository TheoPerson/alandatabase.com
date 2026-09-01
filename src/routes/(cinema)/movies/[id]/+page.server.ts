import { error, fail, isHttpError } from '@sveltejs/kit';
import { getMovieById } from '$lib/server/services/movie.service';
import type { Actions, PageServerLoad } from './$types';
import { logServerError } from '$lib/server/security/logging';
import { isOwnerUser, requireOwnerUser } from '$lib/server/auth/owner';
import { getUserInteraction } from '$lib/server/services/interaction.service';
import {
	readAlanScore,
	resetAlanScore,
	upsertAlanScore
} from '$lib/server/services/alan-score.service';
import {
	ALAN_SCORE_DIMENSIONS,
	EMPTY_ALAN_SCORE_VALUES,
	type AlanScoreValues
} from '$lib/alan-score';

export function _parseAlanScoreForm(formData: FormData) {
	const values = { ...EMPTY_ALAN_SCORE_VALUES } as AlanScoreValues;
	for (const { key } of ALAN_SCORE_DIMENSIONS) {
		const raw = formData.get(key);
		if (raw === null || raw === '') continue;
		values[key] = Number(raw);
	}

	return {
		movieId: formData.get('movieId')?.toString() ?? '',
		values,
		note: formData.get('note')?.toString() ?? null,
		tags: (formData.get('tags')?.toString() ?? '').split(',')
	};
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const movieId = params.id;

	try {
		const movie = await getMovieById(movieId);

		if (!movie) {
			throw error(404, 'Movie not found');
		}

		let personal = null;
		if (isOwnerUser(locals.user)) {
			const alanScore = await readAlanScore(locals.user.id, movieId);
			const interaction = await getUserInteraction(locals.user.id, movieId);
			personal = { alanScore, legacyRating: interaction?.rating ?? null };
		}

		return {
			movie,
			credits: (movie.cast ?? []).map((credit: any) => ({
				id: credit.person.id,
				name: credit.person.name,
				profilePath: credit.person.profilePath,
				character: credit.character
			})),
			...(personal ? { personal } : {})
		};
	} catch (e: unknown) {
		if (isHttpError(e)) throw e;
		logServerError('Movie details load failed', e);
		throw error(500, 'Failed to load movie details');
	}
};

export const actions: Actions = {
	saveAlanScore: async ({ request, locals }) => {
		requireOwnerUser(locals.user);
		const input = _parseAlanScoreForm(await request.formData());
		if (!input.movieId) return fail(400, { alanScoreError: 'Movie is required.' });

		try {
			const alanScore = await upsertAlanScore(locals.user!.id, input.movieId, input);
			if (!alanScore) return fail(404, { alanScoreError: 'Movie not found.' });
			return { alanScoreMessage: 'Alan Score saved.', alanScore };
		} catch (cause) {
			if (cause instanceof RangeError) {
				return fail(400, { alanScoreError: cause.message });
			}
			logServerError('Alan Score save failed', cause);
			return fail(500, { alanScoreError: 'Alan Score could not be saved.' });
		}
	},

	resetAlanScore: async ({ request, locals }) => {
		requireOwnerUser(locals.user);
		const formData = await request.formData();
		const movieId = formData.get('movieId')?.toString() ?? '';
		if (!movieId) return fail(400, { alanScoreError: 'Movie is required.' });

		try {
			await resetAlanScore(locals.user!.id, movieId);
			return { alanScoreMessage: 'Alan Score reset.', alanScore: null };
		} catch (cause) {
			logServerError('Alan Score reset failed', cause);
			return fail(500, { alanScoreError: 'Alan Score could not be reset.' });
		}
	}
};
