import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';
import { validateSessionToken } from '$lib/server/auth';
import {
	isCinemaPageRoute,
	isCinemaRoute,
	requiresCinemaSession
} from '$lib/server/auth/cinema-access';
import { assignAllExperiments } from '$lib/server/ab-testing';
import { denyFrameSources } from '$lib/server/security/response-policy';
import { DEV_BYPASS_USER, isDevAuthBypassEnabled } from '$lib/server/auth/dev-access';
import {
	API_HOST,
	CANONICAL_HOST,
	getCanonicalRedirect,
	isProductionHostname,
	normalizeHostname
} from '$lib/host-routing';
import type { Handle, HandleServerError } from '@sveltejs/kit';

const PRIVATE_RESPONSE_HEADERS = {
	'cache-control': 'private, no-cache, no-store, must-revalidate',
	pragma: 'no-cache',
	expires: '0'
};

const API_ALLOWED_ORIGINS = new Set([
	`https://${CANONICAL_HOST}`,
	...(dev ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])
]);

const SECURITY_HEADERS = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'SAMEORIGIN',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
	'x-permitted-cross-domain-policies': 'none'
};

function applySecurityHeaders(response: Response, event: Parameters<Handle>[0]['event']): Response {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}

	const host = normalizeHostname(event.url.hostname);
	const forwardedProto = event.request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
	if (
		!dev &&
		isProductionHostname(host) &&
		(event.url.protocol === 'https:' || forwardedProto === 'https')
	) {
		response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}

	if (host === API_HOST) {
		const origin = event.request.headers.get('origin');
		if (origin && API_ALLOWED_ORIGINS.has(origin)) {
			response.headers.set('access-control-allow-origin', origin);
		}
		response.headers.set('access-control-allow-credentials', 'true');
		response.headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
		response.headers.set(
			'access-control-allow-headers',
			'Content-Type, Authorization, X-Requested-With'
		);
		response.headers.set('access-control-max-age', '86400');
		response.headers.append('vary', 'Origin');
	}

	return response;
}

function safeDiagnostic(value: unknown): string {
	return String(value)
		.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi, '[redacted-url]')
		.replace(/(?:token|secret|password|authorization|api[_-]?key)[=:][^\s&]+/gi, '[redacted]')
		.replace(/[<>"']/g, '')
		.slice(0, 350);
}

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	const canonicalRedirect = getCanonicalRedirect(
		event.url,
		event.request.headers.get('x-forwarded-proto')
	);
	if (canonicalRedirect) {
		return applySecurityHeaders(
			new Response(null, {
				status: 308,
				headers: {
					location: canonicalRedirect.toString(),
					'cache-control': 'public, max-age=3600'
				}
			}),
			event
		);
	}

	if (normalizeHostname(event.url.hostname) === API_HOST && event.request.method === 'OPTIONS') {
		const origin = event.request.headers.get('origin');
		if (origin && !API_ALLOWED_ORIGINS.has(origin)) {
			return applySecurityHeaders(
				new Response(JSON.stringify({ error: 'Origin is not allowed' }), {
					status: 403,
					headers: { 'content-type': 'application/json' }
				}),
				event
			);
		}

		return applySecurityHeaders(new Response(null, { status: 204 }), event);
	}

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
	event.locals.user = isDevAuthBypassEnabled() ? DEV_BYPASS_USER : null;

	if (token && !event.locals.user) {
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
			return applySecurityHeaders(
				new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json', ...PRIVATE_RESPONSE_HEADERS }
				}),
				event
			);
		}

		const returnTo = encodeURIComponent(pathname + event.url.search);
		return applySecurityHeaders(
			new Response(null, {
				status: 302,
				headers: { location: `/auth/login?returnTo=${returnTo}`, ...PRIVATE_RESPONSE_HEADERS }
			}),
			event
		);
	}

	// Adult Content Gate Check
	if (isCinemaPageRoute(pathname) && event.locals.user && !pathname.startsWith('/disclaimer')) {
		const settings = event.locals.user.settings || {};
		if (!settings.hasAcceptedAdultGate) {
			return applySecurityHeaders(
				new Response(null, {
					status: 302,
					headers: { location: '/disclaimer', ...PRIVATE_RESPONSE_HEADERS }
				}),
				event
			);
		}
	}

	const response = await resolve(event);

	// Ensure private cinema routes are never cached publicly
	if (isCinemaRoute(pathname)) {
		for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
			response.headers.set(name, value);
		}

		response.headers.set(
			'content-security-policy',
			denyFrameSources(response.headers.get('content-security-policy'))
		);
	}

	return applySecurityHeaders(response, event);
});
import { notifyCriticalError } from '$lib/server/services/telegram.service';

const reportServerError: HandleServerError = ({ error, event }) => {
	const errorMsg = safeDiagnostic(error instanceof Error ? error.message : error);
	const status =
		typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
	const is404 =
		status === 404 ||
		errorMsg.includes('Not found') ||
		event.url.pathname.includes('favicon') ||
		event.url.pathname.includes('.well-known');

	if (!is404) {
		notifyCriticalError(`URL: ${event.url.pathname}`, errorMsg).catch(() => {});
	}
};

export const handleError = Sentry.handleErrorWithSentry(reportServerError);
