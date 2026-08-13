import { ingestAdultVideo } from './src/tmdb/ingest-adult.js';

async function main() {
	console.log('--- STARTING ADULT BULK INGESTION (Alex Adams) ---');
	
	try {
		// Fetch 10 pages from Eporner API (30 results per page default) = ~300 videos
		for (let i = 1; i <= 10; i++) {
			console.log(`\nFetching Page ${i}...`);
			const res = await fetch(`https://eporner.com/api/v2/video/search/?query=alex+adams&per_page=30&page=${i}`);
			const data = await res.json();
			
			if (!data.videos || data.videos.length === 0) break;
			
			for (const v of data.videos) {
				await ingestAdultVideo(v);
				await new Promise((r) => setTimeout(r, 100)); // Rate limiting buffer
			}
		}

		console.log('\n✅ Adult Bulk ingestion complete!');
	} catch (err) {
		console.error('Fatal Error during ingestion:', err);
	}
	
	process.exit(0);
}

main();
