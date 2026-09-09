import { fail } from '@sveltejs/kit';
import { notificationUser } from '$lib/server/security/notification-access';
import {
	listNotifications,
	listTVEpisodeSubscriptions,
	markNotificationRead,
	updateTVEpisodeSubscription
} from '$lib/server/services/tv-notification.service';
import {
	TV_NOTIFICATION_OFFSETS,
	type TVNotificationOffset,
	normalizeNotificationTimezone
} from '$lib/tv-notifications';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const load: PageServerLoad = async ({ locals }) => {
	const user = notificationUser(locals);
	const options = {
		pushPublicKey: process.env.VAPID_PRIVATE_KEY ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
		syncEnabled: process.env.TV_EPISODE_SYNC_ENABLED === 'true'
	};
	try {
		const [subscriptions, notifications] = await Promise.all([
			listTVEpisodeSubscriptions(user.id),
			listNotifications(user.id)
		]);
		return { ...options, subscriptions, notifications };
	} catch {
		return {
			...options,
			subscriptions: [],
			notifications: [],
			error: 'Episode alerts are temporarily unavailable.'
		};
	}
};

export const actions: Actions = {
	updateSubscription: async ({ locals, request }) => {
		const user = notificationUser(locals);
		const data = await request.formData();
		const subscriptionId = String(data.get('subscriptionId') ?? '');
		const offsetDays = Number(data.get('offsetDays'));
		if (
			!UUID.test(subscriptionId) ||
			!TV_NOTIFICATION_OFFSETS.includes(offsetDays as TVNotificationOffset)
		) {
			return fail(400, { error: 'Invalid episode alert preferences.' });
		}
		try {
			const updated = await updateTVEpisodeSubscription({
				userId: user.id,
				subscriptionId,
				enabled: ['true', 'on', '1'].includes(String(data.get('enabled'))),
				offsetDays: offsetDays as TVNotificationOffset,
				timezone: normalizeNotificationTimezone(data.get('timezone'))
			});
			return updated
				? { message: 'Episode alert preferences saved.' }
				: fail(404, { error: 'Subscription not found.' });
		} catch {
			return fail(503, { error: 'Episode alert preferences could not be saved.' });
		}
	},
	markRead: async ({ locals, request }) => {
		const user = notificationUser(locals);
		const id = (await request.formData()).get('notificationId')?.toString() || null;
		if (id && !UUID.test(id)) return fail(400, { error: 'Invalid notification.' });
		try {
			await markNotificationRead(user.id, id);
			return { message: 'Notifications marked as read.' };
		} catch {
			return fail(503, { error: 'Notifications could not be updated.' });
		}
	}
};
