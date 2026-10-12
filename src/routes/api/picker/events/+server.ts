import { json, error } from '@sveltejs/kit';
import { recordPickerEvent } from '$lib/server/picker';
import { parsePickerEvent } from '$lib/server/picker/request';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const event = parsePickerEvent(body);
	if (!event.ok) return json({ error: event.error }, { status: 400 });

	try {
		await recordPickerEvent(locals.user?.id ?? null, event.value);
		return json({ ok: true });
	} catch (err) {
		console.error('Error in /api/picker/events:', err);
		throw error(500, { message: 'Failed to record picker event.' });
	}
};
