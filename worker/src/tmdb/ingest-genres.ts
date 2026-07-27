import { db, schema } from '../db.js';
import { TMDBClient } from './client.ts';

export async function syncGenres() {
	console.log('🔄 Syncing genres from TMDB...');
	const client = new TMDBClient();

	try {
		const genresList = await client.getGenres();
		for (const genre of genresList) {
			await db
				.insert(schema.genres)
				.values({
					id: genre.id,
					name: genre.name
				})
				.onConflictDoUpdate({
					target: schema.genres.id,
					set: { name: genre.name }
				});
		}
		console.log(`✅ Synced ${genresList.length} genres successfully.`);
	} catch (error) {
		console.error('❌ Failed to sync genres:', error);
	}
}
