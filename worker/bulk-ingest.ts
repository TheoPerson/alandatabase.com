import './env.js';
import { TMDBClient } from './src/tmdb/client.js';
import { ingestMovie } from './src/tmdb/ingest-movies.js';

async function main() {
	const client = new TMDBClient();
	console.log('--- STARTING BULK INGESTION ---');

	try {
		// Fetch Popular Movies (Pages 1 to 5) - ~100 movies
		for (let i = 1; i <= 5; i++) {
			console.log(`\nFetching Popular Page ${i}...`);
			const pop = await client.getPopularMovies(i);
			for (const m of pop.results) {
				await ingestMovie(m.id);
				await new Promise((r) => setTimeout(r, 100)); // Rate limiting buffer
			}
		}

		// Fetch Top Rated Movies (Pages 1 to 5) - ~100 movies
		for (let i = 1; i <= 5; i++) {
			console.log(`\nFetching Top Rated Page ${i}...`);
			const top = await client.getTopRatedMovies(i);
			for (const m of top.results) {
				await ingestMovie(m.id);
				await new Promise((r) => setTimeout(r, 100));
			}
		}

		console.log('\n✅ Bulk ingestion complete!');
	} catch (err) {
		console.error('Fatal Error during ingestion:', err);
	}
	
	process.exit(0);
}

main();
