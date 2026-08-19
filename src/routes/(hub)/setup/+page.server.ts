import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
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
