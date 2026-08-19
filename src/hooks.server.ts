import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { validateSessionToken } from '$lib/server/auth';
import {
	isCinemaPageRoute,
	isCinemaRoute,
	requiresCinemaSession
} from '$lib/server/auth/cinema-access';
import { assignAllExperiments } from '$lib/server/ab-testing';
import type { Handle, HandleServerError } from '@sveltejs/kit';

const PRIVATE_RESPONSE_HEADERS = {
	'cache-control': 'private, no-cache, no-store, must-revalidate',
	pragma: 'no-cache',
	expires: '0'
};

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	// A/B Testing Assignment
	let deviceId = event.cookies.get('device_id');
	if (!deviceId) {
		deviceId = crypto.randomUUID();
		event.cookies.set('device_id', deviceId, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365 * 2,
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production'
		});
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

	if (requiresCinemaSession(pathname) && !event.locals.user) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json', ...PRIVATE_RESPONSE_HEADERS }
			});
		}

		const returnTo = encodeURIComponent(pathname + event.url.search);
		return new Response(null, {
			status: 302,
			headers: { location: `/auth/login?returnTo=${returnTo}`, ...PRIVATE_RESPONSE_HEADERS }
		});
	}

	// Adult Content Gate Check
	if (isCinemaPageRoute(pathname) && event.locals.user && !pathname.startsWith('/disclaimer')) {
		const settings = event.locals.user.settings || {};
		if (!settings.hasAcceptedAdultGate) {
			return new Response(null, {
				status: 302,
				headers: { location: '/disclaimer', ...PRIVATE_RESPONSE_HEADERS }
			});
		}
	}

	const response = await resolve(event);

	// Ensure private cinema routes are never cached publicly
	if (isCinemaRoute(pathname)) {
		for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
			response.headers.set(name, value);
		}
	}

	return response;
});
import { notifyCriticalError } from '$lib/server/services/telegram.service';

const reportServerError: HandleServerError = ({ error, event }) => {
	const errorMsg = error instanceof Error ? error.message : String(error);
	const status =
		typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
	const is404 =
		status === 404 ||
		errorMsg.includes('Not found') ||
		event.url.pathname.includes('favicon') ||
		event.url.pathname.includes('.well-known');

	if (!is404) {
		notifyCriticalError(`URL: ${event.url.pathname}`, error).catch(() => {});
	}
};

export const handleError = Sentry.handleErrorWithSentry(reportServerError);
