import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { getExternalUptime, type ServiceState } from '$lib/server/services/uptime.service';
import { parseReleaseNotes } from '$lib/release-notes';
import changelog from '../../../../CHANGELOG.md?raw';

export const load: PageServerLoad = async ({ setHeaders }) => {
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

	const externalUptime = await getExternalUptime();
	const serverLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));
	const databaseState: ServiceState = dbOnline ? 'operational' : 'outage';
	const overallState: ServiceState =
		externalUptime.state === 'outage'
			? 'outage'
			: !dbOnline || externalUptime.state === 'degraded'
				? 'degraded'
				: 'operational';

	setHeaders({
		'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		status: {
			overallState,
			checkedAt: new Date().toISOString(),
			externalUptime,
			services: [
				{
					name: 'Web application',
					description: 'alandatabase.com',
					state: 'operational' as const,
					latencyMs: serverLatencyMs
				},
				{
					name: 'API',
					description: 'api.alandatabase.com',
					state: databaseState,
					latencyMs: dbLatencyMs
				},
				{
					name: 'Authentication',
					description: 'auth.alandatabase.com',
					state: databaseState,
					latencyMs: dbLatencyMs
				},
				{
					name: 'PostgreSQL',
					description: 'Primary data store',
					state: databaseState,
					latencyMs: dbLatencyMs
				}
			]
		},
		releases: parseReleaseNotes(changelog)
	};
};
