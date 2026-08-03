import { db } from './src/lib/server/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
	try {
		console.log('Querying activities...');
		const res = await db.execute(sql`SELECT count(*) FROM activities`);
		console.log('Activities count:', res);
	} catch (e) {
		console.error('Activities table error:', e);
	}

	try {
		console.log('Querying my/films stats...');
		const res2 = await db.execute(sql`SELECT count(*) FROM user_movie_interactions`);
		console.log('Interactions:', res2);
	} catch (e) {
		console.error('Interactions error:', e);
	}
}
main();
