import 'dotenv/config';

export const MOVIES_INDEX = 'movies';

export async function setupMeilisearchIndexes() {
	const meiliHost = process.env.MEILI_HOST;
	const meiliKey = process.env.MEILI_MASTER_KEY;

	if (!meiliHost) {
		console.log('⚡ Meilisearch not configured in .env (using Postgres & TMDB native search)');
		return;
	}

	try {
		console.log(`🔍 Connecting to Meilisearch at ${meiliHost}...`);
		// Dynamic import to avoid crash if meilisearch package is not used
		const { MeiliSearch } = await import('meilisearch').catch(() => ({ MeiliSearch: null }));
		if (!MeiliSearch) {
			console.log('ℹ️ Meilisearch package optional.');
			return;
		}

		const meili = new MeiliSearch({
			host: meiliHost,
			apiKey: meiliKey || ''
		});

		const index = meili.index(MOVIES_INDEX);
		await index.updateSettings({
			searchableAttributes: ['title', 'original_title', 'overview', 'cast_names', 'keywords'],
			filterableAttributes: ['genres', 'release_year', 'vote_average', 'adult'],
			sortableAttributes: ['popularity', 'vote_average', 'release_date', 'title']
		});

		console.log('✅ Meilisearch indexes configured.');
	} catch (err) {
		console.warn('⚠️ Meilisearch connection skipped:', (err as Error).message);
	}
}

export async function indexMovie(movieData: any) {
	// Optional background indexing
	return true;
}
