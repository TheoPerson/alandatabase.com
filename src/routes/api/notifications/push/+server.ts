import { json, isHttpError } from '@sveltejs/kit';
import {
	notificationJson,
	notificationUser,
	requireNotificationOrigin
} from '$lib/server/security/notification-access';
import {
	removePushSubscription,
	savePushSubscription,
	validatePushInput
} from '$lib/server/services/tv-notification.service';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

const headers = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = notificationUser(locals);
	const endpoint = url.searchParams.get('endpoint');
	let subscribed = false;
	if (endpoint && endpoint.length <= 2048) {
		const saved = await db
			.select({ id: pushSubscriptions.id })
			.from(pushSubscriptions)
			.where(
				and(
					eq(pushSubscriptions.userId, user.id),
					eq(pushSubscriptions.userType, 'account'),
					eq(pushSubscriptions.profileId, 'default'),
					eq(pushSubscriptions.endpoint, endpoint),
					eq(pushSubscriptions.enabled, true)
				)
			)
			.limit(1);
		subscribed = saved.length > 0;
	}
	return json(
		{
			publicKey: process.env.VAPID_PRIVATE_KEY ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
			subscribed
		},
		{ headers }
	);
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
	const user = notificationUser(locals);
	requireNotificationOrigin(request, url);
	const body = await notificationJson(request);
	if (body.action === 'status') {
		if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) {
			return json({ error: 'Invalid endpoint.' }, { status: 400, headers });
		}
		const saved = await db
			.select({ id: pushSubscriptions.id })
			.from(pushSubscriptions)
			.where(
				and(
					eq(pushSubscriptions.userId, user.id),
					eq(pushSubscriptions.userType, 'account'),
					eq(pushSubscriptions.profileId, 'default'),
					eq(pushSubscriptions.endpoint, body.endpoint),
					eq(pushSubscriptions.enabled, true)
				)
			)
			.limit(1);
		return json({ subscribed: saved.length > 0 }, { headers });
	}
	try {
		await savePushSubscription(user.id, validatePushInput(body), request.headers.get('user-agent'));
		return json({ success: true }, { headers });
	} catch (error) {
		if (isHttpError(error)) throw error;
		return json(
			{
				error: error instanceof RangeError ? error.message : 'Push subscription could not be saved.'
			},
			{
				status: error instanceof RangeError ? 400 : 503,
				headers
			}
		);
	}
};

export const DELETE: RequestHandler = async ({ locals, request, url }) => {
	const user = notificationUser(locals);
	requireNotificationOrigin(request, url);
	const body = await notificationJson(request);
	if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) {
		return json({ error: 'Invalid endpoint.' }, { status: 400, headers });
	}
	await removePushSubscription(user.id, body.endpoint);
	return json({ success: true }, { headers });
};
