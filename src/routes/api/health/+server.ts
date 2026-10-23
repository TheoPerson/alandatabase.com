import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { sql } from 'drizzle-orm';

export async function GET() {
	let dbStatus = false;
	try {
		await db.execute(sql`SELECT 1`);
		dbStatus = true;
	} catch {
		console.error('Health check DB error');
	}

	return json(
		{ status: dbStatus ? 'ok' : 'degraded', db: dbStatus },
		{ status: dbStatus ? 200 : 503 }
	);
}
