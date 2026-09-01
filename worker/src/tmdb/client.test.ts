import assert from 'node:assert/strict';
import test from 'node:test';
import { TMDBClient, TMDBRequestError } from './client.js';

const summary = {
	id: 1,
	title: 'Upcoming',
	original_title: 'Upcoming',
	original_language: 'en',
	overview: 'Overview',
	poster_path: null,
	backdrop_path: null,
	release_date: '2026-09-10',
	genre_ids: [18],
	popularity: 100,
	vote_average: 0,
	vote_count: 0,
	adult: false
};

test('discover uses the bounded global window and required safe filters', async () => {
	let requestedUrl = '';
	let authorization = '';
	const client = new TMDBClient({
		readToken: 'test-token',
		maxRetries: 0,
		fetch: async (input, init) => {
			requestedUrl = input.toString();
			authorization = new Headers(init?.headers).get('authorization') ?? '';
			return Response.json({ results: [summary], total_pages: 5 });
		}
	});
	const page = await client.discoverUpcomingMovies({
		page: 5,
		startDate: '2026-09-01',
		endDate: '2026-11-29'
	});
	const url = new URL(requestedUrl);
	assert.equal(page.results[0]?.id, 1);
	assert.equal(url.searchParams.get('include_adult'), 'false');
	assert.equal(url.searchParams.get('language'), 'en-US');
	assert.equal(url.searchParams.get('sort_by'), 'popularity.desc');
	assert.equal(url.searchParams.get('page'), '5');
	assert.equal(authorization, 'Bearer test-token');
});

test('retries 429 responses with limited exponential backoff', async () => {
	let calls = 0;
	const waits: number[] = [];
	const client = new TMDBClient({
		readToken: 'test-token',
		maxRetries: 2,
		delay: async (milliseconds) => {
			waits.push(milliseconds);
		},
		fetch: async () => {
			calls += 1;
			return calls < 3
				? new Response(null, { status: 429 })
				: Response.json({ results: [summary], total_pages: 1 });
		}
	});
	await client.discoverUpcomingMovies({ page: 1, startDate: '2026-09-01', endDate: '2026-11-29' });
	assert.equal(calls, 3);
	assert.deepEqual(waits, [250, 500]);
});

test('times out, retries only to the configured limit, and redacts credentials from errors', async () => {
	let calls = 0;
	const client = new TMDBClient({
		readToken: 'never-print-this-token',
		timeoutMs: 5,
		maxRetries: 1,
		delay: async () => {},
		fetch: async (_input, init) => {
			calls += 1;
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () =>
					reject(new DOMException('Aborted', 'AbortError'))
				);
			});
		}
	});
	await assert.rejects(
		client.getMovieWatchProviders(1),
		(error: unknown) =>
			error instanceof TMDBRequestError &&
			error.message.includes('timed out') &&
			!error.message.includes('never-print-this-token')
	);
	assert.equal(calls, 2);
});

test('fails closed when credentials or typed provider data are missing', async () => {
	const withoutCredentials = new TMDBClient({ readToken: '', apiKey: '', maxRetries: 0 });
	await assert.rejects(withoutCredentials.getMovieReleaseDates(1), /TMDB_READ_TOKEN is required/u);

	const malformed = new TMDBClient({
		readToken: 'test-token',
		maxRetries: 0,
		fetch: async () => Response.json({ id: 1, results: { FR: { link: 42 } } })
	});
	await assert.rejects(malformed.getMovieWatchProviders(1), /invalid provider link/u);
});
