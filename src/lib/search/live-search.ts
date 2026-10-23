import { canPreview, normalizeQuery } from './query';
import { parseSearchResponse, type SearchHit } from './results';

// Debounced, cancellable instant search against `GET /api/search`. It owns no UI
// state: the palette copies each published state into its own runes.

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LiveSearchState {
	status: SearchStatus;
	/** The normalised query the status and hits belong to. */
	query: string;
	hits: SearchHit[];
}

export interface LiveSearchOptions {
	onChange: (state: LiveSearchState) => void;
	fetcher?: typeof fetch;
	debounceMs?: number;
	limit?: number;
	/** A request that has not answered by then is reported as an error. */
	timeoutMs?: number;
}

export interface LiveSearch {
	readonly state: LiveSearchState;
	setQuery(raw: string): void;
	retry(): void;
	reset(): void;
	dispose(): void;
}

const IDLE: LiveSearchState = { status: 'idle', query: '', hits: [] };

export function createLiveSearch(options: LiveSearchOptions): LiveSearch {
	const { onChange, debounceMs = 200, limit = 6, timeoutMs = 8000 } = options;
	// Resolved per call so tests can inject one and the browser default is read lazily.
	const request = (url: string, init: RequestInit) => (options.fetcher ?? fetch)(url, init);

	let state: LiveSearchState = IDLE;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// The one request whose answer still counts. Anything else is stale.
	let current: AbortController | null = null;
	let disposed = false;

	function publish(next: LiveSearchState) {
		if (disposed) return;
		state = next;
		onChange(next);
	}

	function cancel() {
		clearTimeout(timer);
		timer = undefined;
		current?.abort();
		current = null;
	}

	async function run(query: string) {
		const controller = new AbortController();
		current = controller;
		let timedOut = false;
		const deadline = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);

		try {
			const response = await request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
				signal: controller.signal,
				headers: { accept: 'application/json' }
			});
			if (!response.ok) throw new Error(`Search returned ${response.status}`);
			const hits = parseSearchResponse(await response.json());
			if (current === controller) publish({ status: 'ready', query, hits });
		} catch {
			// Superseded or reset: not an error, the newer request owns the state.
			if (current !== controller) return;
			if (controller.signal.aborted && !timedOut) return;
			publish({ status: 'error', query, hits: [] });
		} finally {
			clearTimeout(deadline);
			if (current === controller && state.status !== 'loading') current = null;
		}
	}

	return {
		get state() {
			return state;
		},

		setQuery(raw) {
			if (disposed) return;
			const query = normalizeQuery(raw);
			if (query === state.query) return;
			cancel();

			if (!canPreview(query)) {
				publish({ status: 'idle', query, hits: [] });
				return;
			}

			// Films from the previous query stay until the new answer replaces them.
			publish({ status: 'loading', query, hits: state.hits });
			timer = setTimeout(() => {
				timer = undefined;
				void run(query);
			}, debounceMs);
		},

		retry() {
			if (disposed || !canPreview(state.query)) return;
			cancel();
			publish({ status: 'loading', query: state.query, hits: state.hits });
			void run(state.query);
		},

		reset() {
			cancel();
			publish(IDLE);
		},

		dispose() {
			cancel();
			disposed = true;
		}
	};
}
