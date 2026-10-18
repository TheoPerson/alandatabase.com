import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestGate, TmdbHttp, TmdbHttpError, type FetchLike } from './tmdb-http.js';

function response(status: number, body: unknown = {}, retryAfter: string | null = null) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: (name: string) => (name === 'retry-after' ? retryAfter : null) },
		json: async () => body
	};
}

function scripted(statuses: Array<number | Error>) {
	const urls: string[] = [];
	const fetch: FetchLike = async (url) => {
		urls.push(url);
		const next = statuses.shift();
		if (next instanceof Error) throw next;
		return response(next ?? 200, { ok: true });
	};
	return { fetch, urls };
}

describe('TmdbHttp', () => {
	it('retries 429 and 5xx, then returns the body', async () => {
		const { fetch, urls } = scripted([429, 503, new Error('reset'), 200]);
		const http = new TmdbHttp({ apiKey: 'k', fetch, gate: new RequestGate(0), backoffMs: 1 });
		assert.deepEqual(await http.get('/tv/1', { language: 'fr-FR' }), { ok: true });
		assert.equal(urls.length, 4);
		assert.match(urls[0], /\/tv\/1\?api_key=k&language=fr-FR$/u);
	});

	it('resolves 404 to null and fails other client errors without leaking the key', async () => {
		const notFound = new TmdbHttp({
			apiKey: 'secret-key',
			fetch: scripted([404]).fetch,
			gate: new RequestGate(0)
		});
		assert.equal(await notFound.get('/tv/2'), null);

		const unauthorized = new TmdbHttp({
			apiKey: 'secret-key',
			fetch: scripted([401]).fetch,
			gate: new RequestGate(0)
		});
		await assert.rejects(unauthorized.get('/tv/3'), (error: unknown) => {
			assert.ok(error instanceof TmdbHttpError);
			assert.equal(error.status, 401);
			assert.doesNotMatch(error.message, /secret-key/u);
			return true;
		});
	});

	it('spaces request starts by the gate interval', async () => {
		const gate = new RequestGate(40);
		const starts: number[] = [];
		await Promise.all([0, 1, 2].map(() => gate.wait().then(() => starts.push(Date.now()))));
		assert.ok(starts[1] - starts[0] >= 35);
		assert.ok(starts[2] - starts[1] >= 35);
	});
});
