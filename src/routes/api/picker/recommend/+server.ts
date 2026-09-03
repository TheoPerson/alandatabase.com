import { json, error } from '@sveltejs/kit';
import { getPickerRecommendation } from '$lib/server/picker';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const sessionId = String(body.sessionId || crypto.randomUUID());
		const shownMovieIds = Array.isArray(body.shownMovieIds) ? body.shownMovieIds.map(String) : [];
		const position = typeof body.position === 'number' ? body.position : 1;
		const filters = typeof body.filters === 'object' && body.filters !== null ? body.filters : {};
		const recentDirectorsShown = Array.isArray(body.recentDirectorsShown)
			? body.recentDirectorsShown.map(String)
			: [];
		const recentPrimaryGenresShown = Array.isArray(body.recentPrimaryGenresShown)
			? body.recentPrimaryGenresShown.map(String)
			: [];

		const result = await getPickerRecommendation({
			userId: locals.user?.id ?? null,
			sessionId,
			filters,
			shownMovieIds,
			position,
			recentDirectorsShown,
			recentPrimaryGenresShown
		});

		if (!result) {
			return json(
				{
					movie: null,
					reason: 'No movie candidates match your current filter criteria.',
					sessionId
				},
				{ status: 200 }
			);
		}

		return json(result);
	} catch (err) {
		console.error('Error in /api/picker/recommend:', err);
		throw error(500, { message: 'Internal server error while generating movie recommendation.' });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID();
		const preset = url.searchParams.get('preset') || undefined;

		const result = await getPickerRecommendation({
			userId: locals.user?.id ?? null,
			sessionId,
			filters: preset ? { preset: preset as any } : {},
			shownMovieIds: [],
			position: 1
		});

		if (!result) {
			return json({ movie: null, sessionId });
		}

		return json(result);
	} catch (err) {
		console.error('Error in GET /api/picker/recommend:', err);
		throw error(500, { message: 'Internal server error' });
	}
};
