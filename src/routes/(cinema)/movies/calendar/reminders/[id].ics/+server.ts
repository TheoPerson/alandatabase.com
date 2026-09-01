import { error } from '@sveltejs/kit';
import { getReleaseReminderIcs } from '$lib/server/services/release-calendar.service';

export async function GET({ locals, params, url }) {
	if (!locals.user) throw error(401, 'Authentication required.');
	const calendar = await getReleaseReminderIcs(locals.user.id, params.id, url.origin);
	if (!calendar) throw error(404, 'Reminder not found.');
	return new Response(calendar.contents, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `attachment; filename="${calendar.filename}"`,
			'cache-control': 'private, no-store'
		}
	});
}
