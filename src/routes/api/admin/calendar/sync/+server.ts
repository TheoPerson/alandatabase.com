import { json } from '@sveltejs/kit';
import { requireOwnerUser } from '$lib/server/auth/owner';
import { logServerError } from '$lib/server/security/logging';
import { syncCalendarBatch } from '$lib/server/services/release-calendar.service';

export async function POST({ locals, request }) {
	requireOwnerUser(locals.user);
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = (await request.json().catch(() => ({}))) as {
			runId?: unknown;
			cursor?: unknown;
		};
		const result = await syncCalendarBatch(locals.user.id, {
			runId: typeof body.runId === 'string' ? body.runId : null,
			cursor: typeof body.cursor === 'string' ? body.cursor : null
		});
		return json(result, { headers: { 'cache-control': 'private, no-store' } });
	} catch (error) {
		if (error instanceof RangeError) {
			return json({ error: error.message }, { status: 400 });
		}
		logServerError('Calendar synchronization failed', error);
		return json(
			{ error: 'The calendar batch could not be synchronized. It is safe to retry.' },
			{ status: 503 }
		);
	}
}
