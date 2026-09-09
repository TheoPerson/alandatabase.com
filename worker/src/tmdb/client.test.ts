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

const episode = {
	id: 101,
	name: 'Next episode',
	overview: '',
	air_date: '2026-09-10',
	episode_number: 1,
	season_number: 2,
	runtime: null,
	still_path: null
};

const tvDetail = {
	id: 10,
	name: 'Series',
	original_name: 'Series',
	overview: 'Series overview',
	poster_path: null,
	backdrop_path: null,
	first_air_date: '2025-01-01',
	status: 'Returning Series',
	number_of_seasons: 2,
	adult: false,
	genres: [{ id: 18, name: 'Drama' }],
	seasons: [
		{ id: 22, name: 'Season 2', season_number: 2, air_date: '2026-09-10', episode_count: 8 }
	],
	next_episode_to_air: episode,
	last_episode_to_air: null,
	keywords: { results: [{ id: 1, name: 'cooking' }] }
};

function tvClient(payload: unknown) {
	return new TMDBClient({
		readToken: 'test-token',
		maxRetries: 0,
		fetch: async () => Response.json(payload)
	});
}

test('TV detail requests English metadata and a required classification envelope', async () => {
	let requestedUrl = '';
	const client = new TMDBClient({
		readToken: 'test-token',
		fetch: async (input) => {
			requestedUrl = input.toString();
			return Response.json(tvDetail);
		}
	});
	const show = await client.getTVDetails(10);
	const url = new URL(requestedUrl);
	assert.equal(url.pathname, '/3/tv/10');
	assert.equal(url.searchParams.get('language'), 'en-US');
	assert.equal(url.searchParams.get('append_to_response'), 'keywords');
	assert.deepEqual(show.keywords, { keywords: [{ id: 1, name: 'cooking' }] });
	assert.equal(show.adult, false);
	assert.equal(show.next_episode_to_air?.episode_number, 1);
});

test('TV parsing fails closed for absent or malformed safety metadata', async () => {
	for (const payload of [
		{ ...tvDetail, adult: undefined },
		{ ...tvDetail, adult: 'false' },
		{ ...tvDetail, keywords: undefined },
		{ ...tvDetail, keywords: { results: null } },
		{ ...tvDetail, keywords: { results: [{ id: 1, name: null }] } }
	]) {
		await assert.rejects(tvClient(payload).getTVDetails(10), TypeError);
	}
	// The classifier must receive true rather than having the transport erase an adult signal.
	assert.equal((await tvClient({ ...tvDetail, adult: true }).getTVDetails(10)).adult, true);
});

test('TV request and response identities must be positive integers and agree', async () => {
	let calls = 0;
	const client = new TMDBClient({
		readToken: 'test-token',
		fetch: async () => {
			calls += 1;
			return Response.json(tvDetail);
		}
	});
	for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
		await assert.rejects(client.getTVDetails(id), TypeError);
		await assert.rejects(client.getTVSeasonDetails(id, 1), TypeError);
	}
	for (const season of [-1, 1.5, Number.POSITIVE_INFINITY]) {
		await assert.rejects(client.getTVSeasonDetails(10, season), TypeError);
	}
	assert.equal(calls, 0);
	await assert.rejects(tvClient({ ...tvDetail, id: 11 }).getTVDetails(10), /invalid TV identity/u);
	await assert.rejects(tvClient({ ...tvDetail, id: 10.5 }).getTVDetails(10), /invalid TV id/u);
});

test('TV season metadata rejects duplicate episodes and mismatched identities', async () => {
	const season = { id: 22, name: 'Season 2', season_number: 2, episodes: [episode] };
	assert.equal((await tvClient(season).getTVSeasonDetails(10, 2)).episodes.length, 1);
	for (const payload of [
		{ ...season, season_number: 3 },
		{ ...season, episodes: [episode, episode] },
		{ ...season, episodes: [episode, { ...episode, id: 102 }] },
		{ ...season, episodes: [{ ...episode, season_number: 1 }] },
		{ ...season, episodes: [{ ...episode, episode_number: 0 }] },
		{ ...season, episodes: [{ ...episode, episode_number: 1.5 }] },
		{ ...season, episodes: [{ ...episode, id: -1 }] }
	]) {
		await assert.rejects(tvClient(payload).getTVSeasonDetails(10, 2), TypeError);
	}
});

test('TV unknown air dates remain unknown and impossible calendar dates are rejected', async () => {
	for (const airDate of [null, '', undefined]) {
		const show = await tvClient({
			...tvDetail,
			next_episode_to_air: { ...episode, air_date: airDate }
		}).getTVDetails(10);
		assert.equal(show.next_episode_to_air?.air_date, null);
	}
	for (const airDate of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-9-10']) {
		await assert.rejects(
			tvClient({
				...tvDetail,
				next_episode_to_air: { ...episode, air_date: airDate }
			}).getTVDetails(10),
			/invalid TV episode air date/u
		);
	}
	const leapDay = await tvClient({
		...tvDetail,
		next_episode_to_air: { ...episode, air_date: '2028-02-29' }
	}).getTVDetails(10);
	assert.equal(leapDay.next_episode_to_air?.air_date, '2028-02-29');
});
