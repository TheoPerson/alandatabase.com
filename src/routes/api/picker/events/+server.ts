import { json, error } from '@sveltejs/kit';
import { recordPickerEvent } from '$lib/server/picker';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json().catch(() => null);

		if (!body || !body.sessionId || !body.movieId || !body.action) {
			throw error(400, { message: 'Missing required event fields (sessionId, movieId, action).' });
		}

		await recordPickerEvent(locals.user?.id ?? null, {
			sessionId: String(body.sessionId),
			movieId: String(body.movieId),
			action: body.action,
			position: typeof body.position === 'number' ? body.position : undefined,
			score: typeof body.score === 'number' ? body.score : undefined,
			metadata: typeof body.metadata === 'object' ? body.metadata : undefined
		});

		return json({ ok: true });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Error in /api/picker/events:', err);
		throw error(500, { message: 'Failed to record picker event.' });
	}
};
