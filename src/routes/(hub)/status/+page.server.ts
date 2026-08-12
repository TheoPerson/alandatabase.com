import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	const startTime = Date.now();

	// 1. Postgres Ping
	let dbStatus = 'OFFLINE';
	let dbLatencyMs = -1;
	try {
		const dbStart = Date.now();
		await db.execute(sql`SELECT 1`);
		dbLatencyMs = Date.now() - dbStart;
		dbStatus = 'ONLINE';
	} catch (err: any) {
		dbStatus = `ERROR: ${err.message || 'Connection failed'}`;
	}

	// 2. TMDB API Ping
	let tmdbStatus = 'OFFLINE';
	let tmdbLatencyMs = -1;
	try {
		const tmdbStart = Date.now();
		const apiKey = env.TMDB_API_KEY || '63560e33e8e0e21084ebced8eddfc1cd';
		const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`);
		if (res.ok) {
			tmdbLatencyMs = Date.now() - tmdbStart;
			tmdbStatus = 'ONLINE';
		}
	} catch (err: any) {
		tmdbStatus = `ERROR: ${err.message || 'API request failed'}`;
	}

	const totalServerLatencyMs = Date.now() - startTime;

	return {
		telemetry: {
			timestamp: new Date().toISOString(),
			serverLatencyMs: totalServerLatencyMs,
			nodeEnv: process.env.NODE_ENV || 'production',
			db: {
				status: dbStatus,
				latencyMs: dbLatencyMs,
				provider: 'Neon Postgres (Serverless Pooler)'
			},
			tmdb: {
				status: tmdbStatus,
				latencyMs: tmdbLatencyMs,
				endpoint: 'https://api.themoviedb.org/3'
			}
		}
	};
};
