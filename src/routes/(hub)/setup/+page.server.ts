import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getAuthPortalUrl } from '$lib/host-routing';
import { isOwnerUser } from '$lib/server/auth/owner';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, getAuthPortalUrl(url, '/setup'));
	}

	if (!isOwnerUser(locals.user)) {
		throw error(403, 'Owner access required.');
	}

	return {
		envVariables: [
			{
				key: 'DATABASE_URL',
				status: 'PRIVATE',
				masked: 'Server-only',
				category: 'Database'
			},
			{
				key: 'TMDB_API_KEY',
				status: 'PRIVATE',
				masked: 'Server-only',
				category: 'Cinema API'
			},
			{
				key: 'GEMINI_API_KEY',
				status: 'PRIVATE',
				masked: 'Server-only',
				category: 'AI Curator'
			}
		],
		systemInfo: {
			nodeVersion: 'Managed runtime',
			adapter: 'Managed deployment',
			architecture: 'Private server runtime',
			framework: 'SvelteKit'
		}
	};
};
