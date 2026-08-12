import type { PageServerLoad } from './$types';

function maskSecret(val: string | undefined): string {
	if (!val) return '❌ NOT CONFIGURED';
	return '●●●●●●●● (PROTECTED)';
}

export const load: PageServerLoad = async () => {
	const dbUrl = process.env.DATABASE_URL;
	const pglite = process.env.USE_PGLITE;
	const tmdbKey = process.env.TMDB_API_KEY;
	const tmdbToken = process.env.TMDB_READ_TOKEN;
	const geminiKey = process.env.GEMINI_API_KEY;

	return {
		envVariables: [
			{ key: 'DATABASE_URL', status: dbUrl ? 'CONFIGURED' : 'MISSING', masked: maskSecret(dbUrl), category: 'Database' },
			{ key: 'USE_PGLITE', status: pglite !== undefined ? 'CONFIGURED' : 'DEFAULT (false)', masked: pglite || 'false', category: 'Database' },
			{ key: 'TMDB_API_KEY', status: tmdbKey ? 'CONFIGURED' : 'MISSING', masked: maskSecret(tmdbKey), category: 'Cinema API' },
			{ key: 'TMDB_READ_TOKEN', status: tmdbToken ? 'CONFIGURED' : 'MISSING', masked: maskSecret(tmdbToken), category: 'Cinema API' },
			{ key: 'GEMINI_API_KEY', status: geminiKey ? 'CONFIGURED' : 'OPTIONAL', masked: maskSecret(geminiKey), category: 'AI Curator' }
		],
		systemInfo: {
			nodeVersion: process.version,
			adapter: '@sveltejs/adapter-vercel (v5)',
			architecture: 'Serverless Functions (ESM)',
			framework: 'SvelteKit 2 + Svelte 5 (Runes)'
		}
	};
};
