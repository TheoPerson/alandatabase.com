import type { Reroute } from '@sveltejs/kit';
import { getHostnameRoute } from '$lib/host-routing';

/**
 * Keep the public subdomains on the existing SvelteKit route tree. This is a
 * route rewrite, not a redirect, so query strings, assets and browser URLs
 * remain stable.
 */
export const reroute: Reroute = ({ url }) => getHostnameRoute(url);
