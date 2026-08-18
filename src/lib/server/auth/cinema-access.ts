export const CINEMA_PREFIXES = [
	'/movies',
	'/tv',
	'/tvshows',
	'/tvshow',
	'/shows',
	'/cinema',
	'/discover',
	'/my',
	'/search'
];

export const PUBLIC_ROUTES = [
	'/auth/login',
	'/auth/register',
	'/sentry-example-page',
	'/404'
];

export function isCinemaRoute(pathname: string): boolean {
	if (pathname === '/') return false; // The root Hub is public
	
	// Explicitly public routes
	if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
		return false;
	}

	// Is it a cinema route?
	return CINEMA_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function validateReturnTo(url: string | null): string {
	if (!url) return '/movies';
	
	try {
		const parsed = new URL(url, 'http://localhost');
		// Prevent open redirect by ensuring it's a relative path
		if (parsed.hostname !== 'localhost') return '/movies';
		
		const path = parsed.pathname;
		if (isCinemaRoute(path) && !PUBLIC_ROUTES.some(r => path.startsWith(r))) {
			return path + parsed.search;
		}
	} catch (e) {
		// Ignore
	}
	
	return '/movies';
}
