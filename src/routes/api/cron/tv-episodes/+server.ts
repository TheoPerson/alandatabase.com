import { json } from '@sveltejs/kit';
import { validCronAuthorization } from '$lib/server/security/notification-access';
import { syncTVEpisodeNotifications } from '$lib/server/services/tv-notification.service';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };
export const prerender = false;

export const GET: RequestHandler = async ({ request }) => {
	const headers = { 'cache-control': 'private, no-store' };
	if (!validCronAuthorization(request, process.env.CRON_SECRET)) {
		return json({ error: 'Unauthorized' }, { status: 401, headers });
	}
	if (process.env.TV_EPISODE_SYNC_ENABLED !== 'true') {
		return json({ enabled: false, processed: 0 }, { headers });
	}
	try {
		const result = await syncTVEpisodeNotifications({ triggeredBy: 'cron' });
		return json(result, { status: result.failed > 0 ? 503 : 200, headers });
	} catch {
		return json({ error: 'Episode synchronization failed.' }, { status: 503, headers });
	}
};
