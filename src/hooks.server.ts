import { validateSessionToken } from '$lib/server/auth';
import { ensureTablesExist } from '$lib/server/db/migrate';
import { assignAllExperiments } from '$lib/server/ab-testing';
import type { Handle } from '@sveltejs/kit';


export const handle: Handle = async ({ event, resolve }) => {
	// A/B Testing Assignment
	let deviceId = event.cookies.get('device_id');
	if (!deviceId) {
		deviceId = crypto.randomUUID();
		event.cookies.set('device_id', deviceId, { path: '/', maxAge: 60 * 60 * 24 * 365 * 2 }); // 2 years
	}
	event.locals.abTests = assignAllExperiments(deviceId);

	const token = event.cookies.get('session');

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await validateSessionToken(token);

	if (session && user) {
		event.locals.session = session;
		event.locals.user = {
			id: user.id,
			email: user.email,
			username: user.username,
			displayName: user.displayName,
			avatarPath: user.avatarPath
		};
	} else {
		event.cookies.delete('session', { path: '/' });
		event.locals.session = null;
		event.locals.user = null;
	}

	return resolve(event);
};
