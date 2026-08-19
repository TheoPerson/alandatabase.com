import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	telemetry: {
		timestamp: new Date().toISOString(),
		serverLatencyMs: null,
		nodeEnv: 'Private',
		db: {
			status: 'NOT PROBED',
			latencyMs: null,
			provider: 'Private service'
		},
		tmdb: {
			status: 'NOT PROBED',
			latencyMs: null,
			endpoint: 'Private server integration'
		}
	}
});
