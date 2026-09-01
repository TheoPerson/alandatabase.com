import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';
import { SESSION_COOKIE_DELETE_OPTIONS, validateSessionToken } from '$lib/server/auth';
import {
	getCinemaAccessRequirement,
	isCinemaPageRoute,
	shouldUsePrivateResponseHeaders,
	type CinemaAccessRequirement
} from '$lib/server/auth/cinema-access';
import { hasPermission } from '$lib/server/auth/permissions';
import { denyFrameSources } from '$lib/server/security/response-policy';
import { safeDiagnostic } from '$lib/server/security/logging';
import { DEV_BYPASS_USER, isDevAuthBypassEnabled } from '$lib/server/auth/dev-access';
import {
	API_HOST,
	CANONICAL_HOST,
	getAuthPortalUrl,
	getCanonicalRedirect,
	getHostnameRoute,
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

function authPortalLocation(event: Parameters<Handle>[0]['event'], returnTo: string): string {
	return isProductionHostname(normalizeHostname(event.url.hostname))
		? getAuthPortalUrl(event.url, returnTo)
		: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function canAccessCinemaRequirement(
	user: App.Locals['user'],
	requirement: CinemaAccessRequirement
): boolean {
	if (requirement === 'public') return true;
	if (requirement === 'authenticated') return hasPermission(user, 'account:access');
	if (requirement === 'catalog') return hasPermission(user, 'catalog:manage');
	return hasPermission(user, 'system:manage');
}

function isCrossOriginFormMutation(event: Parameters<Handle>[0]['event']): boolean {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) return false;

	const contentType = event.request.headers.get('content-type')?.split(';', 1)[0]?.trim();
	if (
		contentType !== 'application/x-www-form-urlencoded' &&
		contentType !== 'multipart/form-data' &&
		contentType !== 'text/plain'
	) {
		return false;
	}

	return event.request.headers.get('origin') !== event.url.origin;
}

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	if (isCrossOriginFormMutation(event)) {
		return applySecurityHeaders(
			new Response('Cross-site form submissions are forbidden', { status: 403 }),
			event
		);
	}

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

	event.locals.abTests = {};

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
				role: user.role,
				disabledAt: user.disabledAt,
				settings: (user.settings as Record<string, any>) || {}
			};
		} else {
			event.cookies.delete('session', SESSION_COOKIE_DELETE_OPTIONS);
		}
	}

	// Centralized Auth Guard
	// `reroute` changes the route selected by SvelteKit, while the request URL
	// remains the browser-facing hostname/path. Use the mapped path for policy
	// decisions so API subdomain requests receive API responses, not HTML login
	// redirects.
	const pathname = getHostnameRoute(event.url) ?? event.url.pathname;
	const accessRequirement = getCinemaAccessRequirement(pathname);

	if (accessRequirement !== 'public' && !event.locals.user) {
		if (pathname.startsWith('/api/')) {
			return applySecurityHeaders(
				new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json', ...PRIVATE_RESPONSE_HEADERS }
				}),
				event
			);
		}

		return applySecurityHeaders(
			new Response(null, {
				status: 302,
				headers: {
					location: authPortalLocation(event, pathname + event.url.search),
					...PRIVATE_RESPONSE_HEADERS
				}
			}),
			event
		);
	}

	if (
		accessRequirement !== 'public' &&
		event.locals.user &&
		!canAccessCinemaRequirement(event.locals.user, accessRequirement)
	) {
		const isApiRequest = pathname === '/api' || pathname.startsWith('/api/');
		return applySecurityHeaders(
			new Response(
				isApiRequest
					? JSON.stringify({ error: 'Insufficient permissions' })
					: 'Insufficient permissions.',
				{
					status: 403,
					headers: {
						'content-type': isApiRequest ? 'application/json' : 'text/plain; charset=utf-8',
						...PRIVATE_RESPONSE_HEADERS
					}
				}
			),
			event
		);
	}

	// Adult Content Gate Check
	if (
		accessRequirement !== 'public' &&
		isCinemaPageRoute(pathname) &&
		event.locals.user &&
		!pathname.startsWith('/disclaimer')
	) {
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

	// Authenticated public pages can serialize account-owned data too.
	if (shouldUsePrivateResponseHeaders(accessRequirement, Boolean(event.locals.user), pathname)) {
		for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
			response.headers.set(name, value);
		}

		response.headers.set(
			'content-security-policy',
			denyFrameSources(response.headers.get('content-security-policy'))
		);
	}

	if (pathname === '/auth/register') {
		response.headers.set('referrer-policy', 'no-referrer');
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
