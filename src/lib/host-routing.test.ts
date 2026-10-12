import { describe, expect, it } from 'vitest';
import {
	API_HOST,
	AUTH_HOST,
	CANONICAL_HOST,
	STATUS_HOST,
	VERCEL_PRODUCTION_HOST,
	WWW_HOST,
	getAuthPortalUrl,
	getCanonicalRedirect,
	getHostnameRoute,
	normalizeHostname
} from './host-routing';

describe('hostname routing', () => {
	it('normalizes hostnames without changing unrelated values', () => {
		expect(normalizeHostname(' WWW.ALANDATABASE.COM. ')).toBe(WWW_HOST);
		expect(normalizeHostname('localhost')).toBe('localhost');
	});

	it('rewrites the status root without touching assets or query strings', () => {
		expect(getHostnameRoute(new URL(`https://${STATUS_HOST}/`))).toBe('/status');
		expect(getHostnameRoute(new URL(`https://${STATUS_HOST}/?tab=errors`))).toBe('/status');
		expect(
			getHostnameRoute(new URL(`https://${STATUS_HOST}/_app/immutable/entry.js`))
		).toBeUndefined();
		expect(
			getHostnameRoute(new URL(`https://${STATUS_HOST}/api/telemetry/events`))
		).toBeUndefined();
	});

	it('maps the API subdomain to the real API route tree', () => {
		expect(getHostnameRoute(new URL(`https://${API_HOST}/`))).toBe('/api');
		expect(getHostnameRoute(new URL(`https://${API_HOST}/health`))).toBe('/api/health');
		expect(getHostnameRoute(new URL(`https://${API_HOST}/search?q=alien`))).toBe('/api/search');
		expect(getHostnameRoute(new URL(`https://${API_HOST}/api/search`))).toBe('/api/search');
	});

	it('canonicalizes aliases and upgrades known production hosts to HTTPS', () => {
		expect(getCanonicalRedirect(new URL(`http://${WWW_HOST}/movies?x=1`), 'http')?.toString()).toBe(
			`https://${CANONICAL_HOST}/movies?x=1`
		);
		expect(
			getCanonicalRedirect(new URL(`https://${VERCEL_PRODUCTION_HOST}/`), 'https')?.toString()
		).toBe(`https://${CANONICAL_HOST}/`);
		expect(getCanonicalRedirect(new URL(`http://${CANONICAL_HOST}/`), 'http')?.toString()).toBe(
			`https://${CANONICAL_HOST}/`
		);
		expect(getCanonicalRedirect(new URL(`http://${CANONICAL_HOST}/`))?.toString()).toBe(
			`https://${CANONICAL_HOST}/`
		);
		expect(getCanonicalRedirect(new URL(`https://${AUTH_HOST}/`), 'https')).toBeNull();
		expect(getCanonicalRedirect(new URL(`https://${AUTH_HOST}/auth/login`), 'https')).toBeNull();
		expect(getCanonicalRedirect(new URL(`https://${AUTH_HOST}/movies`), 'https')?.toString()).toBe(
			`https://${CANONICAL_HOST}/movies`
		);
		expect(getCanonicalRedirect(new URL(`http://${AUTH_HOST}/`), 'http')?.toString()).toBe(
			`https://${AUTH_HOST}/`
		);
		expect(getCanonicalRedirect(new URL(`https://${CANONICAL_HOST}/`), 'https')).toBeNull();
	});

	it('builds a first-class auth portal URL for production redirects', () => {
		expect(getAuthPortalUrl(new URL(`https://${CANONICAL_HOST}/`), '/admin')).toBe(
			`https://${AUTH_HOST}/auth/login?returnTo=%2Fadmin`
		);
		expect(getAuthPortalUrl(new URL('http://localhost:5173/'), '/admin')).toBe(
			'/auth/login?returnTo=%2Fadmin'
		);
	});
});
