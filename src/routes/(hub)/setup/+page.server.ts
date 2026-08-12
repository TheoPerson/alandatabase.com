import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

function maskSecret(val: string | undefined): string {
	if (!val) return '❌ NOT CONFIGURED';
	if (val.length < 12) return '●●●●●●●● (Set)';
	return val.slice(0, 6) + '...' + val.slice(-4);
}

export const load: PageServerLoad = async () => {
	return {
		envVariables: [
			{ key: 'DATABASE_URL', status: env.DATABASE_URL ? 'CONFIGURED' : 'MISSING', masked: maskSecret(env.DATABASE_URL), category: 'Database' },
			{ key: 'USE_PGLITE', status: env.USE_PGLITE !== undefined ? 'CONFIGURED' : 'DEFAULT (false)', masked: env.USE_PGLITE || 'false', category: 'Database' },
			{ key: 'TMDB_API_KEY', status: env.TMDB_API_KEY ? 'CONFIGURED' : 'MISSING', masked: maskSecret(env.TMDB_API_KEY), category: 'Cinema API' },
			{ key: 'TMDB_READ_TOKEN', status: env.TMDB_READ_TOKEN ? 'CONFIGURED' : 'MISSING', masked: maskSecret(env.TMDB_READ_TOKEN), category: 'Cinema API' },
			{ key: 'GEMINI_API_KEY', status: env.GEMINI_API_KEY ? 'CONFIGURED' : 'OPTIONAL', masked: maskSecret(env.GEMINI_API_KEY), category: 'AI Curator' }
		],
		systemInfo: {
			nodeVersion: process.version,
			adapter: '@sveltejs/adapter-netlify (v6)',
			architecture: 'Serverless Functions (ESM)',
			framework: 'SvelteKit 2 + Svelte 5 (Runes)'
		}
	};
};
