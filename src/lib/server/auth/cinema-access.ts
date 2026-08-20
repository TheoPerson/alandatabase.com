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
export const PUBLIC_API_ROUTES = ['/api', '/api/health'];

const OWNER_ONLY_ROUTES = ['/my', '/live', '/disclaimer', '/movies/custom'];

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

export function requiresCinemaSession(pathname: string): boolean {
	if (!isCinemaRoute(pathname)) return false;
	if (SESSION_EXEMPT_ROUTES.includes(pathname)) return false;
	if (PUBLIC_API_ROUTES.includes(pathname)) return false;

	// Public catalogue, movie detail, TV, discovery and search pages remain
	// browseable. Personal data, playback and catalogue mutation surfaces do
	// not. The latter are owner-gated again in their server actions/loaders.
	if (OWNER_ONLY_ROUTES.some((route) => matchesRoute(pathname, route))) return true;
	if (/^\/movies\/catalog\/[^/]+\/(edit|merge|review)(?:\/|$)/.test(pathname)) return true;
	if (pathname === '/api' || pathname.startsWith('/api/')) return true;

	return false;
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
		if (isCinemaPageRoute(path) && !PUBLIC_ROUTES.some((route) => matchesRoute(path, route))) {
			return path + parsed.search;
		}
	} catch {
		// Ignore
	}

	return '/movies';
}
