import './env.js';
import { TMDBClient } from './src/tmdb/client.js';
import { ingestMovie } from './src/tmdb/ingest-movies.js';

async function main() {
	const client = new TMDBClient();
	console.log('--- STARTING PUBLIC EROTIC CINEMA INGESTION ---');

	try {
		// Fetch high-rated movies with "erotic" (256466), "sex" (267122), or "sexuality" (738) keywords
		// We want at least some votes to ensure quality.
		for (let i = 1; i <= 5; i++) {
			console.log(`\nFetching Erotic/Sex Page ${i}...`);
			const res = await client.discoverMovies({
				with_keywords: '256466|267122|738',
				sort_by: 'vote_average.desc',
				'vote_count.gte': '100', // Need some decent amount of votes to avoid random junk
				page: i.toString()
			});

			if (!res.results || res.results.length === 0) {
				console.log('No more results found.');
				break;
			}

			for (const m of res.results) {
				console.log(`Ingesting Erotic Masterpiece: ${m.title} (Score: ${m.vote_average})`);
				// Force adult=false if we want it public, but actually the user asked for "adult" content to be gated.
				// However, they specifically asked for "public cinema" sex category. TMDB marks these as adult=false usually.
				// Our bulk-ingest-movies script will respect TMDB's adult flag.
				await ingestMovie(m.id);
				await new Promise((r) => setTimeout(r, 100)); // Rate limiting buffer
			}
		}

		console.log('\n✅ Public Erotic ingestion complete!');
	} catch (err) {
		console.error('Fatal Error during ingestion:', err);
	}

	process.exit(0);
}

main();
