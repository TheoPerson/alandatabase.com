import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageLoad } from './$types';

// Dev-only harness for Alan's HQP (spec 13.5): never reachable in a production build.
export const load: PageLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
