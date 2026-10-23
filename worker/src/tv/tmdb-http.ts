/**
 * Minimal TMDB GET client for the TV ingest and the library matcher.
 *
 * - One process-wide gate keeps every TMDB call (including the movie ingest's own client, which
 *   callers pace through {@link tmdbGate}) under 4 requests per second.
 * - 429 responses back off (Retry-After when given, otherwise exponential) and retry; transient
 *   5xx/network errors retry a few times. A 404 resolves to null.
 * - The API key never appears in an error message or a log line: errors name the endpoint only.
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MIN_INTERVAL_MS = 260; // ~3.8 requests per second, under the 4/s ceiling
const MAX_ATTEMPTS = 5;

export type FetchLike = (
	input: string,
	init?: { headers?: Record<string, string> }
) => Promise<{
	ok: boolean;
	status: number;
	headers: { get(name: string): string | null };
	json(): Promise<unknown>;
}>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Serialises request starts so that two of them are never closer than the interval. */
export class RequestGate {
	private next = 0;
	private chain: Promise<void> = Promise.resolve();

	constructor(private readonly intervalMs: number) {}

	wait(): Promise<void> {
		const turn = this.chain.then(async () => {
			const now = Date.now();
			const delay = Math.max(0, this.next - now);
			if (delay > 0) await sleep(delay);
			this.next = Date.now() + this.intervalMs;
		});
		this.chain = turn.catch(() => undefined);
		return turn;
	}

	/** Pushes the next allowed start back (after a 429). */
	pause(ms: number) {
		this.next = Math.max(this.next, Date.now() + ms);
	}
}

export const tmdbGate = new RequestGate(MIN_INTERVAL_MS);

export interface TmdbHttpOptions {
	apiKey?: string;
	readToken?: string;
	fetch?: FetchLike;
	gate?: RequestGate;
	/** Base back-off for 429/5xx retries (tests pass a tiny value). */
	backoffMs?: number;
}

export class TmdbHttpError extends Error {
	constructor(
		readonly status: number,
		readonly endpoint: string
	) {
		super(`TMDB request failed (${status}) at ${endpoint}`);
	}
}

export class TmdbHttp {
	private readonly apiKey: string;
	private readonly readToken: string;
	private readonly fetchImpl: FetchLike;
	private readonly gate: RequestGate;
	private readonly backoffMs: number;
	requestCount = 0;

	constructor(options: TmdbHttpOptions = {}) {
		this.apiKey = options.apiKey ?? process.env.TMDB_API_KEY ?? '';
		this.readToken = options.readToken ?? process.env.TMDB_READ_TOKEN ?? '';
		this.fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
		this.gate = options.gate ?? tmdbGate;
		this.backoffMs = options.backoffMs ?? 1000;
	}

	/** GET an endpoint; resolves null on 404. */
	async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
		const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
		if (this.apiKey) url.searchParams.set('api_key', this.apiKey);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (this.readToken) headers.Authorization = `Bearer ${this.readToken}`;

		let lastStatus = 0;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			await this.gate.wait();
			this.requestCount++;
			let response: Awaited<ReturnType<FetchLike>>;
			try {
				response = await this.fetchImpl(url.toString(), { headers });
			} catch {
				lastStatus = 0;
				await sleep(this.backoffMs * attempt);
				continue;
			}
			if (response.ok) return (await response.json()) as T;
			if (response.status === 404) return null;
			lastStatus = response.status;
			if (response.status === 429) {
				const retryAfter = Number(response.headers.get('retry-after'));
				const waitMs =
					Number.isFinite(retryAfter) && retryAfter > 0
						? retryAfter * 1000
						: this.backoffMs * 2 ** attempt;
				this.gate.pause(waitMs);
				continue;
			}
			if (response.status >= 500) {
				await sleep(this.backoffMs * attempt);
				continue;
			}
			break;
		}
		throw new TmdbHttpError(lastStatus, endpoint);
	}
}
