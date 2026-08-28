import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { syncGenres } from './tmdb/ingest-genres.js';
import { ingestMovie } from './tmdb/ingest-movies.js';
import { TMDBClient } from './tmdb/client.js';
import { setupMeilisearchIndexes } from './search/indexer.js';
import { closeWorkerDatabase } from './db.js';

const command = process.argv[2];
const validCommands = new Set(['sync-genres', 'setup-search', 'sync-popular', 'ingest-id']);

function printHelp() {
	console.log(`
Cinema Platform Data Worker CLI

Commands:
  sync-genres     Sync movie genres from TMDB
  setup-search    Configure Meilisearch indexes
  sync-popular    Fetch top 5 pages of popular movies from TMDB
  ingest-id <id>  Ingest a specific movie by TMDB ID
`);
}

async function main() {
	if (!command || !validCommands.has(command)) {
		printHelp();
		process.exit(command ? 1 : 0);
	}

	if (command === 'ingest-id') {
		const idStr = process.argv[3];
		const tmdbId = Number.parseInt(idStr ?? '', 10);
		if (!Number.isInteger(tmdbId) || tmdbId <= 0 || String(tmdbId) !== idStr) {
			console.error('Usage: tsx src/cli.ts ingest-id <positiveTmdbId>');
			process.exit(1);
		}
	}

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
		await setupMeilisearchIndexes();
		await ingestMovie(Number.parseInt(process.argv[3], 10));
	}
	await closeWorkerDatabase();
}

main().catch((err) => {
	console.error('Fatal CLI error:', err instanceof Error ? err.message : 'Unknown worker error');
	closeWorkerDatabase().finally(() => {
		process.exitCode = 1;
	});
});
