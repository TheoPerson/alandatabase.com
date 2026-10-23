import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { createMigratedTestDatabase } from '../testing/pglite';
import { KNOWN_EXPLICIT_KEYWORD_IDS } from '../policies/movie-visibility';
import type { UserTasteProfile } from '$lib/picker/types';
import { fetchCandidateMovies } from './candidate-query';

type TestContext = Awaited<ReturnType<typeof createMigratedTestDatabase>>;

function emptyProfile(): UserTasteProfile {
	return {
		genreWeights: {},
		topGenres: [],
		favoriteDirectors: new Set(),
		preferredDecades: {},
		avgRuntime: 115,
		totalLogged: 0,
		watchedMovieIds: new Set(),
		dislikedMovieIds: new Set(),
		favoriteMovieIds: new Set(),
		watchlistMovieIds: new Set(),
		recentSkippedMovieIds: new Set()
	};
}

const eligible = {
	adult: false,
	posterPath: '/poster.jpg',
	overview: 'A long enough overview to satisfy the picker candidate rules.',
	runtime: 110,
	releaseDate: '2001-05-05',
	voteAverage: '7.80',
	voteCount: 5000,
	popularity: '50.000'
};

let pg: TestContext['pg'];
let database: TestContext['database'];

beforeAll(async () => {
	({ pg, database } = await createMigratedTestDatabase());

	const [standard, , custom, explicit] = await database
		.insert(schema.movies)
		.values([
			{ ...eligible, tmdbId: 101, title: 'Standard Film', imdbId: 'tt0000001' },
			{ ...eligible, tmdbId: 102, title: 'Adult Film', adult: true },
			{ ...eligible, tmdbId: -5, title: 'Custom Film' },
			{ ...eligible, tmdbId: 104, title: 'Explicit Keyword Film' }
		])
		.returning();
	expect(custom.tmdbId).toBe(-5);

	await database
		.insert(schema.keywords)
		.values({ id: KNOWN_EXPLICIT_KEYWORD_IDS[0], name: 'explicit' });
	await database
		.insert(schema.movieKeywords)
		.values({ movieId: explicit.id, keywordId: KNOWN_EXPLICIT_KEYWORD_IDS[0] });

	// The director is the last of 31 crew rows by insertion order and by id order,
	// so an unordered "first few crew rows" lookup can never find them.
	const crewPeople = await database
		.insert(schema.people)
		.values([
			...Array.from({ length: 30 }, (_, index) => ({
				id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
				tmdbId: 900 + index,
				name: `Crew ${index}`
			})),
			{ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', tmdbId: 999, name: 'Dana Director' }
		])
		.returning();
	for (const person of crewPeople) {
		await database.insert(schema.movieCrew).values({
			movieId: standard.id,
			personId: person.id,
			job: person.name === 'Dana Director' ? 'Director' : 'Producer'
		});
	}
});

afterAll(async () => {
	await pg?.close();
});

describe('picker candidate query', () => {
	it('returns only standard-catalogue movies, never adult, custom or explicit-keyword rows', async () => {
		const candidates = await fetchCandidateMovies({
			filters: {},
			tasteProfile: emptyProfile(),
			database
		});

		expect(candidates.map((candidate) => candidate.title)).toEqual(['Standard Film']);
	});

	it('resolves the director even when it is not among the first crew rows', async () => {
		const candidates = await fetchCandidateMovies({
			filters: {},
			tasteProfile: emptyProfile(),
			database
		});
		const standard = candidates.find((candidate) => candidate.title === 'Standard Film');

		expect(standard?.director).toBe('Dana Director');
	});
});

describe('picker candidate query side effects', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('never calls an external rating API or writes ratings while reading', async () => {
		const fetchSpy = vi.fn(async () => Response.json({ imdbRating: '8.1', imdbVotes: '1,000' }));
		vi.stubGlobal('fetch', fetchSpy);
		vi.stubEnv('OMDB_API_KEY', 'test-key');
		// Earlier reads may have cached an unresolved id; use one that is cache-cold.
		await pg.exec(`update movies set imdb_id = 'tt7654321' where tmdb_id = 101`);

		const [candidate] = await fetchCandidateMovies({
			filters: {},
			tasteProfile: emptyProfile(),
			database
		});
		await new Promise((resolveTick) => setTimeout(resolveTick, 25));

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(candidate?.imdbRating).toBeNull();
		const stored = await pg.query<{ imdb_rating: string | null }>(
			`select imdb_rating from movies where tmdb_id = 101`
		);
		expect(stored.rows[0]?.imdb_rating).toBeNull();
	});
});
