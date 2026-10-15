import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveSearch, type LiveSearchState } from './live-search';

interface Pending {
	url: string;
	signal: AbortSignal;
	resolve: (body: unknown, init?: { ok?: boolean; status?: number }) => void;
	reject: (error: unknown) => void;
}

function setup(options: { honourAbort?: boolean; timeoutMs?: number } = {}) {
	const pending: Pending[] = [];
	const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		return new Promise<Response>((resolve, reject) => {
			const signal = init?.signal as AbortSignal;
			if (options.honourAbort !== false) {
				signal.addEventListener('abort', () =>
					reject(new DOMException('The operation was aborted.', 'AbortError'))
				);
			}
			pending.push({
				url: String(input),
				signal,
				resolve: (body, response = {}) =>
					resolve({
						ok: response.ok ?? true,
						status: response.status ?? 200,
						json: async () => {
							if (body instanceof Error) throw body;
							return body;
						}
					} as unknown as Response),
				reject
			});
		});
	});
	const states: LiveSearchState[] = [];
	const search = createLiveSearch({
		fetcher: fetcher as unknown as typeof fetch,
		onChange: (state) => states.push(state),
		timeoutMs: options.timeoutMs
	});
	return { search, fetcher, pending, states, last: () => states[states.length - 1] };
}

const films = (...ids: string[]) => ({
	results: ids.map((id) => ({
		id,
		title: `Film ${id}`,
		releaseDate: '2000-01-01',
		posterPath: null,
		voteAverage: 7
	}))
});

// Lets promise continuations run without advancing timers.
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createLiveSearch', () => {
	it('starts idle', () => {
		const { search } = setup();
		expect(search.state).toEqual({ status: 'idle', query: '', hits: [] });
	});

	it('never calls the API for fewer than two characters', async () => {
		const { search, fetcher, last } = setup();
		search.setQuery('a');
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetcher).not.toHaveBeenCalled();
		expect(last()).toEqual({ status: 'idle', query: 'a', hits: [] });
	});

	it('shows loading immediately and waits 200 ms of quiet before asking', async () => {
		const { search, fetcher, last } = setup();
		search.setQuery('ma');
		expect(last().status).toBe('loading');
		await vi.advanceTimersByTimeAsync(100);
		search.setQuery('mat');
		await vi.advanceTimersByTimeAsync(199);
		expect(fetcher).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls[0][0]).toBe('/api/search?q=mat&limit=6');
	});

	it('encodes the query', async () => {
		const { search, fetcher } = setup();
		search.setQuery('a&b=c d');
		await vi.advanceTimersByTimeAsync(200);
		expect(fetcher.mock.calls[0][0]).toBe('/api/search?q=a%26b%3Dc%20d&limit=6');
	});

	it('publishes parsed hits when the response arrives', async () => {
		const { search, pending, last } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].resolve(films('1', '2'));
		await settle();
		expect(last().status).toBe('ready');
		expect(last().query).toBe('matrix');
		expect(last().hits.map((hit) => hit.id)).toEqual(['1', '2']);
	});

	it('aborts the previous request when the query changes and ignores its late answer', async () => {
		const { search, pending, last } = setup();
		search.setQuery('mat');
		await vi.advanceTimersByTimeAsync(200);
		search.setQuery('matr');
		expect(pending[0].signal.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(200);
		pending[1].resolve(films('2'));
		await settle();
		pending[0].resolve(films('1'));
		await settle();
		expect(last().query).toBe('matr');
		expect(last().hits.map((hit) => hit.id)).toEqual(['2']);
	});

	it('ignores a stale answer even when the transport does not honour the abort', async () => {
		const { search, pending, last } = setup({ honourAbort: false });
		search.setQuery('mat');
		await vi.advanceTimersByTimeAsync(200);
		search.setQuery('matr');
		await vi.advanceTimersByTimeAsync(200);
		pending[1].resolve(films('2'));
		await settle();
		pending[0].resolve(films('1'));
		await settle();
		expect(last().hits.map((hit) => hit.id)).toEqual(['2']);
		expect(last().status).toBe('ready');
	});

	it('keeps the previous films while a refined query loads', async () => {
		const { search, pending, last } = setup();
		search.setQuery('mat');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].resolve(films('1'));
		await settle();
		search.setQuery('matr');
		expect(last()).toMatchObject({ status: 'loading', query: 'matr' });
		expect(last().hits.map((hit) => hit.id)).toEqual(['1']);
	});

	it('clears everything and cancels the request when the query becomes too short', async () => {
		const { search, pending, last } = setup();
		search.setQuery('mat');
		await vi.advanceTimersByTimeAsync(200);
		search.setQuery('m');
		expect(pending[0].signal.aborted).toBe(true);
		expect(last()).toEqual({ status: 'idle', query: 'm', hits: [] });
		pending[0].resolve(films('1'));
		await settle();
		expect(last().status).toBe('idle');
	});

	it('does not search again when only whitespace changed', async () => {
		const { search, fetcher } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		search.setQuery('  matrix ');
		await vi.advanceTimersByTimeAsync(500);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('reports an HTTP failure as an error', async () => {
		const { search, pending, last } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].resolve({ error: 'nope' }, { ok: false, status: 500 });
		await settle();
		expect(last()).toMatchObject({ status: 'error', query: 'matrix', hits: [] });
	});

	it('reports a network failure as an error', async () => {
		const { search, pending, last } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].reject(new TypeError('Failed to fetch'));
		await settle();
		expect(last().status).toBe('error');
	});

	it('reports an unreadable body as an error', async () => {
		const { search, pending, last } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].resolve(new SyntaxError('Unexpected token'));
		await settle();
		expect(last().status).toBe('error');
	});

	it('reports a request that never answers as an error after the timeout', async () => {
		const { search, last } = setup({ timeoutMs: 5000 });
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		await vi.advanceTimersByTimeAsync(5000);
		expect(last().status).toBe('error');
	});

	it('does not treat its own abort as an error', async () => {
		const { search, last, states } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		search.reset();
		await settle();
		expect(states.some((state) => state.status === 'error')).toBe(false);
		expect(last()).toEqual({ status: 'idle', query: '', hits: [] });
	});

	it('retries the current query immediately', async () => {
		const { search, pending, fetcher, last } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		pending[0].reject(new TypeError('Failed to fetch'));
		await settle();
		expect(last().status).toBe('error');

		search.retry();
		expect(last().status).toBe('loading');
		expect(fetcher).toHaveBeenCalledTimes(2);
		pending[1].resolve(films('9'));
		await settle();
		expect(last()).toMatchObject({ status: 'ready', query: 'matrix' });
	});

	it('retry does nothing without a searchable query', async () => {
		const { search, fetcher } = setup();
		search.retry();
		search.setQuery('a');
		search.retry();
		await vi.advanceTimersByTimeAsync(500);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('stops everything on dispose', async () => {
		const { search, pending, fetcher, states } = setup();
		search.setQuery('matrix');
		await vi.advanceTimersByTimeAsync(200);
		const before = states.length;
		search.dispose();
		expect(pending[0].signal.aborted).toBe(true);
		search.setQuery('heat');
		await vi.advanceTimersByTimeAsync(500);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(states).toHaveLength(before);
	});
});
