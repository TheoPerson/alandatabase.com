const UPTIME_ROBOT_API = 'https://api.uptimerobot.com/v3';
const DEFAULT_MONITOR_ID = '803733856';
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60_000;
const HISTORY_DAYS = 30;

export type ServiceState = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface ExternalUptime {
	configured: boolean;
	monitorId: string;
	monitorName: string;
	state: ServiceState;
	uptimePercent: number | null;
	averageResponseMs: number | null;
	incidentCount: number | null;
	downtimeSeconds: number | null;
	periodDays: number;
	checkedAt: string;
}

let cache: { expiresAt: number; value: ExternalUptime } | null = null;

function readObject(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function finiteNumber(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUptimeRobotState(value: unknown): ServiceState {
	if (typeof value === 'number') {
		if (value === 2) return 'operational';
		if (value === 8) return 'degraded';
		if (value === 9) return 'outage';
		return 'unknown';
	}

	const objectValue = readObject(value);
	const candidate = objectValue?.value ?? objectValue?.name ?? objectValue?.status ?? value;
	if (typeof candidate !== 'string') return 'unknown';

	const normalized = candidate
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/gu, '');
	if (['up', 'online', 'operational', 'available'].includes(normalized)) return 'operational';
	if (['seemsdown', 'degraded', 'warning'].includes(normalized)) return 'degraded';
	if (['down', 'offline', 'outage'].includes(normalized)) return 'outage';
	return 'unknown';
}

function unavailable(monitorId: string, configured: boolean): ExternalUptime {
	return {
		configured,
		monitorId,
		monitorName: 'Alan Database',
		state: 'unknown',
		uptimePercent: null,
		averageResponseMs: null,
		incidentCount: null,
		downtimeSeconds: null,
		periodDays: HISTORY_DAYS,
		checkedAt: new Date().toISOString()
	};
}

async function fetchJson(url: URL, apiKey: string): Promise<Record<string, unknown>> {
	const response = await fetch(url, {
		headers: {
			accept: 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});

	if (!response.ok) throw new Error(`Uptime provider returned ${response.status}`);
	return (await response.json()) as Record<string, unknown>;
}

export async function getExternalUptime(): Promise<ExternalUptime> {
	const apiKey = process.env.UPTIMEROBOT_API_KEY?.trim();
	const monitorId = process.env.UPTIMEROBOT_MONITOR_ID?.trim() || DEFAULT_MONITOR_ID;
	if (!apiKey) return unavailable(monitorId, false);

	if (cache && cache.expiresAt > Date.now()) return cache.value;

	const now = new Date();
	const from = new Date(now.getTime() - HISTORY_DAYS * 86_400_000);
	const query = new URLSearchParams({ from: from.toISOString(), to: now.toISOString() });
	const monitorUrl = new URL(`/v3/monitors/${encodeURIComponent(monitorId)}`, UPTIME_ROBOT_API);
	const uptimeUrl = new URL(
		`/v3/monitors/${encodeURIComponent(monitorId)}/stats/uptime?${query}`,
		UPTIME_ROBOT_API
	);
	const responseTimeUrl = new URL(
		`/v3/monitors/${encodeURIComponent(monitorId)}/stats/response-time?${query}`,
		UPTIME_ROBOT_API
	);

	try {
		const [monitorPayload, uptimePayload, responseTimePayload] = await Promise.all([
			fetchJson(monitorUrl, apiKey),
			fetchJson(uptimeUrl, apiKey),
			fetchJson(responseTimeUrl, apiKey)
		]);
		const monitor = readObject(monitorPayload.data) ?? monitorPayload;
		const uptime = readObject(uptimePayload.data) ?? uptimePayload;
		const responseTime = readObject(responseTimePayload.data) ?? responseTimePayload;
		const responseSummary = readObject(responseTime.summary);

		const value: ExternalUptime = {
			configured: true,
			monitorId,
			monitorName:
				typeof monitor.friendlyName === 'string' ? monitor.friendlyName : 'Alan Database',
			state: normalizeUptimeRobotState(monitor.status),
			uptimePercent: finiteNumber(uptime.uptime),
			averageResponseMs: finiteNumber(responseSummary?.avg),
			incidentCount: finiteNumber(uptime.incident_count),
			downtimeSeconds: finiteNumber(uptime.total_downtime_seconds),
			periodDays: HISTORY_DAYS,
			checkedAt: new Date().toISOString()
		};

		cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
		return value;
	} catch {
		const value = unavailable(monitorId, true);
		cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
		return value;
	}
}
