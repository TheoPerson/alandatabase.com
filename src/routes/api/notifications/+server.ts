import { json } from '@sveltejs/kit';
import { notificationUser } from '$lib/server/security/notification-access';
import {
	recentNotificationsAfter,
	unreadNotificationCount
} from '$lib/server/services/tv-notification.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = notificationUser(locals);
	const checkedAt = new Date();
	const raw = url.searchParams.get('after');
	const after = raw ? new Date(raw) : checkedAt;
	if (!Number.isFinite(after.getTime()))
		return json({ error: 'Invalid notification cursor.' }, { status: 400 });
	try {
		const [notifications, unreadCount] = await Promise.all([
			recentNotificationsAfter(user.id, after),
			unreadNotificationCount(user.id)
		]);
		return json(
			{ notifications, unreadCount, checkedAt: checkedAt.toISOString() },
			{
				headers: { 'cache-control': 'private, no-store' }
			}
		);
	} catch {
		return json({ error: 'Notifications are temporarily unavailable.' }, { status: 503 });
	}
};
