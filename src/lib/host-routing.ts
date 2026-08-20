export const CANONICAL_HOST = 'alandatabase.com';
export const WWW_HOST = `www.${CANONICAL_HOST}`;
export const API_HOST = `api.${CANONICAL_HOST}`;
export const AUTH_HOST = `auth.${CANONICAL_HOST}`;
export const STATUS_HOST = `status.${CANONICAL_HOST}`;
export const VERCEL_PRODUCTION_HOST = 'alans-database.vercel.app';

export const PRODUCTION_HOSTS = new Set([
	CANONICAL_HOST,
	WWW_HOST,
	API_HOST,
	AUTH_HOST,
	STATUS_HOST,
	VERCEL_PRODUCTION_HOST
]);

export function normalizeHostname(hostname: string): string {
	return hostname.trim().toLowerCase().replace(/\.$/, '');
}

export function isProductionHostname(hostname: string): boolean {
	return PRODUCTION_HOSTS.has(normalizeHostname(hostname));
}

/**
 * Returns the application route that should serve a hostname-specific request.
 * Static assets and API requests intentionally pass through unchanged.
 */
export function getHostnameRoute(url: URL): string | undefined {
	const host = normalizeHostname(url.hostname);
	const pathname = url.pathname || '/';

	if (host === STATUS_HOST && pathname === '/') {
		return '/status';
	}

	if (host === API_HOST) {
		if (pathname === '/') return '/api';
		if (pathname === '/health') return '/api/health';
		if (pathname === '/api') return '/api';
		if (pathname.startsWith('/api/')) return pathname;
		return `/api${pathname}`;
	}

	if (host === AUTH_HOST && pathname === '/') {
		return '/auth/login';
	}

	return undefined;
}

/**
 * Resolve a request to the canonical public URL when it is an alias or is
 * arriving over plain HTTP behind a proxy.
 */
export function getCanonicalRedirect(url: URL, forwardedProto?: string | null): URL | null {
	const host = normalizeHostname(url.hostname);
	const firstForwardedProto = forwardedProto?.split(',')[0]?.trim().toLowerCase();
	const effectiveProto = firstForwardedProto || url.protocol.replace(':', '').toLowerCase();

	const shouldUseCanonicalHost =
		host === WWW_HOST || host === VERCEL_PRODUCTION_HOST || host === AUTH_HOST;
	const shouldUseHttps = isProductionHostname(host) && effectiveProto === 'http';

	if (!shouldUseCanonicalHost && !shouldUseHttps) return null;

	const target = new URL(url);
	target.protocol = 'https:';
	target.port = '';

	if (shouldUseCanonicalHost) {
		target.hostname = CANONICAL_HOST;
		if (host === AUTH_HOST && (target.pathname === '/' || target.pathname === '/auth')) {
			target.pathname = '/auth/login';
		}
	}

	return target;
}
