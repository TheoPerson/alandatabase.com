# Movie detail and player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/movies/[id]` into the richest screen of the product (cinematic header, working personal actions, five tabs, where to watch) and add a full-screen trailer player with a Movix-grade settings panel, playing official YouTube trailers through the IFrame API on `youtube-nocookie.com`.

**Architecture:** Pure logic first (`src/lib/catalogue/detail.ts`, `src/lib/player/*`) with unit tests; server reads stay local and bounded through `standardMovieVisibilityWhere()`; one shared interaction helper serves two routes; kit components wrap bits-ui 2.18 (Tabs, Dialog, Slider, Tooltip) on `src/app.css` tokens; the player is a `PlayerShell` driven by a `PlayerSource` adapter (`YouTubeSource` now, `FileSource` later) and a pure auto-hide reducer.

**Tech Stack:** SvelteKit 2.70 / Svelte 5 runes, TypeScript strict, Drizzle + postgres-js, PGlite tests, Vitest 4, Playwright 1.62, bits-ui 2.18.1, lucide-svelte, YouTube IFrame Player API (on demand).

**Spec:** `docs/superpowers/specs/2026-10-12-movie-detail-and-player-design.md` (sections 1–8 and the appended design brief §9, which is binding where more precise).

## Global Constraints

- No third-party streaming mirror, ever. The only embed is the YouTube IFrame API on `https://www.youtube-nocookie.com`, created by the API in `src/lib/player/youtube-source.ts`; no literal `<iframe` anywhere in `src`. `player-safety.test.ts` keeps scanning every source file; its allowlist gains exactly that file for the `youtube-nocookie` string.
- CSP: `frame-src` becomes exactly `https://www.youtube-nocookie.com` (`response-policy.ts`, its test and `ARCHITECTURE.md` change together). No `script-src` rewrite.
- Reads are local and bounded; every movie read goes through `standardMovieVisibilityWhere()`; authorization on the server (`hasPermission(user, 'account:access')`).
- Kit components use tokens only; every control ≥ 44 px on touch; one `variant="primary"` button per page.
- Motion: opacity/transform only; `--duration-fast/base/slow`; nothing moves without user action; reduced motion honoured.
- Trailer resume lives in `localStorage` only (`player:pos:<key>`, 90-day expiry, 50 entries); prefs in one versioned `player:prefs` key; every storage access in try/catch.
- Gates before each commit: `pnpm check` 0 errors, `pnpm lint` 0 errors, `pnpm test:unit -- --run`, worker tests when the worker changes. E2E runs on the production preview with `tests/helpers.ts` `gotoHydrated`.
- Commit identity: `GIT_AUTHOR_NAME="Théo Person" GIT_AUTHOR_EMAIL="theo.person@youkyi.net"` and the same `GIT_COMMITTER_*`.

## Review Focus

1. A movie whose videos are all non-YouTube or have malformed keys must render no Play button and no Videos cards, never an empty iframe → Task 1 tests `pickTrailers` with `site: 'Vimeo'` and a 10-char key; Task 10 opens the player only for keys that pass `isYouTubeKey`.
2. A collection sibling or a similar film that is adult/custom must never appear in Saga or Similar → Task 2 PGlite tests insert such rows and assert they are absent.
3. Stored prefs from an older version or corrupted JSON must not break the player → Task 4 tests `normalizePrefs` with `null`, garbage, unknown keys and out-of-range values.
4. A resume position within the last 15 s, or older than 90 days, must not offer "Resume" → Task 4 tests `resumeOffer` and `pruneResume`.
5. Keyboard shortcuts must never fire while typing in the review textarea or when the user turned shortcuts off → Task 10 tests `shouldHandleShortcut` with an `INPUT`/`TEXTAREA` target and with `prefs.shortcuts === false`.

---

### Task 1: Pure detail helpers (`pickTrailers`, `keyCrew`, `groupProviders`)

**Files:**

- Create: `src/lib/catalogue/detail.ts`
- Test: `src/lib/catalogue/detail.test.ts`

**Interfaces:**

- Produces: `pickTrailers(videos: VideoRow[]): Trailer[]` where `VideoRow = { key: string; site: string; type: string; name: string | null; official?: boolean | null; publishedAt?: string | Date | null }` and `Trailer = { key: string; name: string; type: 'Trailer' | 'Teaser'; official: boolean }`; `keyCrew(crew: CrewRow[]): KeyCrewEntry[]` where `CrewRow = { job: string | null; department?: string | null; person: { id: string; name: string; profilePath?: string | null } | null }` and `KeyCrewEntry = { role: string; personId: string; name: string }`; `groupProviders(rows: ProviderRow[], region: string): ProviderGroups` where `ProviderRow = { region: string; kind: string; providerId: number; providerName: string; logoPath: string | null; displayPriority: number; link: string | null }` and `ProviderGroups = { region: string; link: string | null; stream: ProviderRow[]; free: ProviderRow[]; rent: ProviderRow[]; buy: ProviderRow[]; empty: boolean }`; `KEY_CREW_ROLES`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { groupProviders, keyCrew, pickTrailers } from './detail';

describe('pickTrailers', () => {
	it('keeps only YouTube videos with valid keys, official first, trailers before teasers, newest first, max 6', () => {
		const videos = [
			{ key: 'bad', site: 'YouTube', type: 'Trailer', name: 'Broken', official: true },
			{ key: 'vvvvvvvvvv1', site: 'Vimeo', type: 'Trailer', name: 'Vimeo', official: true },
			{
				key: 'tttttttttt1',
				site: 'YouTube',
				type: 'Teaser',
				name: 'Teaser A',
				official: true,
				publishedAt: '2024-01-01'
			},
			{
				key: 'oooooooooo1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'Old official',
				official: true,
				publishedAt: '2023-01-01'
			},
			{
				key: 'nnnnnnnnnn1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'New official',
				official: true,
				publishedAt: '2025-01-01'
			},
			{
				key: 'uuuuuuuuuu1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'Unofficial',
				official: false,
				publishedAt: '2026-01-01'
			},
			{ key: 'cccccccccc1', site: 'YouTube', type: 'Clip', name: 'Clip', official: true }
		];
		expect(pickTrailers(videos).map((t) => t.name)).toEqual([
			'New official',
			'Old official',
			'Teaser A',
			'Unofficial'
		]);
	});

	it('caps at six and tolerates missing names and dates', () => {
		const many = Array.from({ length: 9 }, (_, i) => ({
			key: `k${String(i).padStart(10, '0')}`,
			site: 'YouTube',
			type: 'Trailer',
			name: null,
			official: true
		}));
		const picked = pickTrailers(many);
		expect(picked).toHaveLength(6);
		expect(picked[0].name).toBe('Trailer');
	});
});

describe('keyCrew', () => {
	it('returns one person per key role in a fixed order and skips unknown jobs', () => {
		const crew = [
			{ job: 'Producer', person: { id: 'p', name: 'Pat' } },
			{ job: 'Editor', person: { id: 'e', name: 'Eve' } },
			{ job: 'Director', person: { id: 'd', name: 'Dana' } },
			{ job: 'Director', person: { id: 'd2', name: 'Second Director' } },
			{ job: 'Original Music Composer', person: { id: 'm', name: 'Max' } },
			{ job: 'Writer', person: null }
		];
		expect(keyCrew(crew)).toEqual([
			{ role: 'Director', personId: 'd', name: 'Dana' },
			{ role: 'Composer', personId: 'm', name: 'Max' },
			{ role: 'Editor', personId: 'e', name: 'Eve' }
		]);
	});
});

describe('groupProviders', () => {
	const rows = [
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 8,
			providerName: 'Netflix',
			logoPath: '/n.jpg',
			displayPriority: 2,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 337,
			providerName: 'Disney+',
			logoPath: '/d.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'free',
			providerId: 5,
			providerName: 'Free TV',
			logoPath: null,
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'ads',
			providerId: 5,
			providerName: 'Free TV',
			logoPath: null,
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'rent',
			providerId: 2,
			providerName: 'Apple TV',
			logoPath: '/a.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'US',
			kind: 'buy',
			providerId: 2,
			providerName: 'Apple TV',
			logoPath: '/a.jpg',
			displayPriority: 1,
			link: 'https://tmdb/us'
		}
	];

	it('groups one region by kind, ordered by display priority, deduplicating free/ads', () => {
		const fr = groupProviders(rows, 'FR');
		expect(fr.stream.map((p) => p.providerName)).toEqual(['Disney+', 'Netflix']);
		expect(fr.free.map((p) => p.providerId)).toEqual([5]);
		expect(fr.rent.map((p) => p.providerName)).toEqual(['Apple TV']);
		expect(fr.buy).toEqual([]);
		expect(fr.link).toBe('https://tmdb/fr');
		expect(fr.empty).toBe(false);
	});

	it('reports an empty region honestly', () => {
		const de = groupProviders(rows, 'DE');
		expect(de.empty).toBe(true);
		expect(de.link).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/catalogue/detail.test.ts`
Expected: FAIL, cannot find module `./detail`.

- [ ] **Step 3: Implement**

```ts
import { isYouTubeKey } from '$lib/tmdb/images';

export interface VideoRow {
	key: string;
	site: string;
	type: string;
	name: string | null;
	official?: boolean | null;
	publishedAt?: string | Date | null;
}

export interface Trailer {
	key: string;
	name: string;
	type: 'Trailer' | 'Teaser';
	official: boolean;
}

const MAX_TRAILERS = 6;

function publishedTime(value: VideoRow['publishedAt']): number {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : 0;
}

export function pickTrailers(videos: VideoRow[]): Trailer[] {
	return videos
		.filter(
			(video): video is VideoRow & { type: 'Trailer' | 'Teaser' } =>
				video.site === 'YouTube' &&
				(video.type === 'Trailer' || video.type === 'Teaser') &&
				isYouTubeKey(video.key)
		)
		.sort((a, b) => {
			const official = Number(Boolean(b.official)) - Number(Boolean(a.official));
			if (official !== 0) return official;
			const type = Number(b.type === 'Trailer') - Number(a.type === 'Trailer');
			if (type !== 0) return type;
			return publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
		})
		.slice(0, MAX_TRAILERS)
		.map((video) => ({
			key: video.key,
			name: video.name?.trim() || video.type,
			type: video.type,
			official: Boolean(video.official)
		}));
}

export interface CrewRow {
	job: string | null;
	department?: string | null;
	person: { id: string; name: string; profilePath?: string | null } | null;
}

export interface KeyCrewEntry {
	role: string;
	personId: string;
	name: string;
}

// Display role → TMDB jobs that fill it, in display order (below-the-line credit matters here).
export const KEY_CREW_ROLES: Array<[role: string, jobs: string[]]> = [
	['Director', ['Director']],
	['Writer', ['Writer', 'Screenplay', 'Story', 'Novel']],
	['Cinematography', ['Director of Photography']],
	['Composer', ['Original Music Composer', 'Music']],
	['Editor', ['Editor']]
];

export function keyCrew(crew: CrewRow[]): KeyCrewEntry[] {
	const entries: KeyCrewEntry[] = [];
	for (const [role, jobs] of KEY_CREW_ROLES) {
		const match = crew.find((row) => row.person && row.job && jobs.includes(row.job));
		if (match?.person) entries.push({ role, personId: match.person.id, name: match.person.name });
	}
	return entries;
}

export interface ProviderRow {
	region: string;
	kind: string;
	providerId: number;
	providerName: string;
	logoPath: string | null;
	displayPriority: number;
	link: string | null;
}

export interface ProviderGroups {
	region: string;
	link: string | null;
	stream: ProviderRow[];
	free: ProviderRow[];
	rent: ProviderRow[];
	buy: ProviderRow[];
	empty: boolean;
}

function byPriority(a: ProviderRow, b: ProviderRow): number {
	return a.displayPriority - b.displayPriority || a.providerName.localeCompare(b.providerName);
}

function unique(rows: ProviderRow[]): ProviderRow[] {
	const seen = new Set<number>();
	return rows.filter((row) =>
		seen.has(row.providerId) ? false : (seen.add(row.providerId), true)
	);
}

export function groupProviders(rows: ProviderRow[], region: string): ProviderGroups {
	const local = rows.filter((row) => row.region === region);
	const pick = (...kinds: string[]) =>
		unique(local.filter((row) => kinds.includes(row.kind)).sort(byPriority));
	const stream = pick('flatrate');
	const free = pick('free', 'ads');
	const rent = pick('rent');
	const buy = pick('buy');
	return {
		region,
		link: local.find((row) => row.link)?.link ?? null,
		stream,
		free,
		rent,
		buy,
		empty: stream.length + free.length + rent.length + buy.length === 0
	};
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `pnpm exec vitest run src/lib/catalogue/detail.test.ts` → PASS (6 tests).

```bash
git add src/lib/catalogue/detail.ts src/lib/catalogue/detail.test.ts
git commit -m "feat(detail): pure helpers for trailers, key crew and watch providers"
```

---

### Task 2: Detail reads — providers, deeper crew, similar and collection films

**Files:**

- Modify: `src/lib/server/services/movie.service.ts` (`getMovieById` `with` block; new `similarMovies`, `collectionMovies`)
- Test: `src/lib/server/services/movie.service.detail.test.ts`

**Interfaces:**

- Produces: `getMovieById(id)` now returns `watchProviders: ProviderRow[]` and up to 30 crew rows; `similarMovies(movieId: string, genreId: number | null, limit = 12)` → standard movies; `collectionMovies(collectionId: string | null, excludeMovieId: string)` → standard movies ordered by release date.

- [ ] **Step 1: Write the failing test**

```ts
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { collectionMovies, getMovieById, similarMovies } from './movie.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

afterAll(async () => {
	await pg.close();
});

async function insertMovie(
	tmdbId: number,
	title: string,
	options: Partial<{
		adult: boolean;
		collection: string | null;
		popularity: number;
		release: string;
	}> = {}
) {
	const { rows } = await pg.query<{ id: string }>(
		`insert into movies (tmdb_id, title, overview, poster_path, backdrop_path, vote_count, vote_average, popularity, adult, collection_id, release_date)
		 values ($1, $2, 'Overview', '/p.jpg', '/b.jpg', 2000, 7.5, $3, $4, $5, $6) returning id`,
		[
			tmdbId,
			title,
			options.popularity ?? 10,
			options.adult ?? false,
			options.collection ?? null,
			options.release ?? '2001-01-01'
		]
	);
	return rows[0].id;
}

describe('movie detail reads', () => {
	it('loads providers and a deep crew for a standard movie', async () => {
		const movieId = await insertMovie(1, 'Film');
		await pg.query(
			`insert into movie_watch_providers (movie_id, region, kind, provider_id, provider_name) values ($1, 'FR', 'flatrate', 8, 'Netflix')`,
			[movieId]
		);
		await pg.query(
			`insert into people (id, tmdb_id, name) select gen_random_uuid(), 9000 + g, 'Crew ' || g from generate_series(1, 25) g`
		);
		await pg.query(
			`insert into movie_crew (movie_id, person_id, department, job) select $1, id, 'Crew', 'Producer' from people where tmdb_id between 9001 and 9024`,
			[movieId]
		);
		await pg.query(
			`insert into movie_crew (movie_id, person_id, department, job) select $1, id, 'Directing', 'Director' from people where tmdb_id = 9025`,
			[movieId]
		);

		const movie = await getMovieById(movieId);

		expect(movie?.watchProviders).toHaveLength(1);
		expect(movie?.crew.some((row: { job: string | null }) => row.job === 'Director')).toBe(true);
	});

	it('similar and collection reads exclude the film itself and quarantined rows', async () => {
		const { rows: collectionRows } = await pg.query<{ id: string }>(
			`insert into collections (tmdb_id, name) values (77, 'Saga') returning id`
		);
		const collection = collectionRows[0].id;
		await pg.query(`insert into genres (id, name) values (28, 'Action') on conflict do nothing`);
		const base = await insertMovie(10, 'Base', {
			collection,
			popularity: 50,
			release: '2000-01-01'
		});
		const sibling = await insertMovie(11, 'Sibling', {
			collection,
			popularity: 5,
			release: '2003-01-01'
		});
		const adultSibling = await insertMovie(12, 'Adult sibling', { collection, adult: true });
		const popular = await insertMovie(13, 'Popular action', { popularity: 99 });
		const custom = await insertMovie(-5, 'Custom action', { popularity: 999 });
		for (const id of [base, sibling, adultSibling, popular, custom]) {
			await pg.query(`insert into movie_genres (movie_id, genre_id) values ($1, 28)`, [id]);
		}

		const similar = await similarMovies(base, 28);
		expect(similar.map((m) => m.title)).toEqual(['Popular action', 'Sibling']);

		const saga = await collectionMovies(collection, base);
		expect(saga.map((m) => m.title)).toEqual(['Sibling']);
		expect(await collectionMovies(null, base)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (`watchProviders` undefined / `similarMovies` not a function).

- [ ] **Step 3: Implement**

In `getMovieById`, change `crew: { limit: 10, ...}` to `limit: 30` and add `watchProviders: true` to the `with` block. Add after `getMovieById`:

```ts
const SIMILAR_LIMIT = 12;

export async function similarMovies(
	movieId: string,
	genreId: number | null,
	limit = SIMILAR_LIMIT
) {
	if (genreId === null) return [];
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			ne(movies.id, movieId),
			sql`exists (select 1 from ${movieGenres} where ${movieGenres.movieId} = ${movies.id} and ${movieGenres.genreId} = ${genreId})`
		),
		orderBy: [desc(movies.popularity), desc(movies.voteAverage)],
		limit: Math.min(Math.max(1, limit), 24),
		with: { genres: { with: { genre: true } }, keywords: true }
	});
	return prepareVisibleMovies(results);
}

export async function collectionMovies(collectionId: string | null, excludeMovieId: string) {
	if (!collectionId) return [];
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			eq(movies.collectionId, collectionId),
			ne(movies.id, excludeMovieId)
		),
		orderBy: [asc(movies.releaseDate)],
		limit: 24,
		with: { genres: { with: { genre: true } }, keywords: true }
	});
	return prepareVisibleMovies(results);
}
```

Import `ne` from `drizzle-orm` and `movieGenres` from the schema (the raw subquery uses identifiers through Drizzle tables, which the relational builder handles; if `column movies.movie_id does not exist` appears, build the predicate like `standardMovieVisibilityWhere()` does with `sql.identifier`).

- [ ] **Step 4: Run tests, gates, commit**

Run: `pnpm exec vitest run src/lib/server/services/movie.service.detail.test.ts && pnpm check` → PASS, 0 errors.

```bash
git add src/lib/server/services/movie.service.ts src/lib/server/services/movie.service.detail.test.ts
git commit -m "feat(detail): providers, deep crew, similar and collection reads"
```

---

### Task 3: One interaction helper for two routes

**Files:**

- Modify: `src/lib/server/services/interaction.service.ts` (add `applyInteraction`)
- Modify: `src/routes/(cinema)/movies/catalog/[id]/+page.server.ts` (action calls the helper; `_parseInteractionUpdate` moves to the service as `parseInteractionUpdate` and is re-exported from the page for its existing test)
- Create: `src/routes/(cinema)/movies/[id]/+page.server.ts` action `logInteraction` (Task 7 completes the loader)
- Test: `src/lib/server/services/interaction.apply.test.ts`

**Interfaces:**

- Produces: `parseInteractionUpdate(type, value)` (same contract as today: booleans for `watched|watchlist|favorite`, rating 0.5–5 half steps or `''` → null); `applyInteraction(userId: string, movieIdOrTmdb: string, update: ParsedInteractionUpdate): Promise<{ watched: boolean; watchlist: boolean; favorite: boolean; rating: number | null } | null>` (null when the movie is not a standard movie).

- [ ] **Step 1: Write the failing test**

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { applyInteraction, parseInteractionUpdate } from './interaction.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;
let userId: string;
let movieId: string;
let adultId: string;

beforeAll(async () => {
	userId = (
		await pg.query<{ id: string }>(
			`insert into users (email, username, password_hash) values ('a@b.test', 'a', 'x') returning id`
		)
	).rows[0].id;
	movieId = (
		await pg.query<{ id: string }>(
			`insert into movies (tmdb_id, title) values (1, 'Film') returning id`
		)
	).rows[0].id;
	adultId = (
		await pg.query<{ id: string }>(
			`insert into movies (tmdb_id, title, adult) values (2, 'Adult', true) returning id`
		)
	).rows[0].id;
});

afterAll(async () => {
	await pg.close();
});

describe('applyInteraction', () => {
	it('creates then updates one row per user and movie, stamping the first watch date', async () => {
		const first = await applyInteraction(userId, movieId, {
			ok: true,
			type: 'watched',
			value: true
		});
		expect(first).toMatchObject({ watched: true, watchlist: false, favorite: false, rating: null });
		const second = await applyInteraction(userId, movieId, {
			ok: true,
			type: 'rating',
			value: 4.5
		});
		expect(second).toMatchObject({ watched: true, rating: 4.5 });
		const { rows } = await pg.query<{ n: number; watch_date: string | null }>(
			`select count(*)::int n, min(watch_date)::text watch_date from user_movie_interactions`
		);
		expect(rows[0].n).toBe(1);
		expect(rows[0].watch_date).not.toBeNull();
	});

	it('refuses quarantined and unknown movies without writing', async () => {
		expect(
			await applyInteraction(userId, adultId, { ok: true, type: 'favorite', value: true })
		).toBeNull();
		expect(
			await applyInteraction(userId, 'nope', { ok: true, type: 'favorite', value: true })
		).toBeNull();
	});

	it('parses updates exactly like the catalogue action did', () => {
		expect(parseInteractionUpdate('watched', 'true')).toEqual({
			ok: true,
			type: 'watched',
			value: true
		});
		expect(parseInteractionUpdate('rating', '')).toEqual({ ok: true, type: 'rating', value: null });
		expect(parseInteractionUpdate('rating', '4.25').ok).toBe(false);
		expect(parseInteractionUpdate('other', 'x').ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (`applyInteraction` not exported).

- [ ] **Step 3: Implement in `interaction.service.ts`**

Move `BOOLEAN_INTERACTION_TYPES` and the body of `_parseInteractionUpdate` into the service as `parseInteractionUpdate`, exporting the type:

```ts
export type ParsedInteractionUpdate =
	| { ok: true; type: 'watched' | 'watchlist' | 'favorite'; value: boolean }
	| { ok: true; type: 'rating'; value: number | null }
	| { ok: false; error: string };

export async function applyInteraction(
	userId: string,
	movieIdOrTmdb: string,
	update: ParsedInteractionUpdate
) {
	if (!update.ok) return null;
	const movieId = await resolveMovieUuid(movieIdOrTmdb);
	if (!movieId) return null;

	const existing = await db.query.userMovieInteractions.findFirst({
		where: and(eq(userMovieInteractions.userId, userId), eq(userMovieInteractions.movieId, movieId))
	});
	const payload: Record<string, unknown> = { updatedAt: new Date() };
	if (update.type === 'rating')
		payload.rating = update.value === null ? null : update.value.toFixed(1);
	else payload[update.type] = update.value;
	if (update.type === 'watched' && update.value && !existing?.watchDate) {
		payload.watchDate = new Date().toISOString().slice(0, 10);
	}

	const [row] = existing
		? await db
				.update(userMovieInteractions)
				.set(payload)
				.where(eq(userMovieInteractions.id, existing.id))
				.returning()
		: await db
				.insert(userMovieInteractions)
				.values({ userId, movieId, ...payload })
				.returning();
	if (!row) return null;
	logActivity(userId, `interaction_${update.type}`, movieId, undefined, {
		value: update.value
	}).catch(() => {});
	return {
		watched: row.watched,
		watchlist: row.watchlist,
		favorite: row.favorite,
		rating: row.rating === null ? null : Number(row.rating)
	};
}
```

Check the `rating` column type in `schema.ts` (decimal → string); keep the existing catalogue action semantics (read its body for `rating` and `logActivity` usage and reproduce them). In `movies/catalog/[id]/+page.server.ts` replace the action body after parsing with `const result = await applyInteraction(locals.user.id, rawMovieId, parsedUpdate); if (!result) return fail(404, { error: 'Could not resolve movie record.' }); return { success: true, interaction: result };` and keep `export const _parseInteractionUpdate = parseInteractionUpdate;`. Create `src/routes/(cinema)/movies/[id]/+page.server.ts` with the same `logInteraction` action (Task 7 adds the loader):

```ts
export const actions = {
	logInteraction: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to log films.' });
		if (!hasPermission(locals.user, 'account:access'))
			return fail(403, { error: 'Personal film activity needs a signed-in account.' });
		const data = await request.formData();
		const update = parseInteractionUpdate(
			data.get('type')?.toString(),
			data.get('value')?.toString()
		);
		if (!update.ok) return fail(400, { error: update.error });
		const result = await applyInteraction(locals.user.id, params.id, update);
		if (!result) return fail(404, { error: 'Could not resolve movie record.' });
		return { success: true, interaction: result };
	}
};
```

- [ ] **Step 4: Run tests and gates, commit**

Run: `pnpm exec vitest run src/lib/server/services src/routes && pnpm check && pnpm lint` → PASS.

```bash
git add src/lib/server/services/interaction.service.ts src/lib/server/services/interaction.apply.test.ts "src/routes/(cinema)/movies/catalog/[id]/+page.server.ts" "src/routes/(cinema)/movies/[id]/+page.server.ts"
git commit -m "refactor(interactions): one server helper for catalogue and detail actions"
```

---

### Task 4: Player pure logic (types, prefs, resume, time, auto-hide, shortcuts)

**Files:**

- Create: `src/lib/player/types.ts`, `src/lib/player/prefs.ts`, `src/lib/player/resume.ts`, `src/lib/player/format-time.ts`, `src/lib/player/auto-hide.ts`, `src/lib/player/shortcuts.ts`
- Test: `src/lib/player/logic.test.ts`

**Interfaces:**

- Produces:
  - `PlayerSource` interface: `load(container: HTMLElement, options: { autoplay: boolean; startAt: number; captions: boolean }): Promise<void>`, `play()`, `pause()`, `seek(seconds)`, `setRate(rate)`, `setVolume(level0to1)`, `setMuted(muted)`, `setCaptions(on)`, `getState(): PlayerSnapshot`, `on(event: PlayerEvent, handler)`, `capabilities(): Capabilities`, `destroy()`. `PlayerSnapshot = { status: 'idle'|'loading'|'ready'|'playing'|'paused'|'buffering'|'ended'|'error'; position: number; duration: number; buffered: number; rate: number; volume: number; muted: boolean; captions: boolean; error?: string }`. `Capabilities = { fullscreen: boolean; pip: boolean; captions: boolean; rates: number[]; boost: boolean; qualities: string[] }`.
  - `PlayerPrefs` and `PREFS_VERSION = 1`, `DEFAULT_PREFS`, `normalizePrefs(input: unknown): PlayerPrefs`, `loadPrefs(storage)`, `savePrefs(storage, prefs)`.
  - `resumeOffer(position, duration)`, `resumeKey(videoKey)`, `readResume(storage, key, now)`, `writeResume(storage, key, position, duration, now)`, `pruneResume(storage, now)`, `RESUME_TTL_MS`, `RESUME_MAX`.
  - `formatTime(seconds)`, `spokenTime(seconds)`.
  - `autoHideReducer(state, action)` with `AutoHideState = { visible: boolean; pointerActive: boolean; ... }` and `shouldHideControls(input)`.
  - `SHORTCUTS` table, `shouldHandleShortcut(event, prefs)`, `matchShortcut(event)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, normalizePrefs, savePrefs } from './prefs';
import { pruneResume, readResume, resumeOffer, writeResume } from './resume';
import { formatTime, spokenTime } from './format-time';
import { shouldHideControls } from './auto-hide';
import { matchShortcut, shouldHandleShortcut } from './shortcuts';

function memoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k) => map.get(k) ?? null,
		key: (i) => [...map.keys()][i] ?? null,
		removeItem: (k) => void map.delete(k),
		setItem: (k, v) => void map.set(k, String(v))
	} as Storage;
}

describe('prefs', () => {
	it('falls back to defaults for garbage and clamps ranges', () => {
		expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
		expect(normalizePrefs('{broken')).toEqual(DEFAULT_PREFS);
		expect(
			normalizePrefs({ version: 1, speed: 9, volume: -3, captionSize: 'huge', unknown: 1 })
		).toEqual({
			...DEFAULT_PREFS,
			speed: 2,
			volume: 0
		});
		expect(normalizePrefs({ version: 0, speed: 1.5 }).speed).toBe(1);
	});

	it('round-trips through storage and survives a throwing storage', () => {
		const storage = memoryStorage();
		savePrefs(storage, { ...DEFAULT_PREFS, speed: 1.25, oled: true });
		expect(loadPrefs(storage)).toMatchObject({ speed: 1.25, oled: true });
		const broken = {
			getItem: () => {
				throw new Error('denied');
			}
		} as unknown as Storage;
		expect(loadPrefs(broken)).toEqual(DEFAULT_PREFS);
	});
});

describe('resume', () => {
	const now = Date.parse('2026-10-12T00:00:00Z');

	it('offers a resume only between 10 s and the last 15 s', () => {
		expect(resumeOffer(5, 120)).toBe(false);
		expect(resumeOffer(20, 120)).toBe(true);
		expect(resumeOffer(110, 120)).toBe(false);
		expect(resumeOffer(20, 0)).toBe(false);
	});

	it('writes, reads, expires after 90 days and keeps at most 50 entries', () => {
		const storage = memoryStorage();
		writeResume(storage, 'abcdefghijk', 42, 120, now);
		expect(readResume(storage, 'abcdefghijk', now)).toEqual({ position: 42, duration: 120 });
		expect(readResume(storage, 'abcdefghijk', now + 91 * 86_400_000)).toBeNull();
		for (let i = 0; i < 60; i++)
			writeResume(storage, `k${String(i).padStart(10, '0')}`, 30, 100, now + i);
		pruneResume(storage, now + 100);
		expect(
			[...Array(storage.length)]
				.map((_, i) => storage.key(i))
				.filter((k) => k?.startsWith('player:pos:')).length
		).toBeLessThanOrEqual(50);
	});
});

describe('time', () => {
	it('formats clock and spoken time', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(75)).toBe('1:15');
		expect(formatTime(3725)).toBe('1:02:05');
		expect(spokenTime(75)).toBe('1 minute 15 seconds');
		expect(formatTime(Number.NaN)).toBe('0:00');
	});
});

describe('auto-hide', () => {
	const base = {
		fullscreen: true,
		playing: true,
		buffering: false,
		focusWithin: false,
		sheetOpen: false,
		pillVisible: false,
		touch: false,
		idleMs: 3000,
		delayMs: 3000
	};
	it('hides only in fullscreen while playing after the delay', () => {
		expect(shouldHideControls(base)).toBe(true);
		expect(shouldHideControls({ ...base, idleMs: 1000 })).toBe(false);
		expect(shouldHideControls({ ...base, fullscreen: false })).toBe(false);
		expect(shouldHideControls({ ...base, playing: false })).toBe(false);
		expect(shouldHideControls({ ...base, focusWithin: true })).toBe(false);
		expect(shouldHideControls({ ...base, sheetOpen: true })).toBe(false);
		expect(shouldHideControls({ ...base, touch: true })).toBe(false);
	});
});

describe('shortcuts', () => {
	it('maps keys to actions and ignores typing targets and disabled prefs', () => {
		expect(matchShortcut({ key: ' ' } as KeyboardEvent)).toBe('toggle');
		expect(matchShortcut({ key: 'j' } as KeyboardEvent)).toBe('back10');
		expect(matchShortcut({ key: '?' } as KeyboardEvent)).toBe('help');
		expect(matchShortcut({ key: 'q' } as KeyboardEvent)).toBeNull();
		const textarea = { tagName: 'TEXTAREA', isContentEditable: false } as HTMLElement;
		expect(
			shouldHandleShortcut(
				{ key: 'k', target: textarea } as unknown as KeyboardEvent,
				DEFAULT_PREFS
			)
		).toBe(false);
		expect(
			shouldHandleShortcut(
				{
					key: 'k',
					target: { tagName: 'DIV', isContentEditable: false }
				} as unknown as KeyboardEvent,
				{ ...DEFAULT_PREFS, shortcuts: false }
			)
		).toBe(false);
		expect(
			shouldHandleShortcut(
				{
					key: 'k',
					target: { tagName: 'DIV', isContentEditable: false }
				} as unknown as KeyboardEvent,
				DEFAULT_PREFS
			)
		).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (modules missing).

- [ ] **Step 3: Implement**

`types.ts`:

```ts
export type PlayerStatus =
	'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export interface PlayerSnapshot {
	status: PlayerStatus;
	position: number;
	duration: number;
	buffered: number;
	rate: number;
	volume: number;
	muted: boolean;
	captions: boolean;
	error?: string;
}

export interface Capabilities {
	fullscreen: boolean;
	pip: boolean;
	captions: boolean;
	rates: number[];
	boost: boolean;
	qualities: string[];
}

export type PlayerEvent = 'state' | 'time' | 'error' | 'autoplayblocked';

export interface PlayerSource {
	load(
		container: HTMLElement,
		options: { autoplay: boolean; startAt: number; captions: boolean }
	): Promise<void>;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	setRate(rate: number): void;
	setVolume(level: number): void;
	setMuted(muted: boolean): void;
	setCaptions(on: boolean): void;
	getState(): PlayerSnapshot;
	on(event: PlayerEvent, handler: (snapshot: PlayerSnapshot) => void): () => void;
	capabilities(): Capabilities;
	destroy(): void;
}
```

`prefs.ts`:

```ts
export const PREFS_VERSION = 1;
export const PREFS_KEY = 'player:prefs';
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export interface PlayerPrefs {
	version: number;
	speed: number;
	volume: number;
	muted: boolean;
	captions: boolean;
	captionSize: 'small' | 'medium' | 'large';
	resume: boolean;
	shortcuts: boolean;
	autoHideMs: 2000 | 3000 | 5000;
	oled: boolean;
	format: 'fit';
}

export const DEFAULT_PREFS: PlayerPrefs = {
	version: PREFS_VERSION,
	speed: 1,
	volume: 1,
	muted: false,
	captions: false,
	captionSize: 'medium',
	resume: true,
	shortcuts: true,
	autoHideMs: 3000,
	oled: false,
	format: 'fit'
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

export function normalizePrefs(input: unknown): PlayerPrefs {
	let raw: unknown = input;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return { ...DEFAULT_PREFS };
		}
	}
	if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== PREFS_VERSION) {
		return { ...DEFAULT_PREFS };
	}
	const r = raw as Record<string, unknown>;
	const speed = clamp(r.speed, 0.5, 2, 1);
	return {
		version: PREFS_VERSION,
		speed: (SPEEDS as readonly number[]).includes(speed)
			? speed
			: SPEEDS.reduce((best, s) => (Math.abs(s - speed) < Math.abs(best - speed) ? s : best), 1),
		volume: clamp(r.volume, 0, 1, 1),
		muted: r.muted === true,
		captions: r.captions === true,
		captionSize: r.captionSize === 'small' || r.captionSize === 'large' ? r.captionSize : 'medium',
		resume: r.resume !== false,
		shortcuts: r.shortcuts !== false,
		autoHideMs: r.autoHideMs === 2000 || r.autoHideMs === 5000 ? r.autoHideMs : 3000,
		oled: r.oled === true,
		format: 'fit'
	};
}

export function loadPrefs(storage: Storage | null | undefined): PlayerPrefs {
	try {
		return normalizePrefs(storage?.getItem(PREFS_KEY));
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function savePrefs(storage: Storage | null | undefined, prefs: PlayerPrefs): void {
	try {
		storage?.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
	} catch {
		// Storage may be unavailable (private mode); prefs then live for the session only.
	}
}
```

`resume.ts`:

```ts
export const RESUME_PREFIX = 'player:pos:';
export const RESUME_TTL_MS = 90 * 86_400_000;
export const RESUME_MAX = 50;
const MIN_OFFER = 10;
const TAIL = 15;

export function resumeOffer(position: number, duration: number): boolean {
	return duration > 0 && position >= MIN_OFFER && position < duration - TAIL;
}

export function resumeKey(videoKey: string): string {
	return `${RESUME_PREFIX}${videoKey}`;
}

interface Stored {
	position: number;
	duration: number;
	at: number;
}

function parse(raw: string | null): Stored | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<Stored>;
		if (
			typeof value.position !== 'number' ||
			typeof value.duration !== 'number' ||
			typeof value.at !== 'number'
		)
			return null;
		return value as Stored;
	} catch {
		return null;
	}
}

export function readResume(
	storage: Storage | null | undefined,
	videoKey: string,
	now: number
): { position: number; duration: number } | null {
	try {
		const stored = parse(storage?.getItem(resumeKey(videoKey)) ?? null);
		if (!stored || now - stored.at > RESUME_TTL_MS) return null;
		return { position: stored.position, duration: stored.duration };
	} catch {
		return null;
	}
}

export function writeResume(
	storage: Storage | null | undefined,
	videoKey: string,
	position: number,
	duration: number,
	now: number
): void {
	try {
		storage?.setItem(
			resumeKey(videoKey),
			JSON.stringify({ position, duration, at: now } satisfies Stored)
		);
	} catch {
		// ignore
	}
}

export function clearResume(storage: Storage | null | undefined, videoKey: string): void {
	try {
		storage?.removeItem(resumeKey(videoKey));
	} catch {
		// ignore
	}
}

export function listResume(
	storage: Storage | null | undefined
): Array<{ key: string; at: number }> {
	const entries: Array<{ key: string; at: number }> = [];
	try {
		if (!storage) return entries;
		for (let i = 0; i < storage.length; i++) {
			const key = storage.key(i);
			if (!key?.startsWith(RESUME_PREFIX)) continue;
			const stored = parse(storage.getItem(key));
			entries.push({ key, at: stored?.at ?? 0 });
		}
	} catch {
		// ignore
	}
	return entries;
}

// Drops expired entries and keeps the newest RESUME_MAX.
export function pruneResume(storage: Storage | null | undefined, now: number): void {
	const entries = listResume(storage).sort((a, b) => b.at - a.at);
	entries.forEach((entry, index) => {
		if (index >= RESUME_MAX || now - entry.at > RESUME_TTL_MS) {
			try {
				storage?.removeItem(entry.key);
			} catch {
				// ignore
			}
		}
	});
}

export function clearAllResume(storage: Storage | null | undefined): number {
	const entries = listResume(storage);
	for (const entry of entries) {
		try {
			storage?.removeItem(entry.key);
		} catch {
			// ignore
		}
	}
	return entries.length;
}
```

`format-time.ts`:

```ts
export function formatTime(seconds: number): string {
	const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
	return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function spokenTime(seconds: number): string {
	const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const parts: string[] = [];
	if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
	if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
	if (s || parts.length === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`);
	return parts.join(' ');
}
```

`auto-hide.ts`:

```ts
export interface AutoHideInput {
	fullscreen: boolean;
	playing: boolean;
	buffering: boolean;
	focusWithin: boolean;
	sheetOpen: boolean;
	pillVisible: boolean;
	touch: boolean;
	idleMs: number;
	delayMs: number;
}

// Controls hide only when nothing needs them: fullscreen, playing, idle past the delay.
export function shouldHideControls(input: AutoHideInput): boolean {
	if (!input.fullscreen || !input.playing || input.buffering) return false;
	if (input.focusWithin || input.sheetOpen || input.pillVisible || input.touch) return false;
	return input.idleMs >= input.delayMs;
}
```

`shortcuts.ts`:

```ts
import type { PlayerPrefs } from './prefs';

export type ShortcutAction =
	| 'toggle'
	| 'back10'
	| 'forward10'
	| 'back5'
	| 'forward5'
	| 'volumeUp'
	| 'volumeDown'
	| 'mute'
	| 'fullscreen'
	| 'captions'
	| 'slower'
	| 'faster'
	| 'help';

export const SHORTCUTS: Array<{ keys: string[]; action: ShortcutAction; label: string }> = [
	{ keys: [' ', 'k', 'K'], action: 'toggle', label: 'Play / pause' },
	{ keys: ['j', 'J'], action: 'back10', label: 'Back 10 seconds' },
	{ keys: ['l', 'L'], action: 'forward10', label: 'Forward 10 seconds' },
	{ keys: ['ArrowLeft'], action: 'back5', label: 'Back 5 seconds' },
	{ keys: ['ArrowRight'], action: 'forward5', label: 'Forward 5 seconds' },
	{ keys: ['ArrowUp'], action: 'volumeUp', label: 'Volume up' },
	{ keys: ['ArrowDown'], action: 'volumeDown', label: 'Volume down' },
	{ keys: ['m', 'M'], action: 'mute', label: 'Mute' },
	{ keys: ['f', 'F'], action: 'fullscreen', label: 'Fullscreen' },
	{ keys: ['c', 'C'], action: 'captions', label: 'Captions' },
	{ keys: ['<'], action: 'slower', label: 'Slower' },
	{ keys: ['>'], action: 'faster', label: 'Faster' },
	{ keys: ['?'], action: 'help', label: 'Keyboard shortcuts' }
];

export function matchShortcut(event: Pick<KeyboardEvent, 'key'>): ShortcutAction | null {
	return SHORTCUTS.find((s) => s.keys.includes(event.key))?.action ?? null;
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function shouldHandleShortcut(
	event: Pick<KeyboardEvent, 'key' | 'target'>,
	prefs: PlayerPrefs
): boolean {
	if (!prefs.shortcuts) return false;
	const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
	if (target && (TYPING.has(target.tagName ?? '') || target.isContentEditable)) return false;
	return matchShortcut(event) !== null;
}
```

- [ ] **Step 4: Run tests, gates, commit**

Run: `pnpm exec vitest run src/lib/player && pnpm check` → PASS.

```bash
git add src/lib/player
git commit -m "feat(player): pure logic — source contract, prefs, resume, time, auto-hide, shortcuts"
```

---

### Task 5: Kit primitives on bits-ui — Tabs, Dialog, Sheet, Slider, Tooltip

**Files:**

- Create: `src/lib/components/ui/tabs/tabs.svelte` + `index.ts`
- Create: `src/lib/components/ui/dialog/dialog.svelte` + `index.ts`
- Create: `src/lib/components/ui/sheet/sheet.svelte` + `index.ts`
- Create: `src/lib/components/ui/slider/slider.svelte` + `index.ts`
- Create: `src/lib/components/ui/tooltip/tooltip.svelte` + `index.ts`
- Modify: `src/routes/(cinema)/kit/+page.svelte` (showcase sections)

**Interfaces:**

- Produces: `Tabs { value: string (bindable); items: Array<{ value: string; label: string; disabled?: boolean }>; orientation?: 'horizontal' | 'vertical'; activation?: 'automatic' | 'manual'; children: Snippet<[string]> }` — the children snippet renders the panel for the active value and receives it; panels are mounted inside `Tabs.Content` per item (`panel-<value>` ids). `Dialog { open (bindable); label: string; variant?: 'center' | 'fullscreen'; onclose?: () => void; children }`. `Sheet { open (bindable); label: string; side?: 'bottom' | 'right'; detent?: 'medium' | 'large' (bindable); modal?: boolean; children }`. `Slider { value (bindable number); min; max; step?; label: string; valueText?: (v: number) => string; buffered?: number; onCommit?: (v: number) => void; orientation?: 'horizontal' }`. `Tooltip { label: string; children }`.

- [ ] **Step 1: Write the components**

`tabs/tabs.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tabs } from 'bits-ui';

	interface Item {
		value: string;
		label: string;
		disabled?: boolean;
	}
	interface Props {
		value: string;
		items: Item[];
		orientation?: 'horizontal' | 'vertical';
		activation?: 'automatic' | 'manual';
		label?: string;
		class?: string;
		children: Snippet<[string]>;
	}

	let {
		value = $bindable(),
		items,
		orientation = 'horizontal',
		activation = 'automatic',
		label = 'Sections',
		class: className = '',
		children
	}: Props = $props();

	let list = $state<HTMLElement>();

	// Keeps the selected trigger visible when the list scrolls on phones.
	$effect(() => {
		const trigger = list?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
		trigger?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
	});
</script>

<Tabs.Root
	bind:value
	{orientation}
	activationMode={activation}
	loop
	class="tabs {orientation} {className}"
>
	<Tabs.List bind:ref={list} class="list" aria-label={label}>
		{#each items as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				disabled={item.disabled}
				class="trigger"
				data-value={item.value}
			>
				{item.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each items as item (item.value)}
		<Tabs.Content value={item.value} class="panel" id={`panel-${item.value}`}>
			{@render children(item.value)}
		</Tabs.Content>
	{/each}
</Tabs.Root>

<style>
	:global(.tabs) {
		display: flex;
		flex-direction: column;
	}
	:global(.tabs.vertical) {
		flex-direction: row;
		gap: var(--space-5);
	}
	:global(.tabs .list) {
		position: relative;
		display: flex;
		gap: var(--space-4);
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--border-subtle);
		mask-image: linear-gradient(
			to right,
			transparent,
			black 1rem,
			black calc(100% - 1rem),
			transparent
		);
	}
	:global(.tabs .list::-webkit-scrollbar) {
		display: none;
	}
	:global(.tabs.vertical .list) {
		flex-direction: column;
		gap: 0;
		border-bottom: 0;
		border-right: 1px solid var(--border-subtle);
		mask-image: none;
		min-width: 9rem;
	}
	:global(.tabs .trigger) {
		position: relative;
		flex: 0 0 auto;
		min-height: 3rem;
		padding-inline: 0.25rem;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		transition: color var(--duration-base) var(--ease-out);
	}
	:global(.tabs.vertical .trigger) {
		min-height: var(--touch-target);
		padding-inline: var(--space-3);
		text-align: left;
	}
	:global(.tabs .trigger::after) {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background: var(--brand-primary);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform var(--duration-base) var(--ease-out);
	}
	:global(.tabs.vertical .trigger::after) {
		left: auto;
		right: -1px;
		top: 0;
		bottom: 0;
		width: 2px;
		height: auto;
		transform: scaleY(0);
	}
	:global(.tabs .trigger[data-state='active']) {
		color: var(--content-primary);
	}
	:global(.tabs .trigger[data-state='active']::after) {
		transform: scale(1);
	}
	:global(.tabs .trigger[data-disabled]) {
		opacity: 0.45;
	}
	:global(.tabs .panel) {
		min-height: 240px;
		padding-top: var(--space-5);
		outline: none;
	}
	:global(.tabs.vertical .panel) {
		flex: 1;
		padding-top: 0;
	}
</style>
```

Check the exact bits-ui 2.18 prop names in `node_modules/bits-ui/dist/bits/tabs/types.d.ts` (`activationMode`, `loop`, `orientation`, `value`, `onValueChange`); adjust if they differ. The kit page shows the hash-sync pattern (reading `location.hash` and writing with `replaceState`) only on the detail page (Task 8), not here.

`dialog/dialog.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		open: boolean;
		label: string;
		variant?: 'center' | 'fullscreen';
		onclose?: () => void;
		class?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		label,
		variant = 'center',
		onclose,
		class: className = '',
		children
	}: Props = $props();

	$effect(() => {
		if (variant !== 'fullscreen') return;
		document.documentElement.toggleAttribute('data-player-open', open);
		return () => document.documentElement.removeAttribute('data-player-open');
	});
</script>

<Dialog.Root
	bind:open
	onOpenChange={(value) => {
		if (!value) onclose?.();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content
			class="dialog-content {variant} {className}"
			aria-label={label}
			trapFocus
			preventScroll
		>
			{#if variant === 'center'}
				<Dialog.Close class="dialog-close" aria-label="Close"><XIcon size={20} /></Dialog.Close>
			{/if}
			{@render children()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(0, 0, 0, 0.7);
		animation: fade var(--duration-slow) var(--ease-out) both;
	}
	:global(.dialog-content) {
		position: fixed;
		z-index: calc(var(--z-sheet) + 1);
		background: var(--surface-raised);
		color: var(--content-primary);
		outline: none;
		animation: fade var(--duration-slow) var(--ease-out) both;
	}
	:global(.dialog-content.center) {
		left: 50%;
		top: 50%;
		width: min(92vw, 32rem);
		max-height: 85dvh;
		overflow: auto;
		padding: var(--space-5);
		border-radius: var(--radius-xl);
		box-shadow: var(--elevation-3);
		transform: translate(-50%, -50%);
	}
	:global(.dialog-content.fullscreen) {
		inset: 0;
		background: #000;
		display: flex;
		flex-direction: column;
	}
	:global(.dialog-close) {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-secondary);
	}
	:global(.dialog-close:hover) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-primary);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	:global(html[data-player-open] .tabs) {
		/* nothing: placeholder-free; the bottom tab bar hides via its own rule */
	}
</style>
```

Remove the last empty rule before committing (it is here only to remind: `BottomTabBar` gets `:global(html[data-player-open]) .tabs { display: none; }` in Task 10). `dialog/index.ts` exports `Dialog`.

`sheet/sheet.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		open: boolean;
		label: string;
		side?: 'bottom' | 'right';
		detent?: 'medium' | 'large';
		modal?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		label,
		side = 'bottom',
		detent = $bindable('medium'),
		modal = true,
		class: className = '',
		children
	}: Props = $props();

	function cycleDetent() {
		if (detent === 'medium') detent = 'large';
		else open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		{#if modal}<Dialog.Overlay class="sheet-overlay" />{/if}
		<Dialog.Content
			class="sheet {side} {detent} {className}"
			aria-label={label}
			trapFocus={modal}
			preventScroll={modal}
			interactOutsideBehavior={modal ? 'close' : 'ignore'}
		>
			<header class="sheet-head">
				{#if side === 'bottom'}
					<button type="button" class="grabber" aria-label="Resize sheet" onclick={cycleDetent}
						><span></span></button
					>
				{/if}
				<h2 class="sheet-title">{label}</h2>
				<Dialog.Close class="sheet-close" aria-label="Close"><XIcon size={20} /></Dialog.Close>
			</header>
			<div class="sheet-body">{@render children()}</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.sheet-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(0, 0, 0, 0.55);
	}
	:global(.sheet) {
		position: fixed;
		z-index: calc(var(--z-sheet) + 2);
		display: flex;
		flex-direction: column;
		background: var(--surface-overlay);
		color: var(--content-primary);
		box-shadow: var(--elevation-3);
		outline: none;
		overscroll-behavior: contain;
		animation: slide var(--duration-slow) var(--ease-out) both;
	}
	:global(.sheet.bottom) {
		left: 0;
		right: 0;
		bottom: 0;
		max-height: min(85svh, calc(100% - env(safe-area-inset-top)));
		height: 50svh;
		padding-bottom: var(--safe-bottom);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		--slide-from: translateY(24px);
	}
	:global(.sheet.bottom.large) {
		height: min(85svh, calc(100% - env(safe-area-inset-top)));
	}
	:global(.sheet.right) {
		top: 0;
		right: 0;
		bottom: 0;
		width: clamp(320px, 36vw, 440px);
		padding-top: var(--safe-top);
		--slide-from: translateX(24px);
	}
	.sheet-head {
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-5) var(--space-2);
	}
	.grabber {
		display: flex;
		justify-content: center;
		width: 100%;
		height: 3rem;
		margin-top: calc(-1 * var(--space-3));
	}
	.grabber span {
		width: 2.5rem;
		height: 4px;
		margin-top: 0.6rem;
		border-radius: var(--radius-full);
		background: var(--content-tertiary);
	}
	.sheet-title {
		font-size: var(--type-title);
		font-weight: 800;
	}
	:global(.sheet-close) {
		position: absolute;
		top: var(--space-2);
		right: var(--space-3);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-secondary);
	}
	.sheet-body {
		flex: 1;
		overflow: auto;
		padding: 0 var(--space-5) var(--space-5);
	}
	@keyframes slide {
		from {
			opacity: 0;
			transform: var(--slide-from, translateY(24px));
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
```

`slider/slider.svelte`:

```svelte
<script lang="ts">
	import { Slider } from 'bits-ui';

	interface Props {
		value: number;
		min: number;
		max: number;
		step?: number;
		label: string;
		valueText?: (value: number) => string;
		buffered?: number;
		onCommit?: (value: number) => void;
		class?: string;
	}

	let {
		value = $bindable(0),
		min,
		max,
		step = 1,
		label,
		valueText,
		buffered = 0,
		onCommit,
		class: className = ''
	}: Props = $props();

	const bufferedPercent = $derived(
		max > min ? Math.min(100, Math.max(0, ((buffered - min) / (max - min)) * 100)) : 0
	);
</script>

<Slider.Root
	type="single"
	bind:value
	{min}
	{max}
	{step}
	onValueCommit={(v) => onCommit?.(v)}
	class="slider {className}"
>
	<span class="track" aria-hidden="true">
		<span class="buffered" style:width={`${bufferedPercent}%`}></span>
		<Slider.Range class="range" />
	</span>
	<Slider.Thumb
		index={0}
		class="thumb"
		aria-label={label}
		aria-valuetext={valueText ? valueText(value) : undefined}
	/>
</Slider.Root>

<style>
	:global(.slider) {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		height: var(--touch-target);
		touch-action: none;
	}
	.track {
		position: relative;
		width: 100%;
		height: 4px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.18);
		overflow: hidden;
	}
	.buffered {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--surface-interactive);
	}
	:global(.slider .range) {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--brand-primary);
	}
	:global(.slider .thumb) {
		position: absolute;
		top: 50%;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--content-primary);
		box-shadow: var(--elevation-1);
		transform: translate(-50%, -50%);
		cursor: grab;
	}
	:global(.slider .thumb:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 3px;
	}
</style>
```

bits-ui positions the thumb with inline `left`; keep `transform: translate(-50%, -50%)` only if the thumb lands off-centre (check on `/kit`).

`tooltip/tooltip.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip } from 'bits-ui';

	interface Props {
		label: string;
		children: Snippet;
	}
	let { label, children }: Props = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<Tooltip.Root>
		<Tooltip.Trigger class="tooltip-trigger">{@render children()}</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content class="tooltip" sideOffset={6}>{label}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	:global(.tooltip-trigger) {
		display: inline-flex;
	}
	:global(.tooltip) {
		z-index: var(--z-toast);
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-sm);
		background: var(--surface-overlay);
		color: var(--content-primary);
		font-size: var(--text-xs);
		font-weight: 600;
		box-shadow: var(--elevation-2);
	}
	@media (pointer: coarse) {
		:global(.tooltip) {
			display: none;
		}
	}
</style>
```

Each `index.ts`: `import X from './x.svelte'; export { X }; export default X;`.

- [ ] **Step 2: Showcase on `/kit`**

Add a `Section title="Tabs, sheet, dialog, slider" eyebrow="Primitives"` with: a `Tabs` of three items rendering a sentence per panel; a `Button` "Open sheet" toggling a bottom `Sheet` with a `Slider` inside; a `Button` "Open dialog" toggling a centre `Dialog`; a `Tooltip label="Tooltip text"` around an icon button.

- [ ] **Step 3: Gates, visual check, commit**

Run: `pnpm check && pnpm lint && pnpm test:unit -- --run` → 0 errors. Build the preview, screenshot `/kit` at 390 and 1440 (open the sheet and dialog with Playwright before shooting), look at them.

```bash
git add src/lib/components/ui "src/routes/(cinema)/kit"
git commit -m "feat(kit): Tabs, Dialog, Sheet, Slider, Tooltip on bits-ui"
```

---

### Task 6: Kit media pieces — PersonCard, TrailerFacade, ProviderLogo, StarRating, ResumeBar; BackdropImage and PosterCard props

**Files:**

- Create: `src/lib/components/ui/person-card/person-card.svelte` + `index.ts`
- Create: `src/lib/components/ui/trailer-facade/trailer-facade.svelte` + `index.ts`
- Create: `src/lib/components/ui/provider-logo/provider-logo.svelte` + `index.ts`
- Create: `src/lib/components/ui/star-rating/star-rating.svelte` + `index.ts`
- Create: `src/lib/components/ui/resume-bar/resume-bar.svelte` + `index.ts`
- Modify: `src/lib/components/ui/backdrop-image/backdrop-image.svelte` (props `animate = true`, `priority: 'high' | 'low' = 'low'`)
- Modify: `src/lib/components/ui/poster-card/poster-card.svelte` (`href` optional → renders a `<div>` frame without link when absent)
- Modify: `src/routes/(cinema)/kit/+page.svelte`

**Interfaces:**

- Produces: `PersonCard { href: string; name: string; profilePath: string | null; subtitle?: string | null; width?: number }`; `TrailerFacade { videoKey: string; name: string; kind: 'Trailer' | 'Teaser'; resume?: { position: number; duration: number } | null; onplay: (key: string) => void }`; `ProviderLogo { providerName: string; logoPath: string | null; href: string | null }`; `StarRating { value: number | null (bindable); onchange?: (value: number | null) => void; name?: string }` (0.5 steps, 5 stars); `ResumeBar { position: number; duration: number }`.

- [ ] **Step 1: Write the components**

`person-card/person-card.svelte`:

```svelte
<script lang="ts">
	import { profileImageUrl } from '$lib/tmdb/images';

	interface Props {
		href: string;
		name: string;
		profilePath: string | null;
		subtitle?: string | null;
		width?: number;
	}
	let { href, name, profilePath, subtitle = null, width = 128 }: Props = $props();
	const src = $derived(profileImageUrl(profilePath));
	const initials = $derived(
		name
			.split(/\s+/u)
			.slice(0, 2)
			.map((part) => part[0] ?? '')
			.join('')
			.toUpperCase()
	);
</script>

<a {href} class="person" style:width={`${width}px`} data-sveltekit-preload-data="hover">
	<span class="photo">
		{#if src}
			<img {src} alt="" width="185" height="278" loading="lazy" decoding="async" />
		{:else}
			<span class="initials" aria-hidden="true">{initials}</span>
		{/if}
	</span>
	<span class="name">{name}</span>
	{#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
</a>

<style>
	.person {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex: 0 0 auto;
	}
	.photo {
		display: block;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--elevation-1);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.initials {
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--content-tertiary);
		font-weight: 800;
	}
	.name {
		font-size: var(--text-sm);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.subtitle {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
```

`trailer-facade/trailer-facade.svelte`:

```svelte
<script lang="ts">
	import PlayIcon from 'lucide-svelte/icons/play';
	import { youtubeThumbnail } from '$lib/tmdb/images';
	import { formatTime } from '$lib/player/format-time';
	import ResumeBar from '../resume-bar/resume-bar.svelte';

	interface Props {
		videoKey: string;
		name: string;
		kind: 'Trailer' | 'Teaser';
		resume?: { position: number; duration: number } | null;
		onplay: (key: string) => void;
	}
	let { videoKey, name, kind, resume = null, onplay }: Props = $props();
	const thumbnail = $derived(youtubeThumbnail(videoKey));
</script>

<button
	type="button"
	class="facade"
	onclick={() => onplay(videoKey)}
	aria-label={`Play ${kind.toLowerCase()}: ${name}`}
>
	<span class="stage">
		{#if thumbnail}<img
				src={thumbnail}
				alt=""
				width="480"
				height="360"
				loading="lazy"
				decoding="async"
			/>{/if}
		<span class="play" aria-hidden="true"><PlayIcon size={22} /></span>
		{#if resume}<ResumeBar position={resume.position} duration={resume.duration} />{/if}
	</span>
	<span class="meta">
		<span class="kind">{kind}</span>
		<span class="name">{name}</span>
		{#if resume}<span class="left">{formatTime(resume.duration - resume.position)} left</span>{/if}
	</span>
</button>

<style>
	.facade {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		color: inherit;
		border-radius: var(--radius-md);
	}
	.stage {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--elevation-1);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play {
		position: absolute;
		left: 50%;
		top: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		background: rgba(8, 9, 11, 0.78);
		color: var(--content-primary);
		transform: translate(-50%, -50%);
		transition: transform var(--duration-fast) var(--ease-out);
	}
	.facade:hover .play {
		transform: translate(-50%, -50%) scale(1.06);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		font-size: var(--text-sm);
	}
	.kind {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.name {
		flex-basis: 100%;
		font-weight: 700;
	}
	.left {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
	}
</style>
```

`provider-logo/provider-logo.svelte`:

```svelte
<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';

	interface Props {
		providerName: string;
		logoPath: string | null;
		href: string | null;
	}
	let { providerName, logoPath, href }: Props = $props();
	const src = $derived(tmdbImageUrl(logoPath, 'w92'));
	const initials = $derived(
		providerName
			.split(/\s+/u)
			.slice(0, 2)
			.map((p) => p[0] ?? '')
			.join('')
			.toUpperCase()
	);
</script>

{#if href}
	<a {href} class="provider" target="_blank" rel="noopener" title={providerName}>
		{#if src}<img {src} alt={providerName} width="44" height="44" loading="lazy" />{:else}<span
				class="initials">{initials}</span
			><span class="sr-only">{providerName}</span>{/if}
	</a>
{:else}
	<span class="provider" title={providerName}>
		{#if src}<img {src} alt={providerName} width="44" height="44" loading="lazy" />{:else}<span
				class="initials">{initials}</span
			><span class="sr-only">{providerName}</span>{/if}
	</span>
{/if}

<style>
	.provider {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		overflow: hidden;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		transition: transform var(--duration-fast) var(--ease-out);
	}
	a.provider:hover {
		transform: translateY(-2px);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.initials {
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
	}
</style>
```

`star-rating/star-rating.svelte` (five stars, half steps, radiogroup semantics on buttons):

```svelte
<script lang="ts">
	import StarIcon from 'lucide-svelte/icons/star';

	interface Props {
		value: number | null;
		onchange?: (value: number | null) => void;
		name?: string;
	}
	let { value = $bindable(null), onchange, name = 'Rating' }: Props = $props();

	const steps = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);
	let hover = $state<number | null>(null);
	const shown = $derived(hover ?? value ?? 0);

	function set(next: number | null) {
		value = next;
		onchange?.(next);
	}
</script>

<div class="rating" role="radiogroup" aria-label={name}>
	{#each [1, 2, 3, 4, 5] as star (star)}
		<span class="star" class:full={shown >= star} class:half={shown >= star - 0.5 && shown < star}>
			<StarIcon size={28} aria-hidden="true" />
			{#each [star - 0.5, star] as step (step)}
				<button
					type="button"
					role="radio"
					class="hit"
					class:left={step !== star}
					aria-checked={value === step}
					aria-label={`${step} of 5`}
					onclick={() => set(step)}
					onmouseenter={() => (hover = step)}
					onmouseleave={() => (hover = null)}
					onfocus={() => (hover = step)}
					onblur={() => (hover = null)}
				></button>
			{/each}
		</span>
	{/each}
	<span class="label" aria-live="polite">{value === null ? 'Not rated' : `${value} / 5`}</span>
	{#if value !== null}<button type="button" class="clear" onclick={() => set(null)}>Clear</button
		>{/if}
	<span class="sr-only">{steps.length} choices</span>
</div>

<style>
	.rating {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.star {
		position: relative;
		display: inline-flex;
		width: var(--touch-target);
		height: var(--touch-target);
		align-items: center;
		justify-content: center;
		color: var(--content-tertiary);
	}
	.star.full,
	.star.half {
		color: var(--rating-star);
	}
	.star.half :global(svg) {
		clip-path: inset(0 50% 0 0);
	}
	.hit {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 50%;
	}
	.hit.left {
		left: 0;
		right: auto;
	}
	.hit:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: -2px;
	}
	.label {
		margin-left: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.clear {
		min-height: var(--touch-target);
		padding-inline: var(--space-3);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
	}
</style>
```

`resume-bar/resume-bar.svelte`:

```svelte
<script lang="ts">
	import { formatTime } from '$lib/player/format-time';
	interface Props {
		position: number;
		duration: number;
	}
	let { position, duration }: Props = $props();
	const percent = $derived(
		duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0
	);
</script>

<span
	class="bar"
	role="progressbar"
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={Math.round(percent)}
	aria-label={`Watched ${formatTime(position)} of ${formatTime(duration)}`}
>
	<span class="fill" style:transform={`scaleX(${percent / 100})`}></span>
</span>

<style>
	.bar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: block;
		height: 3px;
		background: rgba(255, 255, 255, 0.25);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--brand-primary);
		transform-origin: left;
	}
</style>
```

BackdropImage: add props `animate = true` and `priority: 'high' | 'low' = 'low'`; when `animate` is false the image renders with `opacity: 1` and no transform (`class:static={!animate}`); `fetchpriority={priority === 'high' || eager ? 'high' : undefined}`. PosterCard: make `href` optional (`href?: string`); when absent render the same markup inside a `<div class="card">` (no link, no hover lift) — duplicate the inner markup into a snippet `{#snippet body()}` rendered by both branches.

- [ ] **Step 2: Showcase on `/kit`** — add a Section "Detail pieces" with a PersonCard, two TrailerFacades (one with resume), a provider row, a StarRating bound to local state, and a link-less PosterCard.

- [ ] **Step 3: Gates, screenshots, commit**

Run gates; screenshot `/kit`; commit:

```bash
git add src/lib/components/ui "src/routes/(cinema)/kit"
git commit -m "feat(kit): PersonCard, TrailerFacade, ProviderLogo, StarRating, ResumeBar"
```

---

### Task 7: Detail loader

**Files:**

- Modify: `src/routes/(cinema)/movies/[id]/+page.server.ts` (loader; action from Task 3 stays)
- Test: `src/routes/(cinema)/movies/[id]/page.server.detail.test.ts`

**Interfaces:**

- Produces page data: `{ movie, hero: HeroItem, posterPath, tagline, voteCount, trailers: Trailer[], keyCrew: KeyCrewEntry[], cast: Array<{ id; name; profilePath; character }>, crewByDepartment: Array<{ department: string; people: Array<{ id; name; job }> }>, providers: { FR: ProviderGroups; US: ProviderGroups }, similar: PosterItem[], saga: { name: string; items: PosterItem[] } | null, details: { releaseDate; runtime; originalTitle; originalLanguage; status; budget; revenue; tmdbId; imdbId; keywords: string[] }, interaction: { watched; watchlist; favorite; rating } | null, reviews, user }`.

- [ ] **Step 1: Write the failing test** (mock the services like `src/routes/(cinema)/page.server.test.ts` does):

```ts
import { describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	similarMovies: vi.fn(),
	collectionMovies: vi.fn(),
	getUserInteraction: vi.fn(),
	getUserMovieReviews: vi.fn()
}));
vi.mock('$lib/server/services/movie.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getMovieById: services.getMovieById,
	similarMovies: services.similarMovies,
	collectionMovies: services.collectionMovies
}));
vi.mock('$lib/server/services/interaction.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getUserInteraction: services.getUserInteraction,
	getUserMovieReviews: services.getUserMovieReviews
}));

import { load } from './+page.server';

const movie = {
	id: '00000000-0000-4000-8000-000000000001',
	tmdbId: 27205,
	imdbId: 'tt1375666',
	title: 'Inception',
	tagline: 'Your mind is the scene of the crime.',
	overview: 'A thief…',
	posterPath: '/p.jpg',
	backdropPath: '/b.jpg',
	releaseDate: '2010-07-16',
	runtime: 148,
	voteAverage: '8.4',
	voteCount: 30000,
	originalTitle: 'Inception',
	originalLanguage: 'en',
	status: 'Released',
	budget: 160000000,
	revenue: 836836967,
	collectionId: null,
	collection: null,
	metadata: { logoPath: '/logo.png' },
	genres: [{ genre: { id: 28, name: 'Action' } }],
	cast: [
		{ character: 'Cobb', person: { id: 'p1', name: 'Leonardo DiCaprio', profilePath: '/l.jpg' } }
	],
	crew: [
		{ job: 'Director', department: 'Directing', person: { id: 'p2', name: 'Christopher Nolan' } }
	],
	videos: [
		{
			key: 'YoHD9XEInc0',
			site: 'YouTube',
			type: 'Trailer',
			name: 'Official Trailer',
			official: true,
			publishedAt: '2010-05-01'
		}
	],
	watchProviders: [
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 8,
			providerName: 'Netflix',
			logoPath: '/n.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		}
	],
	keywords: []
};

describe('detail load', () => {
	it('shapes trailers, crew, providers, similar and personal state', async () => {
		services.getMovieById.mockResolvedValue(movie);
		services.similarMovies.mockResolvedValue([
			{ ...movie, id: '00000000-0000-4000-8000-000000000002', title: 'Tenet' }
		]);
		services.collectionMovies.mockResolvedValue([]);
		services.getUserInteraction.mockResolvedValue({
			watched: true,
			watchlist: false,
			favorite: false,
			rating: '4.5'
		});
		services.getUserMovieReviews.mockResolvedValue([]);

		const data = await load({
			params: { id: movie.id },
			locals: { user: { id: 'u', role: 'owner' } }
		} as never);

		expect(data.trailers.map((t) => t.key)).toEqual(['YoHD9XEInc0']);
		expect(data.keyCrew).toEqual([{ role: 'Director', personId: 'p2', name: 'Christopher Nolan' }]);
		expect(data.providers.FR.stream[0].providerName).toBe('Netflix');
		expect(data.providers.US.empty).toBe(true);
		expect(data.similar.map((m) => m.title)).toEqual(['Tenet']);
		expect(data.saga).toBeNull();
		expect(data.hero.logoPath).toBe('/logo.png');
		expect(data.interaction).toEqual({
			watched: true,
			watchlist: false,
			favorite: false,
			rating: 4.5
		});
		expect(services.similarMovies).toHaveBeenCalledWith(movie.id, 28);
	});

	it('throws 404 for an unknown or quarantined movie', async () => {
		services.getMovieById.mockResolvedValue(null);
		await expect(
			load({ params: { id: 'x' }, locals: { user: null } } as never)
		).rejects.toMatchObject({ status: 404 });
	});
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (loader returns the old shape).

- [ ] **Step 3: Implement the loader** (keep the Task 3 action):

```ts
import { error, fail, isHttpError } from '@sveltejs/kit';
import { hasPermission } from '$lib/server/auth/permissions';
import { logServerError } from '$lib/server/security/logging';
import { groupProviders, keyCrew, pickTrailers } from '$lib/catalogue/detail';
import {
	applyInteraction,
	getUserInteraction,
	getUserMovieReviews,
	parseInteractionUpdate
} from '$lib/server/services/interaction.service';
import {
	collectionMovies,
	getMovieById,
	similarMovies,
	toHeroItem,
	toPosterItem
} from '$lib/server/services/movie.service';
import type { PageServerLoad } from './$types';

function settled<T>(result: PromiseSettledResult<T>, fallback: T, context: string): T {
	if (result.status === 'fulfilled') return result.value;
	logServerError(context, result.reason);
	return fallback;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;
	let movie: Awaited<ReturnType<typeof getMovieById>>;
	try {
		movie = await getMovieById(params.id);
	} catch (err) {
		logServerError('Movie details load failed', err);
		throw error(500, 'Failed to load movie details');
	}
	if (!movie) throw error(404, 'Movie not found');

	const primaryGenreId: number | null = movie.genres?.[0]?.genre?.id ?? null;
	const [similar, saga, interaction, reviews] = await Promise.allSettled([
		similarMovies(movie.id, primaryGenreId),
		collectionMovies(movie.collectionId ?? null, movie.id),
		user ? getUserInteraction(user.id, movie.id) : Promise.resolve(null),
		getUserMovieReviews(movie.id)
	]);

	const crewRows = movie.crew ?? [];
	const departments = new Map<string, Array<{ id: string; name: string; job: string }>>();
	for (const row of crewRows) {
		if (!row.person) continue;
		const list = departments.get(row.department ?? 'Crew') ?? [];
		list.push({ id: row.person.id, name: row.person.name, job: row.job ?? '' });
		departments.set(row.department ?? 'Crew', list);
	}
	const personal = settled(interaction, null, 'Detail interaction failed');
	const sagaItems = settled(saga, [], 'Detail collection failed').map(toPosterItem);

	return {
		user,
		hero: toHeroItem(movie),
		posterPath: movie.posterPath ?? null,
		tagline: movie.tagline ?? null,
		voteCount: movie.voteCount ?? null,
		overview: movie.overview ?? null,
		genres: (movie.genres ?? []).map(
			(relation: { genre: { id: number; name: string } }) => relation.genre
		),
		trailers: pickTrailers(movie.videos ?? []),
		keyCrew: keyCrew(crewRows),
		cast: (movie.cast ?? []).map(
			(credit: {
				character: string | null;
				person: { id: string; name: string; profilePath: string | null };
			}) => ({
				id: credit.person.id,
				name: credit.person.name,
				profilePath: credit.person.profilePath ?? null,
				character: credit.character ?? null
			})
		),
		crewByDepartment: [...departments].map(([department, people]) => ({ department, people })),
		providers: {
			FR: groupProviders(movie.watchProviders ?? [], 'FR'),
			US: groupProviders(movie.watchProviders ?? [], 'US')
		},
		similar: settled(similar, [], 'Detail similar failed').map(toPosterItem),
		saga:
			sagaItems.length > 0
				? { name: movie.collection?.name ?? 'Collection', items: sagaItems }
				: null,
		details: {
			releaseDate: movie.releaseDate ?? null,
			runtime: movie.runtime ?? null,
			originalTitle: movie.originalTitle ?? null,
			originalLanguage: movie.originalLanguage ?? null,
			status: movie.status ?? null,
			budget: movie.budget ?? null,
			revenue: movie.revenue ?? null,
			tmdbId: movie.tmdbId,
			imdbId: movie.imdbId ?? null,
			keywords: (movie.keywords ?? [])
				.map((k: { keyword?: { name?: string } }) => k.keyword?.name)
				.filter((n: unknown): n is string => typeof n === 'string')
		},
		interaction: personal
			? {
					watched: Boolean(personal.watched),
					watchlist: Boolean(personal.watchlist),
					favorite: Boolean(personal.favorite),
					rating:
						personal.rating === null || personal.rating === undefined
							? null
							: Number(personal.rating)
				}
			: null,
		reviews: settled(reviews, [], 'Detail reviews failed')
	};
};
```

Keep the `isHttpError` import if the catch block needs it; `movie.keywords` rows come from `prepareStandardMovie`, which strips them — if `details.keywords` is always empty, read keywords from the raw row before stripping or drop the field (ruling: keep the field, accept empty until the service exposes names).

- [ ] **Step 4: Run the test and gates, commit**

```bash
git add "src/routes/(cinema)/movies/[id]/+page.server.ts" "src/routes/(cinema)/movies/[id]/page.server.detail.test.ts"
git commit -m "feat(detail): loader shapes trailers, crew, providers, similar, saga and personal state"
```

---

### Task 8: Detail page — header, actions, tabs, where to watch, details, saga

**Files:**

- Rewrite: `src/routes/(cinema)/movies/[id]/+page.svelte`
- Delete: `src/lib/components/movie/PlayerSheet.svelte` (and drop it from `player-safety.test.ts`'s `playbackFiles` list; keep `PlaybackUnavailable` for `/live`)
- Modify: `src/routes/(cinema)/movies/+page.svelte` (remove the hero "Playback status" button and its `PlayerSheet` import; the hero gets a `Details` link only — this page is restyled in the Browse slice)

The page, in order (every size from the design brief §2; the player wiring comes in Task 10 — until then "Play trailer" opens the first trailer on YouTube in a new tab as a temporary link so the page is never a dead end):

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { addToast } from '$lib/stores/toast';
	import {
		formatDate,
		formatMoney,
		formatRating,
		formatRuntime,
		formatVotes,
		formatYear
	} from '$lib/format';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import BackdropImage from '$lib/components/ui/backdrop-image';
	import MetaChips from '$lib/components/ui/meta-chips';
	import Tabs from '$lib/components/ui/tabs';
	import Sheet from '$lib/components/ui/sheet';
	import PersonCard from '$lib/components/ui/person-card';
	import TrailerFacade from '$lib/components/ui/trailer-facade';
	import ProviderLogo from '$lib/components/ui/provider-logo';
	import StarRating from '$lib/components/ui/star-rating';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { logoSrcSet } from '$lib/tmdb/images';
	import PlayIcon from 'lucide-svelte/icons/play';
	import BookmarkIcon from 'lucide-svelte/icons/bookmark';
	import HeartIcon from 'lucide-svelte/icons/heart';
	import EyeIcon from 'lucide-svelte/icons/eye';
	import StarIcon from 'lucide-svelte/icons/star';
	import Share2Icon from 'lucide-svelte/icons/share-2';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';

	let { data } = $props();

	const TAB_ITEMS = $derived([
		{ value: 'overview', label: 'Overview' },
		{ value: 'cast', label: 'Cast & crew' },
		{ value: 'videos', label: 'Videos' },
		{ value: 'details', label: 'Details' },
		...(data.saga || data.similar.length ? [{ value: 'more', label: 'Saga & similar' }] : [])
	]);
	let tab = $state('overview');
	let region = $state<'FR' | 'US'>('FR');
	let rateOpen = $state(false);
	let pending = $state<string | null>(null);
	let interaction = $state(data.interaction);

	$effect(() => {
		interaction = data.interaction;
	});

	$effect(() => {
		const hash = page.url.hash.replace('#', '');
		if (TAB_ITEMS.some((item) => item.value === hash)) tab = hash;
		try {
			const stored = localStorage.getItem('ui:region');
			if (stored === 'US' || stored === 'FR') region = stored;
		} catch {
			// ignore
		}
	});

	function selectTab(value: string) {
		tab = value;
		replaceState(`#${value}`, page.state);
	}

	function setRegion(next: 'FR' | 'US') {
		region = next;
		try {
			localStorage.setItem('ui:region', next);
		} catch {
			// ignore
		}
	}

	const logo = $derived(logoSrcSet(data.hero.logoPath));
	const meta = $derived([
		formatRating(data.hero.rating)
			? `★ ${formatRating(data.hero.rating)}${formatVotes(data.voteCount) ? ` (${formatVotes(data.voteCount)})` : ''}`
			: null,
		formatYear(data.hero.releaseDate),
		formatRuntime(data.hero.runtime)
	]);
	const loginHref = $derived(
		`/auth/login?returnTo=${encodeURIComponent(`/movies/${data.hero.id}`)}`
	);
	const firstTrailer = $derived(data.trailers[0] ?? null);
	const groups = $derived(data.providers[region]);

	function toggleLabel(type: 'watchlist' | 'favorite' | 'watched', on: boolean): string {
		if (type === 'watchlist') return on ? 'In watchlist' : 'Watchlist';
		if (type === 'favorite') return on ? 'Favourited' : 'Favourite';
		return on ? 'Watched' : 'Mark watched';
	}

	async function share() {
		const url = `https://alandatabase.com/movies/${data.hero.id}`;
		try {
			if (navigator.share) {
				await navigator.share({ title: data.hero.title, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			addToast('Link copied', 'success');
		} catch {
			addToast('Could not share this page.', 'error');
		}
	}

	function openTrailer(key: string) {
		// Task 10 replaces this with the in-page player.
		window.open(`https://www.youtube-nocookie.com/embed/${key}`, '_blank', 'noopener');
	}
</script>
```

The `openTrailer` placeholder above violates the plan's own iframe-free rule only in spirit (it is a link, not an embed); Task 10 removes it. If `player-safety.test.ts` flags the `youtube-nocookie` string in this file, use `https://www.youtube.com/watch?v=${key}` for the temporary link instead.

Markup (abridged to the structure; every section carries its real content):

```svelte
<svelte:head>…existing title/meta/JSON-LD, unchanged…</svelte:head>

<article class="detail">
	<header class="header">
		<BackdropImage path={data.hero.backdropPath} eager animate={false} priority="low" sizes="100vw" />
		<div class="scrim" aria-hidden="true"></div>
		<div class="header-content">
			<div class="poster"><PosterCard title={data.hero.title} posterPath={data.posterPath} eager /></div>
			<div class="text">
				<div class="title-box">
					{#if logo}<img class="logo" src={logo.src} srcset={logo.srcset || undefined} sizes="(min-width: 1024px) 420px, 70vw" alt="" loading="eager" /><h1 class="sr-only">{data.hero.title}</h1>{:else}<h1 class="title">{data.hero.title}</h1>{/if}
				</div>
				{#if data.tagline}<p class="tagline">{data.tagline}</p>{/if}
				<MetaChips items={meta} class="meta" />
				<div class="genres">{#each data.genres as genre (genre.id)}<Chip href={`/movies/catalog?genre=${genre.id}`}>{genre.name}</Chip>{/each}</div>
				<div class="actions" role="group" aria-label="Actions">
					{#if firstTrailer}
						<Button size="lg" onclick={() => openTrailer(firstTrailer.key)}><PlayIcon size={20} aria-hidden="true" />Play trailer</Button>
					{:else}
						<span class="no-trailer">No trailer yet</span>
					{/if}
					{#each (['watchlist', 'favorite', 'watched'] as const) as type (type)}
						{@const on = Boolean(interaction?.[type])}
						{#if data.user}
							<form method="POST" action="?/logInteraction" use:enhance={() => { pending = type; const previous = interaction; interaction = { ...(interaction ?? { watched: false, watchlist: false, favorite: false, rating: null }), [type]: !on }; return async ({ result, update }) => { pending = null; if (result.type === 'success') { await update({ reset: false }); addToast(`${data.hero.title}: ${toggleLabel(type, !on).toLowerCase()}`, 'success'); } else { interaction = previous; addToast('Could not save that.', 'error'); } }; }}>
								<input type="hidden" name="type" value={type} />
								<input type="hidden" name="value" value={String(!on)} />
								<Button type="submit" variant="secondary" aria-pressed={on} loading={pending === type}>
									{#if type === 'watchlist'}<BookmarkIcon size={18} aria-hidden="true" />{:else if type === 'favorite'}<HeartIcon size={18} aria-hidden="true" />{:else}<EyeIcon size={18} aria-hidden="true" />{/if}
									{toggleLabel(type, on)}
								</Button>
							</form>
						{:else}
							<Button href={loginHref} variant="secondary">{toggleLabel(type, false)}</Button>
						{/if}
					{/each}
					{#if data.user}<Button variant="secondary" onclick={() => (rateOpen = true)}><StarIcon size={18} aria-hidden="true" />{interaction?.rating ? `${interaction.rating} / 5` : 'Rate'}</Button>{:else}<Button href={loginHref} variant="secondary">Rate</Button>{/if}
					<Button variant="ghost" onclick={share}><Share2Icon size={18} aria-hidden="true" />Share</Button>
				</div>
			</div>
		</div>
	</header>

	<div class="body">
		<Tabs bind:value={tab} items={TAB_ITEMS} label="Film sections" onValueChange={selectTab}>
			{#snippet children(value)}
				{#if value === 'overview'}
					<div class="overview">
						<div><h2 class="h">Synopsis</h2><p class="synopsis">{data.overview}</p>
							{#if data.keyCrew.length}<dl class="crew-key">{#each data.keyCrew as entry (entry.role)}<div><dt>{entry.role}</dt><dd><a href={`/people/${entry.personId}`}>{entry.name}</a></dd></div>{/each}</dl>{/if}
							{#if data.saga}<a class="saga-banner" href="#more" onclick={() => selectTab('more')}>Part of the {data.saga.name}</a>{/if}
						</div>
						<aside class="watch" aria-labelledby="watch-h">
							<div class="watch-head"><h2 class="h" id="watch-h">Where to watch</h2><div class="region" role="group" aria-label="Region">{#each (['FR', 'US'] as const) as r (r)}<Chip selected={region === r} onclick={() => setRegion(r)}>{r}</Chip>{/each}</div></div>
							{#if groups.empty}
								<p class="muted">Not streaming in {region === 'FR' ? 'France' : 'the United States'} right now.</p>
							{:else}
								{#each [['Stream', groups.stream], ['Free', groups.free], ['Rent', groups.rent], ['Buy', groups.buy]] as [label, rows] (label)}
									{#if rows.length}<h3 class="kind">{label}</h3><div class="providers">{#each rows as row (row.providerId)}<ProviderLogo providerName={row.providerName} logoPath={row.logoPath} href={groups.link} />{/each}</div>{/if}
								{/each}
							{/if}
							<p class="attribution">Data by JustWatch{#if groups.link} · <a href={groups.link} target="_blank" rel="noopener">See all options on TMDB<ExternalLinkIcon size={12} aria-hidden="true" /></a>{/if}</p>
						</aside>
					</div>
				{:else if value === 'cast'}
					{#if data.cast.length}<h2 class="h">Cast</h2><Rail label="Cast">{#each data.cast as person (person.id)}<PersonCard href={`/people/${person.id}`} name={person.name} profilePath={person.profilePath} subtitle={person.character} />{/each}</Rail>{/if}
					{#if data.crewByDepartment.length}<h2 class="h">Crew</h2><div class="crew-grid">{#each data.crewByDepartment as group (group.department)}<section><h3>{group.department}</h3><ul>{#each group.people as person (person.id + person.job)}<li><a href={`/people/${person.id}`}>{person.name}</a><span class="muted"> · {person.job}</span></li>{/each}</ul></section>{/each}</div>{/if}
					{#if !data.cast.length && !data.crewByDepartment.length}<EmptyState title="No credits yet" compact />{/if}
				{:else if value === 'videos'}
					{#if data.trailers.length}<div class="videos">{#each data.trailers as trailer (trailer.key)}<TrailerFacade videoKey={trailer.key} name={trailer.name} kind={trailer.type} onplay={openTrailer} />{/each}</div>{:else}<EmptyState title="No trailer yet" compact />{/if}
				{:else if value === 'details'}
					<dl class="details">…rows for release date (formatDate), runtime, original title, language, status, budget, revenue (formatMoney), TMDB link https://www.themoviedb.org/movie/{tmdbId}, IMDb link https://www.imdb.com/title/{imdbId} when present…</dl>
					{#if data.details.keywords.length}<div class="keywords">{#each data.details.keywords as keyword (keyword)}<Chip href={`/search?q=${encodeURIComponent(keyword)}`}>{keyword}</Chip>{/each}</div>{/if}
				{:else if value === 'more'}
					{#if data.saga}<Section title={data.saga.name} eyebrow="Saga"><Rail label={data.saga.name}>{#each data.saga.items as item (item.id)}<PosterCard {...item} />{/each}</Rail></Section>{/if}
					{#if data.similar.length}<Section title="More like this"><Rail label="More like this">{#each data.similar as item (item.id)}<PosterCard {...item} />{/each}</Rail></Section>{/if}
				{/if}
			{/snippet}
		</Tabs>
		{#if data.user}<p class="review-link"><a href={`/movies/catalog/${data.hero.id}/review`}>Write a review</a></p>{/if}
	</div>
</article>

<Sheet bind:open={rateOpen} label="Your rating">
	<form method="POST" action="?/logInteraction" use:enhance={() => { pending = 'rating'; return async ({ result, update }) => { pending = null; rateOpen = false; if (result.type === 'success') { await update({ reset: false }); addToast('Rating saved', 'success'); } else addToast('Could not save the rating.', 'error'); }; }}>
		<input type="hidden" name="type" value="rating" />
		<input type="hidden" name="value" value={interaction?.rating ?? ''} />
		<StarRating value={interaction?.rating ?? null} onchange={(v) => (interaction = { ...(interaction ?? { watched: false, watchlist: false, favorite: false, rating: null }), rating: v })} />
		<div class="sheet-actions"><Button type="submit" loading={pending === 'rating'}>Save</Button></div>
	</form>
</Sheet>
```

CSS (the brief's numbers): header `position: relative; margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top))); min-height: min(56dvh, 400px)` → 390: `min(60dvh, 460px)` → 768: `min(60dvh, 520px)` → 1024: `min(80dvh, 720px)`; `.header-content { display: grid; grid-template-columns: 1fr; align-items: end; max-width: var(--container-wide); margin: 0 auto; padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-5)) var(--page-gutter) var(--space-6); }` with `.poster { width: 96px }` (390: 112px; 768: `grid-template-columns: clamp(160px, 22vw, 220px) 1fr; gap: var(--space-6)`; 1440: 280px); `.title { font-size: clamp(2rem, 9vw, 2.75rem) }` (1024: `var(--type-display)`); `.actions { display: flex; flex-wrap: wrap; gap: var(--space-2) }`; `.overview { display: grid; gap: var(--space-6) }` (768: `grid-template-columns: 1.2fr 1fr`; 1024: `7fr 5fr; gap: var(--space-8)`); `.videos { display: grid; gap: var(--space-4) }` (768: 2 columns; 1440: 3); `.providers { display: flex; flex-wrap: wrap; gap: var(--space-2) }`; `.crew-grid { display: grid; gap: var(--space-5) }` (768: 2 columns); `.details { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-5) }`. Text block `.text::before` vignette like the hero carousel. The tab panels get `min-height: 240px`.

- [ ] **Step 1: Gates and screenshots**

Run gates; build the preview; screenshot a real detail page (first `/movies/<uuid>` from Home) at 390 and 1440 for each tab; look at them; fix overflow or collisions. Then commit:

```bash
git add -A src/routes src/lib/components tests
git commit -m "feat(detail): cinematic header, working actions, five tabs, where to watch"
```

---

### Task 9: YouTube source adapter, CSP allowlist, safety test

**Files:**

- Create: `src/lib/player/youtube-source.ts`
- Modify: `src/lib/server/security/response-policy.ts` (+ test), `src/hooks.server.ts` only if the function name changes (keep `denyFrameSources` name; it now allows exactly one origin)
- Modify: `src/lib/components/player/player-safety.test.ts` (allowlist the adapter for the `youtube-nocookie` string; keep every other pattern)
- Modify: `ARCHITECTURE.md` (CSP line)

**Interfaces:**

- Produces: `createYouTubeSource(videoKey: string): PlayerSource` (throws on invalid key); `YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'`.

- [ ] **Step 1: Write the failing tests**

Response policy (`response-policy.test.ts`): change expectations to `frame-src https://www.youtube-nocookie.com;` in all three cases. Safety test: add a case that `src/lib/player/youtube-source.ts` is the only file allowed to contain `youtube-nocookie`, and that no file contains `<iframe`. Adapter unit test `src/lib/player/youtube-source.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createYouTubeSource, YOUTUBE_EMBED_ORIGIN } from './youtube-source';

describe('YouTube source', () => {
	it('rejects invalid keys before touching the DOM', () => {
		expect(() => createYouTubeSource('bad')).toThrow(/video key/u);
	});

	it('starts idle with safe defaults and reports YouTube capabilities', () => {
		const source = createYouTubeSource('dQw4w9WgXcQ');
		expect(source.getState()).toMatchObject({
			status: 'idle',
			position: 0,
			duration: 0,
			rate: 1,
			volume: 1,
			muted: false
		});
		expect(source.capabilities()).toMatchObject({
			pip: false,
			boost: false,
			captions: true,
			fullscreen: true,
			qualities: ['Auto']
		});
		expect(YOUTUBE_EMBED_ORIGIN).toBe('https://www.youtube-nocookie.com');
	});
});
```

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement**

`response-policy.ts`:

```ts
export const ALLOWED_FRAME_SOURCES = ['https://www.youtube-nocookie.com'] as const;

// Only the official trailer embed may be framed; everything else stays denied.
export function denyFrameSources(existingPolicy: string | null | undefined): string {
	const directives = (existingPolicy ?? '')
		.split(';')
		.map((directive) => directive.trim())
		.filter(Boolean)
		.filter((directive) => !/^frame-src(?:\s|$)/i.test(directive));
	directives.push(`frame-src ${ALLOWED_FRAME_SOURCES.join(' ')}`);
	return `${directives.join('; ')};`;
}
```

`youtube-source.ts` (the IFrame API; minimal local typing):

```ts
import { isYouTubeKey } from '$lib/tmdb/images';
import type { Capabilities, PlayerEvent, PlayerSnapshot, PlayerSource } from './types';

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const API_SRC = 'https://www.youtube.com/iframe_api';

interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	setPlaybackRate(rate: number): void;
	getAvailablePlaybackRates(): number[];
	setVolume(volume: number): void;
	mute(): void;
	unMute(): void;
	getCurrentTime(): number;
	getDuration(): number;
	getVideoLoadedFraction(): number;
	getPlayerState(): number;
	loadModule(name: string): void;
	unloadModule(name: string): void;
	setOption(module: string, option: string, value: unknown): void;
	destroy(): void;
}

interface YTNamespace {
	Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
	PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
}

declare global {
	interface Window {
		YT?: YTNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT) resolve(window.YT);
			else reject(new Error('YouTube API did not initialise'));
		};
		const script = document.createElement('script');
		script.src = API_SRC;
		script.async = true;
		script.onerror = () => {
			apiPromise = null;
			reject(new Error('YouTube API failed to load'));
		};
		document.head.append(script);
	});
	return apiPromise;
}

export function createYouTubeSource(videoKey: string): PlayerSource {
	if (!isYouTubeKey(videoKey)) throw new Error('Invalid YouTube video key');

	let player: YTPlayer | null = null;
	let snapshot: PlayerSnapshot = {
		status: 'idle',
		position: 0,
		duration: 0,
		buffered: 0,
		rate: 1,
		volume: 1,
		muted: false,
		captions: false
	};
	const handlers = new Map<PlayerEvent, Set<(s: PlayerSnapshot) => void>>();
	let timer: number | null = null;
	let playRequestedAt = 0;

	function emit(event: PlayerEvent) {
		for (const handler of handlers.get(event) ?? []) handler(snapshot);
	}

	function tick() {
		if (!player) return;
		snapshot = {
			...snapshot,
			position: player.getCurrentTime() || 0,
			duration: player.getDuration() || 0,
			buffered: (player.getVideoLoadedFraction() || 0) * (player.getDuration() || 0)
		};
		emit('time');
	}

	function startPolling() {
		if (timer !== null) return;
		timer = window.setInterval(tick, 250);
	}

	function stopPolling() {
		if (timer !== null) window.clearInterval(timer);
		timer = null;
	}

	function onStateChange(state: number, YT: YTNamespace) {
		const map: Record<number, PlayerSnapshot['status']> = {
			[YT.PlayerState.PLAYING]: 'playing',
			[YT.PlayerState.PAUSED]: 'paused',
			[YT.PlayerState.BUFFERING]: 'buffering',
			[YT.PlayerState.ENDED]: 'ended',
			[YT.PlayerState.CUED]: 'ready',
			[YT.PlayerState.UNSTARTED]: 'ready'
		};
		snapshot = { ...snapshot, status: map[state] ?? snapshot.status };
		if (snapshot.status === 'playing') startPolling();
		else stopPolling();
		tick();
		emit('state');
	}

	return {
		async load(container, options) {
			snapshot = { ...snapshot, status: 'loading', captions: options.captions };
			emit('state');
			const YT = await loadApi();
			const mount = document.createElement('div');
			container.replaceChildren(mount);
			await new Promise<void>((resolve, reject) => {
				player = new YT.Player(mount, {
					host: YOUTUBE_EMBED_ORIGIN,
					videoId: videoKey,
					width: '100%',
					height: '100%',
					playerVars: {
						autoplay: options.autoplay ? 1 : 0,
						controls: 0,
						disablekb: 1,
						playsinline: 1,
						rel: 0,
						iv_load_policy: 3,
						modestbranding: 1,
						enablejsapi: 1,
						origin: window.location.origin,
						start: Math.floor(options.startAt),
						cc_load_policy: options.captions ? 1 : 0
					},
					events: {
						onReady: () => {
							snapshot = { ...snapshot, status: 'ready', duration: player?.getDuration() || 0 };
							emit('state');
							resolve();
						},
						onStateChange: (event: { data: number }) => onStateChange(event.data, YT),
						onError: (event: { data: number }) => {
							snapshot = { ...snapshot, status: 'error', error: `YouTube error ${event.data}` };
							emit('error');
							reject(new Error(snapshot.error));
						}
					}
				});
			});
			if (options.autoplay) {
				playRequestedAt = Date.now();
				window.setTimeout(() => {
					if (snapshot.status === 'ready' && Date.now() - playRequestedAt >= 1500)
						emit('autoplayblocked');
				}, 1600);
			}
		},
		play: () => player?.playVideo(),
		pause: () => player?.pauseVideo(),
		seek: (seconds) => player?.seekTo(Math.max(0, seconds), true),
		setRate: (rate) => {
			player?.setPlaybackRate(rate);
			snapshot = { ...snapshot, rate };
			emit('state');
		},
		setVolume: (level) => {
			player?.setVolume(Math.round(level * 100));
			snapshot = { ...snapshot, volume: level };
			emit('state');
		},
		setMuted: (muted) => {
			if (muted) player?.mute();
			else player?.unMute();
			snapshot = { ...snapshot, muted };
			emit('state');
		},
		setCaptions: (on) => {
			try {
				if (on) player?.loadModule('captions');
				else player?.unloadModule('captions');
			} catch {
				/* captions module optional */
			}
			snapshot = { ...snapshot, captions: on };
			emit('state');
		},
		getState: () => snapshot,
		on: (event, handler) => {
			const set = handlers.get(event) ?? new Set();
			set.add(handler);
			handlers.set(event, set);
			return () => set.delete(handler);
		},
		capabilities: (): Capabilities => ({
			fullscreen: true,
			pip: false,
			captions: true,
			rates: player?.getAvailablePlaybackRates?.() ?? [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
			boost: false,
			qualities: ['Auto']
		}),
		destroy: () => {
			stopPolling();
			try {
				player?.destroy();
			} catch {
				/* already gone */
			}
			player = null;
			handlers.clear();
		}
	};
}
```

`player-safety.test.ts`: in the file-scan loop, skip the `youtube-nocookie` pattern for `lib/player/youtube-source.ts` (add `/youtube-nocookie/i` to `blockedPatterns` with that single exemption) and remove `lib/components/movie/PlayerSheet.svelte` from `playbackFiles`. `ARCHITECTURE.md`: "cinema uses a CSP whose `frame-src` allows exactly `https://www.youtube-nocookie.com` for the trailer player".

- [ ] **Step 4: Run tests, gates, commit**

```bash
git add src/lib/player src/lib/server/security src/lib/components/player/player-safety.test.ts ARCHITECTURE.md
git commit -m "feat(player): YouTube IFrame source adapter; CSP frame-src allowlist for youtube-nocookie"
```

---

### Task 10: PlayerShell, PlayerSettings and the detail wiring

**Files:**

- Create: `src/lib/components/ui/player/player-shell.svelte`, `player-settings.svelte`, `shortcut-help.svelte`, `index.ts`
- Modify: `src/lib/components/ui/bottom-tab-bar/bottom-tab-bar.svelte` (`:global(html[data-player-open]) .tabs { display: none }`)
- Modify: `src/routes/(cinema)/movies/[id]/+page.svelte` (replace `openTrailer` with the player dialog)
- Modify: `src/routes/(cinema)/kit/+page.svelte` (player demo: closed by default, button opens it on a sample key)
- Test: `src/lib/player/controller.test.ts` for the pure controller (`src/lib/player/controller.ts`)

**Interfaces:**

- Produces: `createController(source: PlayerSource, prefs: PlayerPrefs, storage, now)` returning `{ state (snapshot getter), toggle(), skip(seconds), seek(s), setRate(r), setVolume(v), toggleMute(), toggleCaptions(), applyPrefs(prefs), persistPosition(), dispose() }` — pure over the `PlayerSource` interface, tested with a fake source; `PlayerShell { open (bindable); title: string; videoKey: string; onclose? }`.

- [ ] **Step 1: Write the failing controller test**

```ts
import { describe, expect, it } from 'vitest';
import { createController } from './controller';
import { DEFAULT_PREFS } from './prefs';
import type { PlayerSnapshot, PlayerSource } from './types';

function fakeSource() {
	let snapshot: PlayerSnapshot = {
		status: 'ready',
		position: 0,
		duration: 100,
		buffered: 0,
		rate: 1,
		volume: 1,
		muted: false,
		captions: false
	};
	const calls: string[] = [];
	const handlers = new Map<string, Set<(s: PlayerSnapshot) => void>>();
	const source: PlayerSource & {
		calls: string[];
		emitState(partial: Partial<PlayerSnapshot>): void;
	} = {
		calls,
		emitState(partial) {
			snapshot = { ...snapshot, ...partial };
			for (const h of handlers.get('state') ?? []) h(snapshot);
			for (const h of handlers.get('time') ?? []) h(snapshot);
		},
		load: async () => {},
		play: () => {
			calls.push('play');
			snapshot = { ...snapshot, status: 'playing' };
		},
		pause: () => {
			calls.push('pause');
			snapshot = { ...snapshot, status: 'paused' };
		},
		seek: (s) => {
			calls.push(`seek:${s}`);
			snapshot = { ...snapshot, position: s };
		},
		setRate: (r) => {
			calls.push(`rate:${r}`);
			snapshot = { ...snapshot, rate: r };
		},
		setVolume: (v) => {
			calls.push(`volume:${v}`);
			snapshot = { ...snapshot, volume: v };
		},
		setMuted: (m) => {
			calls.push(`muted:${m}`);
			snapshot = { ...snapshot, muted: m };
		},
		setCaptions: (c) => {
			calls.push(`captions:${c}`);
			snapshot = { ...snapshot, captions: c };
		},
		getState: () => snapshot,
		on: (event, handler) => {
			const set = handlers.get(event) ?? new Set();
			set.add(handler);
			handlers.set(event, set);
			return () => set.delete(handler);
		},
		capabilities: () => ({
			fullscreen: true,
			pip: false,
			captions: true,
			rates: [0.5, 1, 1.5, 2],
			boost: false,
			qualities: ['Auto']
		}),
		destroy: () => calls.push('destroy')
	};
	return source;
}

const storage = new Map<string, string>();
const fakeStorage = {
	getItem: (k: string) => storage.get(k) ?? null,
	setItem: (k: string, v: string) => void storage.set(k, v),
	removeItem: (k: string) => void storage.delete(k),
	key: () => null,
	length: 0,
	clear: () => storage.clear()
} as Storage;

describe('player controller', () => {
	it('toggles, skips within bounds, clamps rate and volume, and applies prefs to the source', () => {
		const source = fakeSource();
		const controller = createController(
			source,
			'abcdefghijk',
			{ ...DEFAULT_PREFS, speed: 1.5, volume: 0.5 },
			fakeStorage,
			() => 1000
		);
		controller.applyPrefs();
		expect(source.calls).toEqual(['rate:1.5', 'volume:0.5', 'muted:false', 'captions:false']);
		controller.toggle();
		expect(source.getState().status).toBe('playing');
		controller.skip(-30);
		expect(source.calls.at(-1)).toBe('seek:0');
		controller.seek(50);
		controller.skip(70);
		expect(source.calls.at(-1)).toBe('seek:100');
		controller.setRate(9);
		expect(source.getState().rate).toBe(2);
		controller.setVolume(-1);
		expect(source.getState().volume).toBe(0);
	});

	it('persists the position on demand and clears it near the end', () => {
		const source = fakeSource();
		const controller = createController(
			source,
			'abcdefghijk',
			DEFAULT_PREFS,
			fakeStorage,
			() => 5000
		);
		controller.seek(40);
		controller.persistPosition();
		expect(storage.get('player:pos:abcdefghijk')).toContain('"position":40');
		controller.seek(95);
		controller.persistPosition();
		expect(storage.has('player:pos:abcdefghijk')).toBe(false);
		controller.dispose();
		expect(source.calls.at(-1)).toBe('destroy');
	});
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `controller.ts`**

```ts
import type { PlayerPrefs } from './prefs';
import { SPEEDS } from './prefs';
import { clearResume, resumeOffer, writeResume } from './resume';
import type { PlayerSource } from './types';

export function createController(
	source: PlayerSource,
	videoKey: string,
	prefs: PlayerPrefs,
	storage: Storage | null,
	now: () => number
) {
	let current = prefs;
	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
	return {
		get state() {
			return source.getState();
		},
		applyPrefs(next: PlayerPrefs = current) {
			current = next;
			source.setRate(next.speed);
			source.setVolume(next.volume);
			source.setMuted(next.muted);
			source.setCaptions(next.captions);
		},
		toggle() {
			const { status } = source.getState();
			if (status === 'playing' || status === 'buffering') source.pause();
			else source.play();
		},
		skip(seconds: number) {
			const { position, duration } = source.getState();
			source.seek(clamp(position + seconds, 0, duration > 0 ? duration : Number.POSITIVE_INFINITY));
		},
		seek(seconds: number) {
			const { duration } = source.getState();
			source.seek(clamp(seconds, 0, duration > 0 ? duration : Number.POSITIVE_INFINITY));
		},
		setRate(rate: number) {
			const nearest = SPEEDS.reduce(
				(best, s) => (Math.abs(s - rate) < Math.abs(best - rate) ? s : best),
				1
			);
			source.setRate(clamp(nearest, 0.5, 2));
		},
		setVolume(level: number) {
			source.setVolume(clamp(level, 0, 1));
		},
		toggleMute() {
			source.setMuted(!source.getState().muted);
		},
		toggleCaptions() {
			source.setCaptions(!source.getState().captions);
		},
		persistPosition() {
			if (!current.resume) return;
			const { position, duration } = source.getState();
			if (resumeOffer(position, duration))
				writeResume(storage, videoKey, position, duration, now());
			else if (duration > 0) clearResume(storage, videoKey);
		},
		dispose() {
			source.destroy();
		}
	};
}
```

Run the controller test → PASS.

- [ ] **Step 4: Build `PlayerShell`** (`player-shell.svelte`): a kit `Dialog variant="fullscreen" label={`Trailer: ${title}`}`; on open: `pushState('', { ...page.state, player: { key: videoKey } })`, `prefs = loadPrefs(localStorage)`, `pruneResume`, `readResume` → `resume` chip; create `createYouTubeSource(videoKey)` and the controller; `source.load(stage, { autoplay: true, startAt: resume && prefs.resume ? resume.position : 0, captions: prefs.captions })` then `controller.applyPrefs()`; subscribe to `state`/`time`/`error`/`autoplayblocked` into `$state`snapshot; a`popstate`listener closes when`page.state.player`is gone; close →`persistPosition()`, `dispose()`, `history.back()`if we pushed. Layout:`.strip`(Close button`size="icon"`, eyebrow "Trailer", title), `.stage` (`aspect-ratio: 16/9; width: min(100%, calc((100dvh - 56px - 72px - var(--safe-top) - var(--safe-bottom)) * 16 / 9)); margin: auto; background: #000; position: relative`with the facade thumbnail layered until`status !== 'loading'`), `.apron`(controls in the brief's tab order using kit`Button size="icon" variant="ghost"`, the kit `Slider`for seek with`buffered`, `valueText={spokenTime}`, `onCommit={controller.seek}`; `role="timer"`clock`formatTime(position) / formatTime(duration)`; volume slider under `(hover: hover)`; CC `aria-pressed`; Speed button cycling `SPEEDS`; Settings opens `PlayerSettings`; Fullscreen on the stage wrapper when `document.fullscreenEnabled`). `role="status"`region text from the snapshot ("Playing", "Paused",`Speed 1.5×`, "Captions on", `Resumed at ${formatTime}`), `role="alert"` once on error with a "Watch on YouTube" link (`https://www.youtube.com/watch?v=<key>`, `rel="noopener"`). Keyboard: `onkeydown`on the dialog content root using`shouldHandleShortcut`/`matchShortcut`→ controller calls;`?`toggles`ShortcutHelp`(a centre`Dialog`listing`SHORTCUTS`). Auto-hide: `idle`counter via`setInterval(250)`while playing;`shouldHideControls({...})`→`class:hidden`on`.apron` (`opacity: 0; visibility: hidden`+`inert`), any pointermove/keydown resets idle. Resume writes every 5 s while playing and on pause/visibilitychange/pagehide/close. `data-oled`on the dialog when`prefs.oled` (pure black chrome). Reduced motion: no scale on open.

- [ ] **Step 5: Build `PlayerSettings`** (`player-settings.svelte`): a kit `Sheet` (`side` = 'bottom' below 768 px else 'right', `modal={false}`), `label="Player settings"`, vertical `Tabs` (`activation="manual"`) with items Video, Audio, Subtitles, Playback; rows as `fieldset`s of native radios (44 px rows), `role="switch"` buttons with `aria-checked`, disabled rows carry a one-line reason: Video → Quality (Auto, disabled "Set by YouTube"), Format (Fit; Fill/16:9/4:3/Zoom disabled "Not available for YouTube trailers"), OLED switch; Audio → Volume `Slider` 0–100, Boost `Slider` disabled "Needs a local file"; Subtitles → Captions switch, Size radios small/medium/large, Style/Position disabled; Playback → Speed radios from `capabilities.rates`, Resume switch, "Forget this position" (`clearResume`), "Forget all positions (N)" (`clearAllResume`, count via `listResume`), Keyboard shortcuts switch, Auto-hide delay radios 2/3/5 s. Every change updates `prefs` (`savePrefs`) and calls `controller.applyPrefs(prefs)`.

- [ ] **Step 6: Wire the detail page**: replace `openTrailer` with `let playerKey = $state<string | null>(null)`; "Play trailer" and the facades set it; render `<PlayerShell open={playerKey !== null} title={data.hero.title} videoKey={playerKey ?? ''} onclose={() => (playerKey = null)} />` only when `playerKey` is set. "Play trailer" shows `Resume · {formatTime(duration - position)} left` and a `ResumeBar` when `readResume` finds a qualifying position (read in an `$effect` on mount). Bottom tab bar hides under `html[data-player-open]`. `/kit` gets a "Player" section with a button that opens the shell on `dQw4w9WgXcQ`.

- [ ] **Step 7: Gates, screenshots, commit**

Run gates; preview; screenshots of the player open (390 portrait and 1440) and of the settings sheet; look at them.

```bash
git add src/lib/player src/lib/components/ui "src/routes/(cinema)"
git commit -m "feat(player): full-screen trailer player with controls, settings sheet, resume and shortcuts"
```

---

### Task 11: E2E, accessibility, responsive coverage

**Files:**

- Create: `tests/detail.e2e.ts`
- Modify: `tests/responsive.e2e.ts`, `tests/accessibility.e2e.ts` (add a detail URL discovered from Home: add a helper `firstMovieHref` to `tests/helpers.ts` and a `test.skip` when none)

`tests/detail.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { firstMovieHref, gotoHydrated } from './helpers';

test.describe('Movie detail', () => {
	test('renders the header, switches tabs by keyboard and hash, and shows FR providers', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, `${href}#details`);
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await page.getByRole('tab', { name: 'Overview' }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('tab', { name: 'Cast & crew' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page).toHaveURL(/#cast$/);
		await page.getByRole('tab', { name: 'Overview' }).click();
		await expect(page.getByRole('heading', { name: 'Where to watch' })).toBeVisible();
		await expect(page.getByText('Data by JustWatch')).toBeVisible();
	});

	test('opens the trailer player only on click, with exactly one youtube-nocookie iframe, and closes with Escape', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);
		const play = page.getByRole('button', { name: /Play trailer|Resume/ });
		test.skip(!(await play.count()), 'this film has no trailer');
		await expect(page.locator('iframe')).toHaveCount(0);
		await play.click();
		const dialog = page.getByRole('dialog', { name: /^Trailer: / });
		await expect(dialog).toBeVisible();
		await expect(page.locator('iframe')).toHaveCount(1);
		expect(await page.locator('iframe').getAttribute('src')).toContain(
			'https://www.youtube-nocookie.com/'
		);
		await expect(dialog.getByRole('button', { name: 'Settings' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(play).toBeFocused();
	});

	test('signed-out actions lead to login and the page fits 320 px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);
		await expect(page.getByRole('link', { name: 'Watchlist' })).toHaveAttribute(
			'href',
			/\/auth\/login\?returnTo=/
		);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(1);
	});
});
```

- [ ] **Step 1: Run the new spec RED** (before Tasks 8–10 land it fails; after them it must pass), then run all suites on the preview: `pnpm exec playwright test` → PASS. Screenshots at 390 and 1440 of header, each tab, player, settings; look at them; fix what looks wrong. Commit:

```bash
git add tests
git commit -m "test(e2e): movie detail header, tabs, providers, trailer player, 320px"
```

---

### Task 12: Documentation and project state

**Files:** `CHANGELOG.md` (Unreleased: Major — detail page and player; Security — CSP allowlist; Technical — helpers/tests), `ARCHITECTURE.md` (surfaces: `/movies/[id]` sections and the player; repository map: `src/lib/player`), `ROADMAP.md` (slice 4 `verified` with the exact gate output; next: Browse + search), `.agents/SESSION_STATE.md`.

- [ ] **Step 1: Update with the real gate results**, format, commit:

```bash
git add CHANGELOG.md ARCHITECTURE.md ROADMAP.md .agents/SESSION_STATE.md
git commit -m "docs: record the movie detail page and trailer player"
```
