import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { validateSessionToken } from '$lib/server/auth';
import { isCinemaRoute } from '$lib/server/auth/cinema-access';
import { ensureTablesExist } from '$lib/server/db/migrate';
import { assignAllExperiments } from '$lib/server/ab-testing';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	// A/B Testing Assignment
	let deviceId = event.cookies.get('device_id');
	if (!deviceId) {
		deviceId = crypto.randomUUID();
		event.cookies.set('device_id', deviceId, { path: '/', maxAge: 60 * 60 * 24 * 365 * 2 }); // 2 years
	}
	event.locals.abTests = assignAllExperiments(deviceId);

	const token = event.cookies.get('session');
	event.locals.session = null;
	event.locals.user = null;

	if (token) {
		const { session, user } = await validateSessionToken(token);
		if (session && user) {
			event.locals.session = session;
			event.locals.user = {
				id: user.id,
				email: user.email,
				username: user.username,
				displayName: user.displayName,
				avatarPath: user.avatarPath,
				settings: (user.settings as Record<string, any>) || {}
			};
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	// Centralized Auth Guard
	const pathname = event.url.pathname;
	
	if (isCinemaRoute(pathname) && !event.locals.user) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		const returnTo = encodeURIComponent(pathname + event.url.search);
		return new Response(null, {
			status: 302,
			headers: { location: `/auth/login?returnTo=${returnTo}` }
		});
	}

	const response = await resolve(event);
	
	// Ensure private cinema routes are never cached publicly
	if (isCinemaRoute(pathname) && event.locals.user) {
		response.headers.set('cache-control', 'private, no-cache, no-store, must-revalidate');
		response.headers.set('pragma', 'no-cache');
		response.headers.set('expires', '0');
	}
	
	return response;
});
import { notifyCriticalError } from '$lib/server/services/telegram.service';

export const handleError = Sentry.handleErrorWithSentry(({ error, event }: { error: any; event: any }) => {
	const errorMsg = error instanceof Error ? error.message : String(error);
	const is404 =
		error?.status === 404 ||
		errorMsg.includes('Not found') ||
		event.url.pathname.includes('favicon') ||
		event.url.pathname.includes('.well-known');

	if (!is404) {
		notifyCriticalError(`URL: ${event.url.pathname}`, error).catch(() => {});
	}
});
