export const CINEMA_PREFIXES = [
	'/movies',
	'/tv',
	'/tvshows',
	'/tvshow',
	'/shows',
	'/cinema',
	'/discover',
	'/my',
	'/search',
	'/disclaimer',
	'/live',
	'/api'
];

export const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/404'];

// Service callbacks authenticate themselves instead of using a browser session.
export const SESSION_EXEMPT_ROUTES = ['/api/telegram/webhook'];

// Public API metadata and liveness are intentionally narrow exceptions. All
// data-changing and catalog endpoints remain session-protected.
export const PUBLIC_API_ROUTES = ['/api', '/api/health', '/api/search'];

export const OWNER_ONLY_ROUTES = ['/admin', '/setup', '/api/admin', '/api/telemetry/events'];

export const CATALOG_MANAGER_ROUTES = ['/movies/custom', '/disclaimer', '/api/movies/catalog'];

export const AUTHENTICATED_ROUTES = ['/my', '/live', '/movies/calendar'];

export type CinemaAccessRequirement = 'public' | 'authenticated' | 'catalog' | 'owner';

const OWNER_PORTAL_RETURN_ROUTES = ['/admin', '/setup'];

function matchesRoute(pathname: string, route: string): boolean {
	return pathname === route || pathname.startsWith(`${route}/`);
}

export function isCinemaRoute(pathname: string): boolean {
	if (pathname === '/') return false; // The root Hub is public

	// Explicitly public routes
	if (PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route))) {
		return false;
	}

	// Is it a cinema route?
	return CINEMA_PREFIXES.some((prefix) => matchesRoute(pathname, prefix));
}

export function getCinemaAccessRequirement(pathname: string): CinemaAccessRequirement {
	if (OWNER_ONLY_ROUTES.some((route) => matchesRoute(pathname, route))) return 'owner';
	if (CATALOG_MANAGER_ROUTES.some((route) => matchesRoute(pathname, route))) return 'catalog';
	if (AUTHENTICATED_ROUTES.some((route) => matchesRoute(pathname, route))) return 'authenticated';
	if (!isCinemaRoute(pathname)) return 'public';
	if (SESSION_EXEMPT_ROUTES.includes(pathname)) return 'public';
	if (PUBLIC_API_ROUTES.includes(pathname)) return 'public';

	// Public catalogue, movie detail, TV, discovery and search pages remain
	// browseable. Personal data, playback and catalogue mutation surfaces do
	// not. The latter are owner-gated again in their server actions/loaders.
	if (/^\/movies\/catalog\/[^/]+\/(edit|merge)(?:\/|$)/u.test(pathname)) return 'catalog';
	if (/^\/movies\/catalog\/[^/]+\/review(?:\/|$)/u.test(pathname)) return 'authenticated';
	if (pathname === '/api' || pathname.startsWith('/api/')) return 'authenticated';

	return 'public';
}

export function requiresCinemaSession(pathname: string): boolean {
	return getCinemaAccessRequirement(pathname) !== 'public';
}

export function shouldUsePrivateResponseHeaders(
	requirement: CinemaAccessRequirement,
	hasUser: boolean,
	pathname: string
): boolean {
	return requirement !== 'public' || hasUser || pathname === '/auth/register';
}

export function isCinemaPageRoute(pathname: string): boolean {
	return isCinemaRoute(pathname) && pathname !== '/api' && !pathname.startsWith('/api/');
}

export function validateReturnTo(url: string | null): string {
	if (!url) return '/movies';

	try {
		const parsed = new URL(url, 'http://localhost');
		// Prevent open redirect by ensuring it's a relative path
		if (parsed.hostname !== 'localhost') return '/movies';

		const path = parsed.pathname;
		if (OWNER_PORTAL_RETURN_ROUTES.some((route) => matchesRoute(path, route))) {
			return path + parsed.search;
		}
		if (isCinemaPageRoute(path) && !PUBLIC_ROUTES.some((route) => matchesRoute(path, route))) {
			return path + parsed.search;
		}
	} catch {
		// Ignore
	}

	return '/movies';
}
