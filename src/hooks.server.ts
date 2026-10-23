import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { validateSessionToken } from '$lib/server/auth';
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
	const { session, user } = token
		? await validateSessionToken(token)
		: { session: null, user: null };

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
		if (token) event.cookies.delete('session', { path: '/' });
		event.locals.session = null;
		event.locals.user = null;
	}

	// Centralized Auth Guard (applies to every request, with or without a session cookie)
	const pathname = event.url.pathname;
	const isProtected =
		pathname.startsWith('/my/') || pathname.startsWith('/admin/') || pathname.includes('/edit');

	if (isProtected && !event.locals.user) {
		return new Response(null, {
			status: 302,
			headers: { location: '/auth/login' }
		});
	}

	const response = await resolve(event);
	// Mirrors netlify.toml so SSR function responses get the same baseline security headers
	try {
		if (!response.headers.has('x-frame-options')) {
			response.headers.set('x-frame-options', 'SAMEORIGIN');
			response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
			response.headers.set(
				'permissions-policy',
				'camera=(), microphone=(), geolocation=(), payment=()'
			);
		}
	} catch {
		/* immutable headers (e.g. proxied fetch responses) */
	}
	if (event.request.headers.get('accept')?.includes('text/html')) {
		response.headers.set('cache-control', 'no-cache, no-store, must-revalidate');
	}
	return response;
});
import { notifyCriticalError } from '$lib/server/services/telegram.service';

export const handleError = Sentry.handleErrorWithSentry(
	({ error, event }: { error: any; event: any }) => {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const is404 =
			error?.status === 404 ||
			errorMsg.includes('Not found') ||
			event.url.pathname.includes('favicon') ||
			event.url.pathname.includes('.well-known');

		if (!is404) {
			notifyCriticalError(`URL: ${event.url.pathname}`, error).catch(() => {});
		}
	}
);
