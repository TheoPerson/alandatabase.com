import 'dotenv/config';
import { syncGenres } from './tmdb/ingest-genres.js';
import { ingestMovie } from './tmdb/ingest-movies.js';
import { TMDBClient } from './tmdb/client.js';
import { setupMeilisearchIndexes } from './search/indexer.js';
import { ensureTablesExist } from '../../src/lib/server/db/migrate.js';

const command = process.argv[2];

async function main() {
	await ensureTablesExist();
	if (command === 'sync-genres') {
		await syncGenres();
	} else if (command === 'setup-search') {
		await setupMeilisearchIndexes();
	} else if (command === 'sync-popular') {
		await setupMeilisearchIndexes();
		await syncGenres();

		console.log('🍿 Fetching popular movies from TMDB...');
		const client = new TMDBClient();

		for (let page = 1; page <= 5; page++) {
			console.log(`\n--- Fetching Page ${page} ---`);
			const res = await client.getPopularMovies(page);
			for (const m of res.results) {
				await ingestMovie(m.id);
			}
		}

		console.log('\n🎉 Finished syncing popular movies!');
	} else if (command === 'ingest-id') {
		const idStr = process.argv[3];
		if (!idStr) {
			console.error('Usage: tsx src/cli.ts ingest-id <tmdbId>');
			process.exit(1);
		}
		await setupMeilisearchIndexes();
		await ingestMovie(parseInt(idStr, 10));
	} else {
		console.log(`
🎬 Cinema Platform Data Worker CLI

Commands:
  sync-genres     Sync movie genres from TMDB
  setup-search    Configure Meilisearch indexes
  sync-popular    Fetch top 5 pages of popular movies from TMDB
  ingest-id <id>  Ingest a specific movie by TMDB ID
`);
	}
	process.exit(0);
}

main().catch((err) => {
	console.error('Fatal CLI error:', err);
	process.exit(1);
});
