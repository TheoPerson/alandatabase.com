import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const startedAt = performance.now();
	let dbOnline = false;
	let dbLatencyMs: number | null = null;

	try {
		await db.execute(sql`SELECT 1`);
		dbOnline = true;
		dbLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));
	} catch {
		// The public status page reports availability without exposing
		// connection details or database error messages.
	}

	const tmdbConfigured = Boolean(process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN);
	const serverLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));

	return {
		telemetry: {
			timestamp: new Date().toISOString(),
			serverLatencyMs,
			nodeEnv:
				process.env.NODE_ENV === 'production'
					? 'Production'
					: process.env.NODE_ENV || 'Development',
			db: {
				status: dbOnline ? 'ONLINE' : 'DEGRADED',
				latencyMs: dbLatencyMs,
				provider: 'PostgreSQL'
			},
			tmdb: {
				status: tmdbConfigured ? 'CONFIGURED' : 'NOT CONFIGURED',
				latencyMs: null,
				endpoint: 'Server-only integration'
			}
		}
	};
};
