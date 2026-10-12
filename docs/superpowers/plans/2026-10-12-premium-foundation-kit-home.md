# Premium foundation: data, UI kit, Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first three slices of the premium cinema experience: real local catalogue data (watch providers, title logos), the UI kit with its `/kit` showcase, and the new Home at `/` with top bar and mobile bottom tab bar.

**Architecture:** Pure helpers (`$lib/tmdb/images`, `$lib/format`, rail/carousel/navigation math) are unit-tested with Vitest; Svelte components under `src/lib/components/ui/<name>/` use CSS tokens from `src/app.css` only; pages compose kit components and own only layout CSS. Data stays local and bounded: the worker ingests TMDB watch providers and logos, the app reads PostgreSQL only.

**Tech Stack:** SvelteKit 2.70 / Svelte 5 runes, TypeScript strict, Drizzle ORM 0.45 + postgres-js, PGlite for tests, Vitest 4, Playwright 1.62, lucide-svelte icons, Tailwind v4 (tokens only).

**Spec:** `docs/superpowers/specs/2026-10-12-premium-cinema-experience-design.md`

## Global Constraints

- No third-party streaming mirror, ever; no `<iframe>` in this plan (the trailer facade belongs to the next plan). `src/lib/components/player/player-safety.test.ts` scans every source file and must stay green.
- Reads are local and bounded; the app never calls TMDB at request time. Only the worker calls TMDB.
- Every component uses tokens from `src/app.css`; no hard-coded colours in components.
- Transform/opacity-only motion, 120–360 ms, honours `prefers-reduced-motion` (global rule exists).
- Touch targets ≥ 44 px; focus visible; rails are `role="region"` with labels; `aria-current="page"` on active nav.
- Images: `aspect-ratio` reserved, `srcset`/`sizes`, lazy except the first hero image.
- No new runtime dependency.
- Gates before each commit: `pnpm check` (0 errors), `pnpm lint` (0 errors), `pnpm test:unit -- --run`, `pnpm --dir worker test` when the worker changes.
- Commit identity for this worktree: `GIT_AUTHOR_NAME="Théo Person" GIT_AUTHOR_EMAIL="theo.person@youkyi.net"` (and the same `GIT_COMMITTER_*`).

## Review Focus

1. A movie with `backdropPath` null must never be chosen for the hero and the carousel must render with 0, 1 or 5 items without errors → Task 10 tests `getFeaturedMovies` and Task 7 tests `nextIndex` with `count = 0/1`.
2. A poster path that is an absolute URL (legacy custom rows) must not be prefixed with the TMDB base → Task 4 tests `tmdbImageUrl('https://…')`.
3. TMDB `watch/providers` may omit a region or a kind entirely, or send providers without `logo_path` → Task 2 tests those shapes.
4. The bottom tab bar must mark exactly one tab active on nested routes (`/movies/abc` → Movies, `/` only on the root) → Task 8 tests `isActivePath`.
5. Rail arrow at the end of the scroller must clamp, never scroll past the content → Task 6 tests `railScrollTarget` at both ends.

---

### Task 1: `movie_watch_providers` table and migration 0005

**Files:**

- Modify: `src/lib/server/db/schema.ts` (after the `movieVideos` table and in the relations block)
- Create: `drizzle/0005_movie_watch_providers.sql` (generated, then edited)
- Modify: `drizzle/meta/_journal.json`, create `drizzle/meta/0005_snapshot.json` (generated)
- Test: `src/lib/server/db/migrations.test.ts`

**Interfaces:**

- Produces: `movieWatchProviders` table (`movie_watch_providers`) with columns `id`, `movieId`, `region` (2 chars), `kind` (`flatrate|free|ads|rent|buy`), `providerId`, `providerName`, `logoPath`, `displayPriority`, `link`, `syncedAt`; relation `movies.watchProviders`.

- [ ] **Step 1: Write the failing migration test**

Append to `src/lib/server/db/migrations.test.ts` inside the `describe('Drizzle migration chain')` block:

```ts
it('adds watch providers additively and is safe to re-run', async () => {
	database = new PGlite();
	for (const name of [
		'0000_aromatic_puma.sql',
		'0001_next_impossible_man.sql',
		'0002_wet_masque.sql',
		'0003_complete_skrulls.sql',
		'0004_movie_picker_imdb.sql'
	]) {
		await database.exec(await migration(name));
	}
	const providers = await migration('0005_movie_watch_providers.sql');

	await database.exec(providers);
	await database.exec(providers);

	await database.exec(`
			insert into movies (id, tmdb_id, title)
			values ('00000000-0000-4000-8000-000000000101', 101, 'Standard Film');
			insert into movie_watch_providers (movie_id, region, kind, provider_id, provider_name)
			values ('00000000-0000-4000-8000-000000000101', 'FR', 'flatrate', 8, 'Netflix');
		`);
	await expect(
		database.exec(`
				insert into movie_watch_providers (movie_id, region, kind, provider_id, provider_name)
				values ('00000000-0000-4000-8000-000000000101', 'FR', 'flatrate', 8, 'Netflix');
			`)
	).rejects.toThrow(/duplicate key/u);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/server/db/migrations.test.ts`
Expected: FAIL with `ENOENT … 0005_movie_watch_providers.sql`.

- [ ] **Step 3: Add the table and relations to the schema**

In `src/lib/server/db/schema.ts`, right after the `movieVideos` table definition:

```ts
export const WATCH_PROVIDER_KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
export type WatchProviderKind = (typeof WATCH_PROVIDER_KINDS)[number];

// Where a title can be watched legally, per region, from TMDB's JustWatch feed.
export const movieWatchProviders = pgTable(
	'movie_watch_providers',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		region: varchar('region', { length: 2 }).notNull(),
		kind: varchar('kind', { length: 10 }).notNull(),
		providerId: integer('provider_id').notNull(),
		providerName: varchar('provider_name', { length: 200 }).notNull(),
		logoPath: varchar('logo_path', { length: 255 }),
		displayPriority: integer('display_priority').default(0).notNull(),
		link: text('link'),
		syncedAt: timestamp('synced_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_movie_watch_providers_movie').on(table.movieId),
		uniqueIndex('idx_movie_watch_providers_unique').on(
			table.movieId,
			table.region,
			table.kind,
			table.providerId
		)
	]
);
```

In the relations block, add `watchProviders: many(movieWatchProviders),` inside `moviesRelations` (find `export const moviesRelations = relations(movies, ({ one, many }) => ({`), and after `movieVideosRelations` add:

```ts
export const movieWatchProvidersRelations = relations(movieWatchProviders, ({ one }) => ({
	movie: one(movies, { fields: [movieWatchProviders.movieId], references: [movies.id] })
}));
```

- [ ] **Step 4: Generate the migration and make it re-runnable**

Run: `DATABASE_URL="postgres://placeholder:placeholder@localhost:5432/placeholder" pnpm exec drizzle-kit generate --name movie_watch_providers`

Then edit `drizzle/0005_movie_watch_providers.sql` so every statement is idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and wrap the foreign key in a `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block. Expected final file:

```sql
CREATE TABLE IF NOT EXISTS "movie_watch_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"region" varchar(2) NOT NULL,
	"kind" varchar(10) NOT NULL,
	"provider_id" integer NOT NULL,
	"provider_name" varchar(200) NOT NULL,
	"logo_path" varchar(255),
	"display_priority" integer DEFAULT 0 NOT NULL,
	"link" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_watch_providers" ADD CONSTRAINT "movie_watch_providers_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_watch_providers_movie" ON "movie_watch_providers" USING btree ("movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_watch_providers_unique" ON "movie_watch_providers" USING btree ("movie_id","region","kind","provider_id");
```

- [ ] **Step 5: Run the migration tests and the whole unit suite**

Run: `pnpm exec vitest run src/lib/server/db` then `pnpm test:unit -- --run`
Expected: PASS (the shared `createMigratedTestDatabase()` applies every `.sql` in `drizzle/`, so every DB-backed test now includes 0005).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle src/lib/server/db/migrations.test.ts
git commit -m "feat(db): additive movie_watch_providers table (migration 0005)"
```

---

### Task 2: Worker enrichment: watch providers and title logo selection

**Files:**

- Create: `worker/src/tmdb/enrichment.ts`
- Create: `worker/src/tmdb/enrichment.test.ts`
- Modify: `worker/src/tmdb/client.ts` (types and `getMovieDetails`)
- Modify: `worker/src/tmdb/ingest-movies.ts` (after step "7. Ingest Videos")

**Interfaces:**

- Produces: `selectWatchProviderRows(results, regions?)` → `WatchProviderRow[]`; `selectLogoPath(logos)` → `string | null`; `TMDBMovieDetail['watch/providers']` and `TMDBMovieDetail.images` types.
- Consumes: Task 1 `schema.movieWatchProviders`.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/tmdb/enrichment.test.ts` (the worker runs `tsx --test`, so use `node:test`):

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectLogoPath, selectWatchProviderRows } from './enrichment.js';

const netflix = {
	provider_id: 8,
	provider_name: 'Netflix',
	logo_path: '/n.jpg',
	display_priority: 1
};
const canal = { provider_id: 381, provider_name: 'Canal+', logo_path: null, display_priority: 3 };
const apple = {
	provider_id: 2,
	provider_name: 'Apple TV',
	logo_path: '/a.jpg',
	display_priority: 2
};

describe('selectWatchProviderRows', () => {
	it('flattens the configured regions and kinds, keeping the region link', () => {
		const rows = selectWatchProviderRows({
			FR: {
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR',
				flatrate: [netflix],
				rent: [apple]
			},
			US: { link: 'https://www.themoviedb.org/movie/1/watch?locale=US', buy: [apple] },
			DE: { link: 'x', flatrate: [netflix] }
		});

		assert.deepEqual(rows, [
			{
				region: 'FR',
				kind: 'flatrate',
				providerId: 8,
				providerName: 'Netflix',
				logoPath: '/n.jpg',
				displayPriority: 1,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR'
			},
			{
				region: 'FR',
				kind: 'rent',
				providerId: 2,
				providerName: 'Apple TV',
				logoPath: '/a.jpg',
				displayPriority: 2,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=FR'
			},
			{
				region: 'US',
				kind: 'buy',
				providerId: 2,
				providerName: 'Apple TV',
				logoPath: '/a.jpg',
				displayPriority: 2,
				link: 'https://www.themoviedb.org/movie/1/watch?locale=US'
			}
		]);
	});

	it('tolerates missing regions, missing kinds and providers without a logo', () => {
		assert.deepEqual(selectWatchProviderRows(undefined), []);
		assert.deepEqual(selectWatchProviderRows({}), []);
		const rows = selectWatchProviderRows({ FR: { link: 'l', flatrate: [canal] } });
		assert.equal(rows[0].logoPath, null);
		assert.equal(rows[0].displayPriority, 3);
	});

	it('drops malformed providers instead of throwing', () => {
		const rows = selectWatchProviderRows({
			FR: { link: 'l', flatrate: [{ provider_id: 'x', provider_name: 'Bad' } as never, netflix] }
		});
		assert.equal(rows.length, 1);
		assert.equal(rows[0].providerId, 8);
	});
});

describe('selectLogoPath', () => {
	it('prefers an English or language-neutral PNG with the best vote', () => {
		const path = selectLogoPath([
			{ file_path: '/fr.png', iso_639_1: 'fr', vote_average: 9 },
			{ file_path: '/en-low.png', iso_639_1: 'en', vote_average: 3 },
			{ file_path: '/neutral.png', iso_639_1: null, vote_average: 5 },
			{ file_path: '/en.svg', iso_639_1: 'en', vote_average: 8 }
		]);
		assert.equal(path, '/neutral.png');
	});

	it('returns null when there is no usable logo', () => {
		assert.equal(selectLogoPath(undefined), null);
		assert.equal(selectLogoPath([]), null);
		assert.equal(
			selectLogoPath([{ file_path: '/de.png', iso_639_1: 'de', vote_average: 9 }]),
			null
		);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --dir worker test`
Expected: FAIL, `Cannot find module './enrichment.js'`.

- [ ] **Step 3: Implement the pure selection helpers**

Create `worker/src/tmdb/enrichment.ts`:

```ts
// Pure selection logic for optional TMDB enrichment data. Kept free of I/O so the
// worker's safety tests can pin every input shape TMDB is known to send.

export const WATCH_PROVIDER_REGIONS = ['FR', 'US'] as const;
export const WATCH_PROVIDER_KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
export type WatchProviderKind = (typeof WATCH_PROVIDER_KINDS)[number];

export interface TMDBWatchProvider {
	provider_id: number;
	provider_name: string;
	logo_path?: string | null;
	display_priority?: number;
}

export type TMDBWatchProviderRegion = { link?: string } & Partial<
	Record<WatchProviderKind, TMDBWatchProvider[]>
>;

export interface TMDBLogo {
	file_path: string;
	iso_639_1: string | null;
	vote_average?: number;
}

export interface WatchProviderRow {
	region: string;
	kind: WatchProviderKind;
	providerId: number;
	providerName: string;
	logoPath: string | null;
	displayPriority: number;
	link: string | null;
}

export function selectWatchProviderRows(
	results: Record<string, TMDBWatchProviderRegion> | undefined,
	regions: readonly string[] = WATCH_PROVIDER_REGIONS
): WatchProviderRow[] {
	if (!results) return [];
	const rows: WatchProviderRow[] = [];

	for (const region of regions) {
		const entry = results[region];
		if (!entry) continue;
		const link = typeof entry.link === 'string' ? entry.link : null;

		for (const kind of WATCH_PROVIDER_KINDS) {
			for (const provider of entry[kind] ?? []) {
				if (
					!Number.isInteger(provider?.provider_id) ||
					typeof provider.provider_name !== 'string'
				) {
					continue;
				}
				rows.push({
					region,
					kind,
					providerId: provider.provider_id,
					providerName: provider.provider_name,
					logoPath: typeof provider.logo_path === 'string' ? provider.logo_path : null,
					displayPriority: Number.isInteger(provider.display_priority)
						? (provider.display_priority as number)
						: 0,
					link
				});
			}
		}
	}

	return rows;
}

// Hero titles use a PNG logo in English or language-neutral; SVGs are skipped
// because TMDB serves them inconsistently and they cannot be sized by `srcset`.
export function selectLogoPath(logos: TMDBLogo[] | undefined): string | null {
	if (!logos) return null;
	const usable = logos.filter(
		(logo) =>
			typeof logo.file_path === 'string' &&
			logo.file_path.endsWith('.png') &&
			(logo.iso_639_1 === 'en' || logo.iso_639_1 === null)
	);
	usable.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
	return usable[0]?.file_path ?? null;
}
```

- [ ] **Step 4: Run the worker tests**

Run: `pnpm --dir worker test`
Expected: PASS (11 existing + 5 new).

- [ ] **Step 5: Extend the TMDB client types and request**

In `worker/src/tmdb/client.ts`, add to the `TMDBMovieDetail` interface after `videos?: {…};`:

```ts
	'watch/providers'?: {
		results: Record<string, import('./enrichment.js').TMDBWatchProviderRegion>;
	};
	images?: {
		logos: import('./enrichment.js').TMDBLogo[];
	};
```

Change `getMovieDetails`:

```ts
	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
		return this.request<TMDBMovieDetail>(`/movie/${tmdbId}`, {
			append_to_response: 'credits,keywords,videos,watch/providers,images',
			include_image_language: 'en,null'
		});
	}
```

- [ ] **Step 6: Write providers and the logo inside the ingest transaction**

In `worker/src/tmdb/ingest-movies.ts`, import the helpers at the top:

```ts
import { selectLogoPath, selectWatchProviderRows } from './enrichment.js';
```

After the `// 7. Ingest Videos (bulk)` block and before `return movieRowId;`:

```ts
// 8. Watch providers: replace the movie's rows so removed offers disappear.
const providerRows = selectWatchProviderRows(detail['watch/providers']?.results);
await tx
	.delete(schema.movieWatchProviders)
	.where(eq(schema.movieWatchProviders.movieId, movieRowId));
if (providerRows.length > 0) {
	await tx
		.insert(schema.movieWatchProviders)
		.values(providerRows.map((row) => ({ movieId: movieRowId, ...row })))
		.onConflictDoNothing();
}

// 9. Title logo for the hero, stored in metadata (no schema change).
const logoPath = selectLogoPath(detail.images?.logos);
if (logoPath) {
	await tx
		.update(schema.movies)
		.set({
			metadata: sql`coalesce(${schema.movies.metadata}, '{}'::jsonb) || ${JSON.stringify({ logoPath })}::jsonb`
		})
		.where(eq(schema.movies.id, movieRowId));
}
```

- [ ] **Step 7: Build and test the worker, then commit**

Run: `pnpm --dir worker build && pnpm --dir worker test && pnpm check`
Expected: all PASS, 0 type errors.

```bash
git add worker/src/tmdb/enrichment.ts worker/src/tmdb/enrichment.test.ts worker/src/tmdb/client.ts worker/src/tmdb/ingest-movies.ts
git commit -m "feat(worker): ingest TMDB watch providers (FR, US) and title logos"
```

---

### Task 3: Worker `sync-top-rated` command and a real local catalogue

**Files:**

- Modify: `worker/src/cli.ts` (`validCommands`, help text, command branch)
- Modify: `worker/package.json` (script `ingest:top-rated`)
- Modify: `docs/MISE_EN_LIGNE_NETLIFY.md` (mention the new command next to `ingest:popular`)

**Interfaces:**

- Produces: CLI command `sync-top-rated` (5 pages of `/movie/top_rated`).

- [ ] **Step 1: Extend the CLI**

In `worker/src/cli.ts`:

```ts
const validCommands = new Set([
	'sync-genres',
	'setup-search',
	'sync-popular',
	'sync-top-rated',
	'ingest-id'
]);
```

Help text gains `  sync-top-rated  Fetch top 5 pages of top-rated movies from TMDB`. After the `sync-popular` branch:

```ts
	} else if (command === 'sync-top-rated') {
		await syncGenres();
		console.log('🏆 Fetching top-rated movies from TMDB...');
		const client = new TMDBClient();
		for (let page = 1; page <= 5; page++) {
			console.log(`\n--- Fetching Page ${page} ---`);
			const res = await client.getTopRatedMovies(page);
			for (const m of res.results) {
				await ingestMovie(m.id);
			}
		}
```

In `worker/package.json` scripts add `"ingest:top-rated": "tsx src/cli.ts sync-top-rated",`.

- [ ] **Step 2: Verify the CLI guard still runs before any database work**

Run: `pnpm --dir worker test`
Expected: PASS (the `worker cli validates commands` test reads the source order).

- [ ] **Step 3: Build a real local catalogue (owner's machine only)**

Scratch directory: `C:\Users\theop\AppData\Local\Temp\claude\…\scratchpad\real-db` (reuse the `demo-db` node_modules by copying `package.json` and running `npm install` there). Create `empty.mjs` that applies every `drizzle/*.sql` to a fresh PGlite at `./data`, then serve it:

```text
node node_modules/@electric-sql/pglite-socket/dist/scripts/server.js --db=./data --port=5433 --max-connections=10
```

Put the TMDB key in the repo's git-ignored `.env` as `TMDB_API_KEY=…` (the key already lives in the repository's Git history; it is the owner's). Then, from the repo root, with the app server stopped:

```text
WORKER_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/postgres" pnpm --dir worker ingest:popular
WORKER_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5433/postgres" pnpm --dir worker ingest:top-rated
```

Expected: ~180 movies with posters, backdrops, cast, trailers, providers. Verify:

```text
select count(*) from movies; select count(*) from movie_watch_providers where region = 'FR'; select count(*) from movies where metadata ? 'logoPath';
```

If the PGlite socket multiplexer rejects the worker's transactions, install `embedded-postgres` in the scratch directory and serve a real PostgreSQL on 5433 instead; the commands above are unchanged.

- [ ] **Step 4: Document and commit**

In `docs/MISE_EN_LIGNE_NETLIFY.md`, next to `ingest:popular`, add `pnpm --dir worker ingest:top-rated` ("les mieux notés").

```bash
git add worker/src/cli.ts worker/package.json docs/MISE_EN_LIGNE_NETLIFY.md
git commit -m "feat(worker): sync-top-rated command"
```

---

### Task 4: Client-safe TMDB image helpers

**Files:**

- Create: `src/lib/tmdb/images.ts`
- Test: `src/lib/tmdb/images.test.ts`

**Interfaces:**

- Produces: `tmdbImageUrl(path, size)`, `posterSrcSet(path)`, `backdropSrcSet(path)`, `logoSrcSet(path)`, `profileImageUrl(path)`, `isYouTubeKey(key)`, `youtubeThumbnail(key)`; type `ResponsiveImage = { src: string; srcset: string; placeholder: string }`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
	backdropSrcSet,
	isYouTubeKey,
	logoSrcSet,
	posterSrcSet,
	profileImageUrl,
	tmdbImageUrl,
	youtubeThumbnail
} from './images';

describe('tmdbImageUrl', () => {
	it('builds a CDN URL for a TMDB path, with or without the leading slash', () => {
		expect(tmdbImageUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
		expect(tmdbImageUrl('abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
	});

	it('passes absolute URLs through untouched and returns null for nothing', () => {
		expect(tmdbImageUrl('https://cdn.example/poster.jpg', 'w342')).toBe(
			'https://cdn.example/poster.jpg'
		);
		expect(tmdbImageUrl(null, 'w342')).toBeNull();
		expect(tmdbImageUrl('', 'w342')).toBeNull();
		expect(tmdbImageUrl('null', 'w342')).toBeNull();
	});
});

describe('responsive sets', () => {
	it('produces poster candidates from w185 to w780 with a w92 placeholder', () => {
		const image = posterSrcSet('/p.jpg');
		expect(image?.src).toBe('https://image.tmdb.org/t/p/w342/p.jpg');
		expect(image?.srcset).toBe(
			'https://image.tmdb.org/t/p/w185/p.jpg 185w, https://image.tmdb.org/t/p/w342/p.jpg 342w, https://image.tmdb.org/t/p/w500/p.jpg 500w, https://image.tmdb.org/t/p/w780/p.jpg 780w'
		);
		expect(image?.placeholder).toBe('https://image.tmdb.org/t/p/w92/p.jpg');
	});

	it('produces backdrop and logo candidates', () => {
		expect(backdropSrcSet('/b.jpg')?.srcset).toBe(
			'https://image.tmdb.org/t/p/w780/b.jpg 780w, https://image.tmdb.org/t/p/w1280/b.jpg 1280w, https://image.tmdb.org/t/p/original/b.jpg 3840w'
		);
		expect(backdropSrcSet('/b.jpg')?.placeholder).toBe('https://image.tmdb.org/t/p/w300/b.jpg');
		expect(logoSrcSet('/l.png')?.srcset).toBe(
			'https://image.tmdb.org/t/p/w300/l.png 300w, https://image.tmdb.org/t/p/w500/l.png 500w'
		);
		expect(profileImageUrl('/f.jpg')).toBe('https://image.tmdb.org/t/p/w185/f.jpg');
	});

	it('returns null sets for missing paths', () => {
		expect(posterSrcSet(null)).toBeNull();
		expect(backdropSrcSet(undefined)).toBeNull();
	});

	it('does not build sets for absolute URLs (no size variants exist)', () => {
		const image = posterSrcSet('https://cdn.example/p.jpg');
		expect(image).toEqual({
			src: 'https://cdn.example/p.jpg',
			srcset: '',
			placeholder: 'https://cdn.example/p.jpg'
		});
	});
});

describe('YouTube helpers', () => {
	it('accepts only 11-character video ids', () => {
		expect(isYouTubeKey('dQw4w9WgXcQ')).toBe(true);
		expect(isYouTubeKey('dQw4w9WgXc')).toBe(false);
		expect(isYouTubeKey('dQw4w9WgXcQ"><script>')).toBe(false);
		expect(isYouTubeKey(null)).toBe(false);
	});

	it('builds a thumbnail only for a valid id', () => {
		expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
		);
		expect(youtubeThumbnail('bad')).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/tmdb/images.test.ts`
Expected: FAIL, cannot find module `./images`.

- [ ] **Step 3: Implement**

```ts
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface ResponsiveImage {
	src: string;
	srcset: string;
	placeholder: string;
}

function isAbsolute(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://');
}

function normalizePath(path: string | null | undefined): string | null {
	if (typeof path !== 'string') return null;
	const trimmed = path.trim();
	if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
	return trimmed;
}

export function tmdbImageUrl(path: string | null | undefined, size: string): string | null {
	const normalized = normalizePath(path);
	if (!normalized) return null;
	if (isAbsolute(normalized)) return normalized;
	return `${TMDB_IMAGE_BASE}/${size}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

function responsiveSet(
	path: string | null | undefined,
	candidates: Array<[size: string, width: number]>,
	defaultSize: string,
	placeholderSize: string
): ResponsiveImage | null {
	const normalized = normalizePath(path);
	if (!normalized) return null;
	if (isAbsolute(normalized)) return { src: normalized, srcset: '', placeholder: normalized };

	return {
		src: tmdbImageUrl(normalized, defaultSize) as string,
		srcset: candidates
			.map(([size, width]) => `${tmdbImageUrl(normalized, size)} ${width}w`)
			.join(', '),
		placeholder: tmdbImageUrl(normalized, placeholderSize) as string
	};
}

export function posterSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w185', 185],
			['w342', 342],
			['w500', 500],
			['w780', 780]
		],
		'w342',
		'w92'
	);
}

export function backdropSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w780', 780],
			['w1280', 1280],
			['original', 3840]
		],
		'w1280',
		'w300'
	);
}

export function logoSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w300', 300],
			['w500', 500]
		],
		'w500',
		'w300'
	);
}

export function profileImageUrl(path: string | null | undefined): string | null {
	return tmdbImageUrl(path, 'w185');
}

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/u;

export function isYouTubeKey(key: unknown): key is string {
	return typeof key === 'string' && YOUTUBE_KEY.test(key);
}

export function youtubeThumbnail(key: unknown): string | null {
	return isYouTubeKey(key) ? `https://i.ytimg.com/vi/${key}/hqdefault.jpg` : null;
}
```

- [ ] **Step 4: Run tests, then commit**

Run: `pnpm exec vitest run src/lib/tmdb/images.test.ts` → PASS.

```bash
git add src/lib/tmdb
git commit -m "feat(ui): client-safe TMDB image and YouTube helpers"
```

---

### Task 5: Formatters

**Files:**

- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**

- Produces: `formatRuntime(minutes)`, `formatYear(date)`, `formatRating(value)`, `formatVotes(count)`, `formatMoney(amount)`, `formatDate(date)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
	formatDate,
	formatMoney,
	formatRating,
	formatRuntime,
	formatVotes,
	formatYear
} from './format';

describe('formatters', () => {
	it('formats runtime as hours and minutes', () => {
		expect(formatRuntime(110)).toBe('1h 50m');
		expect(formatRuntime(60)).toBe('1h');
		expect(formatRuntime(45)).toBe('45m');
		expect(formatRuntime(0)).toBeNull();
		expect(formatRuntime(null)).toBeNull();
		expect(formatRuntime('95')).toBe('1h 35m');
	});

	it('extracts a year from an ISO date and rejects garbage', () => {
		expect(formatYear('2001-05-05')).toBe('2001');
		expect(formatYear('2001')).toBe('2001');
		expect(formatYear('not a date')).toBeNull();
		expect(formatYear(null)).toBeNull();
	});

	it('formats ratings with one decimal and hides zero', () => {
		expect(formatRating(7.823)).toBe('7.8');
		expect(formatRating('8.00')).toBe('8.0');
		expect(formatRating(0)).toBeNull();
		expect(formatRating(null)).toBeNull();
	});

	it('compacts vote counts', () => {
		expect(formatVotes(950)).toBe('950');
		expect(formatVotes(12345)).toBe('12K');
		expect(formatVotes(2_300_000)).toBe('2.3M');
		expect(formatVotes(null)).toBeNull();
	});

	it('formats money in short dollars and hides zero', () => {
		expect(formatMoney(165_000_000)).toBe('$165M');
		expect(formatMoney(2_500_000_000)).toBe('$2.5B');
		expect(formatMoney(850_000)).toBe('$850K');
		expect(formatMoney(0)).toBeNull();
	});

	it('formats a long date in English', () => {
		expect(formatDate('2001-05-05')).toBe('5 May 2001');
		expect(formatDate('bad')).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/format.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
function toNumber(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function formatRuntime(minutes: unknown): string | null {
	const total = toNumber(minutes);
	if (total === null || total <= 0) return null;
	const whole = Math.round(total);
	const hours = Math.floor(whole / 60);
	const rest = whole % 60;
	if (hours === 0) return `${rest}m`;
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatYear(date: unknown): string | null {
	if (typeof date !== 'string') return null;
	const match = /^(\d{4})/u.exec(date.trim());
	return match ? match[1] : null;
}

export function formatRating(value: unknown): string | null {
	const rating = toNumber(value);
	if (rating === null || rating <= 0) return null;
	return rating.toFixed(1);
}

function compact(value: number, suffixes: Array<[number, string]>): string {
	for (const [threshold, suffix] of suffixes) {
		if (value >= threshold) {
			const scaled = value / threshold;
			const text =
				scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/u, '');
			return `${text}${suffix}`;
		}
	}
	return Math.round(value).toString();
}

export function formatVotes(count: unknown): string | null {
	const votes = toNumber(count);
	if (votes === null || votes <= 0) return null;
	return compact(votes, [
		[1_000_000, 'M'],
		[1_000, 'K']
	]);
}

export function formatMoney(amount: unknown): string | null {
	const money = toNumber(amount);
	if (money === null || money <= 0) return null;
	return `$${compact(money, [
		[1_000_000_000, 'B'],
		[1_000_000, 'M'],
		[1_000, 'K']
	])}`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

export function formatDate(date: unknown): string | null {
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/u.test(date)) return null;
	const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
	return Number.isNaN(parsed.getTime()) ? null : LONG_DATE.format(parsed);
}
```

- [ ] **Step 4: Run tests, then commit**

Run: `pnpm exec vitest run src/lib/format.test.ts` → PASS.

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(ui): shared formatters for runtime, dates, ratings, money"
```

---

### Task 6: Tokens and kit primitives (Button, Chip, RatingBadge, MetaChips, Section, Rail)

**Files:**

- Modify: `src/app.css` (token additions inside `:root`), `src/app.html` (`viewport-fit=cover`)
- Modify: `src/lib/components/ui/button/button.svelte`, `src/lib/components/ui/button/index.ts`
- Create: `src/lib/components/ui/chip/chip.svelte`, `src/lib/components/ui/chip/index.ts`
- Create: `src/lib/components/ui/rating-badge/rating-badge.svelte` + `index.ts`
- Create: `src/lib/components/ui/meta-chips/meta-chips.svelte` + `index.ts`
- Create: `src/lib/components/ui/section/section.svelte` + `index.ts`
- Create: `src/lib/components/ui/rail/rail.svelte`, `src/lib/components/ui/rail/scroll.ts`, `src/lib/components/ui/rail/index.ts`
- Test: `src/lib/components/ui/rail/scroll.test.ts`
- Modify: every importer of `$lib/components/ui/Button.svelte` (find with `git grep -l "ui/Button.svelte" src`), then delete `src/lib/components/ui/Button.svelte`

**Interfaces:**

- Produces: `Button` props `{ variant?: 'primary'|'secondary'|'ghost'|'outline'|'danger'; size?: 'sm'|'md'|'lg'|'icon'; href?; loading?; disabled?; type?; class?; children }`; `Chip` props `{ selected?; href?; onclick?; onremove?; children; class? }`; `RatingBadge` `{ value: string; source?: string }`; `MetaChips` `{ items: Array<string | null | undefined> }`; `Section` `{ title: string; eyebrow?; seeAllHref?; seeAllLabel?; id?; children }`; `Rail` `{ label: string; children; class? }`; `railScrollTarget(scrollLeft, clientWidth, scrollWidth, direction)`.

- [ ] **Step 1: Write the failing rail math test**

`src/lib/components/ui/rail/scroll.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { railScrollTarget } from './scroll';

describe('railScrollTarget', () => {
	it('moves by 90% of the viewport in the requested direction', () => {
		expect(railScrollTarget(0, 1000, 5000, 1)).toBe(900);
		expect(railScrollTarget(1800, 1000, 5000, -1)).toBe(900);
	});

	it('clamps at both ends', () => {
		expect(railScrollTarget(3800, 1000, 5000, 1)).toBe(4000);
		expect(railScrollTarget(100, 1000, 5000, -1)).toBe(0);
	});

	it('never goes negative when content fits', () => {
		expect(railScrollTarget(0, 1000, 800, 1)).toBe(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/components/ui/rail/scroll.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement the rail math**

`src/lib/components/ui/rail/scroll.ts`:

```ts
export function railScrollTarget(
	scrollLeft: number,
	clientWidth: number,
	scrollWidth: number,
	direction: 1 | -1
): number {
	const maximum = Math.max(0, scrollWidth - clientWidth);
	const target = scrollLeft + direction * clientWidth * 0.9;
	return Math.min(maximum, Math.max(0, Math.round(target)));
}
```

Run the test → PASS.

- [ ] **Step 4: Add tokens**

In `src/app.css`, inside `:root` after the `/* Transitions */` block:

```css
/* Type scale (fluid) */
--type-display: clamp(2.25rem, 1.2rem + 4.5vw, 4.5rem);
--type-headline: clamp(1.5rem, 1.1rem + 1.6vw, 2.25rem);
--type-title: clamp(1.125rem, 1rem + 0.5vw, 1.375rem);
--type-body: 1rem;
--type-label: 0.8125rem;
--tracking-tight: -0.02em;
--tracking-wide: 0.08em;

/* Elevation */
--elevation-1: 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
--elevation-2: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06);
--elevation-3: 0 30px 80px -20px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);

/* Motion */
--duration-fast: 120ms;
--duration-base: 200ms;
--duration-slow: 360ms;
--ease-out: cubic-bezier(0.2, 0, 0, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Layering */
--z-rail-controls: 2;
--z-bar: 40;
--z-sheet: 60;
--z-toast: 70;
--z-palette: 80;

/* Device safe areas and chrome */
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
--top-bar-height: 3.75rem;
--bottom-bar-height: 3.5rem;
```

In `src/app.html` change the viewport meta to `content="width=device-width, initial-scale=1, viewport-fit=cover"`.

- [ ] **Step 5: Rewrite the Button on tokens**

Replace `src/lib/components/ui/button/button.svelte` entirely:

```svelte
<script lang="ts" module>
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
	export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

	export type ButtonProps = Omit<HTMLButtonAttributes, 'type'> &
		Omit<HTMLAnchorAttributes, 'type'> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			href?: string;
			loading?: boolean;
			disabled?: boolean;
			type?: 'button' | 'submit' | 'reset';
			class?: string;
			children?: Snippet;
		};
</script>

<script lang="ts">
	let {
		variant = 'primary',
		size = 'md',
		href = undefined,
		loading = false,
		disabled = false,
		type = 'button',
		class: className = '',
		children,
		...rest
	}: ButtonProps = $props();

	const inactive = $derived(disabled || loading);
</script>

{#if href}
	<a
		class="btn {variant} {size} {className}"
		href={inactive ? undefined : href}
		aria-disabled={inactive ? 'true' : undefined}
		tabindex={inactive ? -1 : undefined}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		class="btn {variant} {size} {className}"
		{type}
		disabled={inactive}
		aria-busy={loading ? 'true' : undefined}
		{...rest}
	>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		{@render children?.()}
	</button>
{/if}

<style>
	.btn {
		--btn-bg: var(--brand-primary);
		--btn-fg: var(--content-inverse);
		--btn-border: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		padding: 0 1.25rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--btn-border);
		background: var(--btn-bg);
		color: var(--btn-fg);
		font-weight: 700;
		font-size: var(--text-sm);
		letter-spacing: 0.01em;
		white-space: nowrap;
		transition:
			transform var(--duration-fast) var(--ease-out),
			background-color var(--duration-base) var(--ease-out),
			border-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out);
	}
	.btn:hover {
		transform: translateY(-1px);
	}
	.btn:active {
		transform: scale(0.97);
	}
	.btn[disabled],
	.btn[aria-disabled='true'] {
		opacity: 0.55;
		transform: none;
		pointer-events: none;
	}
	.primary:hover {
		--btn-bg: var(--brand-hover);
	}
	.secondary {
		--btn-bg: rgba(255, 255, 255, 0.12);
		--btn-fg: var(--content-primary);
	}
	.secondary:hover {
		--btn-bg: rgba(255, 255, 255, 0.18);
	}
	.ghost {
		--btn-bg: transparent;
		--btn-fg: var(--content-primary);
	}
	.ghost:hover {
		--btn-bg: rgba(255, 255, 255, 0.08);
	}
	.outline {
		--btn-bg: transparent;
		--btn-fg: var(--content-primary);
		--btn-border: var(--border-strong);
	}
	.outline:hover {
		--btn-border: var(--content-primary);
	}
	.danger {
		--btn-bg: rgba(251, 113, 133, 0.16);
		--btn-fg: var(--color-error);
	}
	.danger:hover {
		--btn-bg: rgba(251, 113, 133, 0.26);
	}
	.sm {
		min-height: 2.25rem;
		padding-inline: 0.875rem;
		font-size: var(--text-xs);
	}
	.lg {
		min-height: 3.25rem;
		padding-inline: 1.75rem;
		font-size: var(--text-md);
	}
	.icon {
		width: var(--touch-target);
		padding: 0;
	}
	.spinner {
		width: 1em;
		height: 1em;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
```

Replace `src/lib/components/ui/button/index.ts`:

```ts
import Button, { type ButtonProps, type ButtonSize, type ButtonVariant } from './button.svelte';

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant };
export default Button;
```

Then migrate every importer of the legacy `$lib/components/ui/Button.svelte` (`git grep -n "ui/Button.svelte" src`) to `import Button from '$lib/components/ui/button';`. The legacy component accepted `variant="primary|outline|ghost|secondary"` and `size="sm|md|lg"`, which map 1:1. Delete `src/lib/components/ui/Button.svelte`. Importers of `$lib/components/ui/button` that used `variant="default"` change to `variant="primary"`; `size="default"` to `size="md"`.

- [ ] **Step 6: Chip, RatingBadge, MetaChips, Section**

`src/lib/components/ui/chip/chip.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		selected?: boolean;
		href?: string;
		onclick?: (event: MouseEvent) => void;
		onremove?: () => void;
		class?: string;
		children?: Snippet;
	}

	let {
		selected = false,
		href,
		onclick,
		onremove,
		class: className = '',
		children
	}: Props = $props();
</script>

{#if href}
	<a {href} class="chip {className}" class:selected aria-current={selected ? 'true' : undefined}>
		{@render children?.()}
	</a>
{:else}
	<button type="button" class="chip {className}" class:selected aria-pressed={selected} {onclick}>
		{@render children?.()}
		{#if onremove}
			<span
				class="remove"
				role="button"
				tabindex="0"
				aria-label="Remove"
				onclick={(event) => {
					event.stopPropagation();
					onremove();
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						onremove();
					}
				}}><XIcon size={14} /></span
			>
		{/if}
	</button>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0 0.95rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.04);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		transition:
			background-color var(--duration-base) var(--ease-out),
			border-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.chip:hover {
		color: var(--content-primary);
		border-color: var(--border-strong);
	}
	.chip:active {
		transform: scale(0.97);
	}
	.selected {
		background: var(--brand-muted);
		border-color: var(--brand-border);
		color: var(--brand-primary);
	}
	.remove {
		display: inline-flex;
		margin-right: -0.35rem;
		padding: 0.25rem;
		border-radius: 50%;
	}
	.remove:hover {
		background: rgba(255, 255, 255, 0.12);
	}
</style>
```

`src/lib/components/ui/chip/index.ts`: `import Chip from './chip.svelte'; export { Chip }; export default Chip;`

`src/lib/components/ui/rating-badge/rating-badge.svelte`:

```svelte
<script lang="ts">
	interface Props {
		value: string;
		source?: string;
		class?: string;
	}
	let { value, source = 'TMDB', class: className = '' }: Props = $props();
</script>

<span class="rating {className}" title="{source} rating">
	<span class="star" aria-hidden="true">★</span>
	<span class="value">{value}</span>
	<span class="sr-only">{source} rating</span>
</span>

<style>
	.rating {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-xs);
		background: rgba(8, 9, 11, 0.78);
		backdrop-filter: blur(8px);
		color: var(--content-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		line-height: 1;
	}
	.star {
		color: var(--rating-star);
	}
</style>
```

`src/lib/components/ui/rating-badge/index.ts`: `import RatingBadge from './rating-badge.svelte'; export { RatingBadge }; export default RatingBadge;`

`src/lib/components/ui/meta-chips/meta-chips.svelte`:

```svelte
<script lang="ts">
	interface Props {
		items: Array<string | null | undefined>;
		class?: string;
	}
	let { items, class: className = '' }: Props = $props();
	const visible = $derived(items.filter((item): item is string => Boolean(item)));
</script>

{#if visible.length > 0}
	<ul class="meta {className}">
		{#each visible as item, index (index)}
			<li>{item}</li>
		{/each}
	</ul>
{/if}

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0;
		list-style: none;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.meta li + li::before {
		content: '·';
		margin: 0 0.6rem;
		color: var(--content-tertiary);
	}
</style>
```

`src/lib/components/ui/meta-chips/index.ts`: `import MetaChips from './meta-chips.svelte'; export { MetaChips }; export default MetaChips;`

`src/lib/components/ui/section/section.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';

	interface Props {
		title: string;
		eyebrow?: string;
		seeAllHref?: string;
		seeAllLabel?: string;
		id?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		title,
		eyebrow,
		seeAllHref,
		seeAllLabel = 'See all',
		id,
		class: className = '',
		children
	}: Props = $props();

	const headingId = $derived(`${id ?? title.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}-heading`);
</script>

<section class="section {className}" {id} aria-labelledby={headingId}>
	<header class="head">
		<div>
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h2 class="title" id={headingId}>{title}</h2>
		</div>
		{#if seeAllHref}
			<a class="see-all" href={seeAllHref}>
				<span>{seeAllLabel}</span>
				<ChevronRightIcon size={16} aria-hidden="true" />
			</a>
		{/if}
	</header>
	{@render children?.()}
</section>

<style>
	.section {
		content-visibility: auto;
		contain-intrinsic-size: auto 320px;
		margin-block: var(--space-7);
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		padding-inline: var(--page-gutter);
		margin-bottom: var(--space-4);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 700;
		transition: color var(--duration-base) var(--ease-out);
	}
	.see-all:hover {
		color: var(--brand-primary);
	}
</style>
```

`src/lib/components/ui/section/index.ts`: `import Section from './section.svelte'; export { Section }; export default Section;`

- [ ] **Step 7: Rail**

`src/lib/components/ui/rail/rail.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { railScrollTarget } from './scroll';

	interface Props {
		label: string;
		class?: string;
		children?: Snippet;
	}

	let { label, class: className = '', children }: Props = $props();

	let scroller = $state<HTMLDivElement>();
	let atStart = $state(true);
	let atEnd = $state(false);

	function measure() {
		if (!scroller) return;
		atStart = scroller.scrollLeft <= 1;
		atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
	}

	function scroll(direction: 1 | -1) {
		if (!scroller) return;
		scroller.scrollTo({
			left: railScrollTarget(
				scroller.scrollLeft,
				scroller.clientWidth,
				scroller.scrollWidth,
				direction
			),
			behavior: 'smooth'
		});
	}

	$effect(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (scroller) observer.observe(scroller);
		return () => observer.disconnect();
	});
</script>

<div class="rail {className}">
	<div
		bind:this={scroller}
		class="scroller"
		role="region"
		aria-label={label}
		tabindex="0"
		onscroll={measure}
	>
		{@render children?.()}
	</div>
	<button
		type="button"
		class="arrow left"
		aria-label="Scroll {label} backwards"
		disabled={atStart}
		onclick={() => scroll(-1)}><ChevronLeftIcon size={22} /></button
	>
	<button
		type="button"
		class="arrow right"
		aria-label="Scroll {label} forwards"
		disabled={atEnd}
		onclick={() => scroll(1)}><ChevronRightIcon size={22} /></button
	>
</div>

<style>
	.rail {
		position: relative;
	}
	.scroller {
		display: flex;
		gap: var(--space-3);
		padding-inline: var(--page-gutter);
		padding-block: var(--space-2);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--page-gutter);
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.scroller > :global(*) {
		flex: 0 0 auto;
		scroll-snap-align: start;
	}
	.arrow {
		position: absolute;
		top: 50%;
		z-index: var(--z-rail-controls);
		display: none;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: rgba(8, 9, 11, 0.82);
		color: var(--content-primary);
		box-shadow: var(--elevation-2);
		transform: translateY(-50%);
		opacity: 0;
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.arrow:disabled {
		visibility: hidden;
	}
	.left {
		left: calc(var(--page-gutter) - 1.375rem);
	}
	.right {
		right: calc(var(--page-gutter) - 1.375rem);
	}
	@media (hover: hover) and (min-width: 1024px) {
		.arrow {
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
		.rail:hover .arrow,
		.rail:focus-within .arrow {
			opacity: 1;
		}
		.arrow:hover {
			transform: translateY(-50%) scale(1.06);
		}
	}
</style>
```

`src/lib/components/ui/rail/index.ts`: `import Rail from './rail.svelte'; export { Rail }; export { railScrollTarget } from './scroll'; export default Rail;`

- [ ] **Step 8: Gates and commit**

Run: `pnpm check && pnpm lint && pnpm test:unit -- --run`
Expected: 0 errors; the player-safety scan stays green.

```bash
git add src/app.css src/app.html src/lib/components/ui
git add -u
git commit -m "feat(kit): tokens, Button on tokens, Chip, RatingBadge, MetaChips, Section, Rail"
```

---

### Task 7: Media components (PosterCard, BackdropImage, RankedRail, HeroCarousel)

**Files:**

- Create: `src/lib/components/ui/poster-card/poster-card.svelte` + `index.ts`
- Create: `src/lib/components/ui/backdrop-image/backdrop-image.svelte` + `index.ts`
- Create: `src/lib/components/ui/ranked-rail/ranked-rail.svelte` + `index.ts`
- Create: `src/lib/components/ui/hero-carousel/hero-carousel.svelte`, `rotation.ts`, `index.ts`
- Test: `src/lib/components/ui/hero-carousel/rotation.test.ts`

**Interfaces:**

- Consumes: Task 4 `posterSrcSet`, `backdropSrcSet`, `logoSrcSet`; Task 5 formatters; Task 6 `RatingBadge`, `MetaChips`, `Button`, `Rail`.
- Produces: `PosterCard` props `{ href; title; posterPath; releaseDate?; rating?; genre?; rank?; eager?; sizes? }`; `BackdropImage` `{ path; alt?; eager?; sizes?; class? }`; `RankedRail` `{ label; items: PosterItem[] }` where `PosterItem = { id: string; href: string; title: string; posterPath: string | null; releaseDate?: string | null; rating?: number | string | null; genre?: string | null }`; `HeroCarousel` `{ items: HeroItem[]; children?: Snippet<[HeroItem]> }` with `HeroItem = PosterItem & { backdropPath: string | null; logoPath?: string | null; overview?: string | null; runtime?: number | null; genres?: string[] }`; `nextIndex`, `previousIndex`, `swipeDirection`.

- [ ] **Step 1: Write the failing rotation tests**

```ts
import { describe, expect, it } from 'vitest';
import { nextIndex, previousIndex, swipeDirection } from './rotation';

describe('carousel rotation', () => {
	it('wraps forwards and backwards', () => {
		expect(nextIndex(0, 5)).toBe(1);
		expect(nextIndex(4, 5)).toBe(0);
		expect(previousIndex(0, 5)).toBe(4);
	});

	it('is stable with zero or one item', () => {
		expect(nextIndex(0, 0)).toBe(0);
		expect(previousIndex(0, 0)).toBe(0);
		expect(nextIndex(0, 1)).toBe(0);
	});

	it('turns a horizontal drag into a direction only past the threshold', () => {
		expect(swipeDirection(-60)).toBe(1);
		expect(swipeDirection(60)).toBe(-1);
		expect(swipeDirection(-20)).toBe(0);
		expect(swipeDirection(39.9, 40)).toBe(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails** → FAIL (module missing).

- [ ] **Step 3: Implement rotation.ts**

```ts
export function nextIndex(index: number, count: number): number {
	return count <= 1 ? 0 : (index + 1) % count;
}

export function previousIndex(index: number, count: number): number {
	return count <= 1 ? 0 : (index - 1 + count) % count;
}

// Negative deltaX = finger moved left = show the next slide.
export function swipeDirection(deltaX: number, threshold = 40): 1 | -1 | 0 {
	if (deltaX <= -threshold) return 1;
	if (deltaX >= threshold) return -1;
	return 0;
}
```

Run the test → PASS.

- [ ] **Step 4: PosterCard**

`src/lib/components/ui/poster-card/poster-card.svelte`:

```svelte
<script lang="ts" module>
	export interface PosterItem {
		id: string;
		href: string;
		title: string;
		posterPath: string | null;
		releaseDate?: string | null;
		rating?: number | string | null;
		genre?: string | null;
	}
</script>

<script lang="ts">
	import { posterSrcSet } from '$lib/tmdb/images';
	import { formatRating, formatYear } from '$lib/format';
	import RatingBadge from '../rating-badge/rating-badge.svelte';

	interface Props extends PosterItem {
		rank?: number | null;
		eager?: boolean;
		sizes?: string;
		class?: string;
	}

	let {
		href,
		title,
		posterPath,
		releaseDate = null,
		rating = null,
		genre = null,
		rank = null,
		eager = false,
		sizes = '(min-width: 1024px) 180px, (min-width: 640px) 160px, 140px',
		class: className = ''
	}: Props = $props();

	const image = $derived(posterSrcSet(posterPath));
	const year = $derived(formatYear(releaseDate));
	const score = $derived(formatRating(rating));
	let loaded = $state(false);
</script>

<a {href} class="card {className}" class:ranked={rank !== null} data-sveltekit-preload-data="hover">
	{#if rank !== null}<span class="rank" aria-hidden="true">{rank}</span>{/if}
	<div class="frame" style:background-image={image ? `url(${image.placeholder})` : undefined}>
		{#key image?.src}
			{#if image}
				<img
					src={image.src}
					srcset={image.srcset || undefined}
					{sizes}
					alt=""
					width="342"
					height="513"
					loading={eager ? 'eager' : 'lazy'}
					decoding="async"
					class:loaded
					onload={() => (loaded = true)}
				/>
			{:else}
				<span class="fallback" aria-hidden="true">{title}</span>
			{/if}
		{/key}
		{#if score}<RatingBadge value={score} class="badge" />{/if}
		<div class="overlay" aria-hidden="true">
			<span class="overlay-title">{title}</span>
			{#if year || genre}<span class="overlay-meta"
					>{[year, genre].filter(Boolean).join(' · ')}</span
				>{/if}
		</div>
	</div>
	<span class="title">{title}</span>
	{#if year}<span class="meta">{year}</span>{/if}
	{#if rank !== null}<span class="sr-only">Rank {rank}</span>{/if}
</a>

<style>
	.card {
		--card-width: clamp(140px, 42vw, 180px);
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: var(--card-width);
		border-radius: var(--radius-md);
		outline-offset: 4px;
	}
	.ranked {
		padding-left: 2.6rem;
	}
	.rank {
		position: absolute;
		left: -0.1rem;
		bottom: 2.6rem;
		z-index: 1;
		font-size: clamp(4.5rem, 12vw, 6.5rem);
		font-weight: 900;
		line-height: 0.8;
		letter-spacing: -0.08em;
		color: var(--surface-canvas);
		-webkit-text-stroke: 2px var(--content-secondary);
		pointer-events: none;
	}
	.frame {
		position: relative;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised) center / cover no-repeat;
		box-shadow: var(--elevation-1);
		transition:
			transform var(--duration-base) var(--ease-spring),
			box-shadow var(--duration-base) var(--ease-out);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--duration-slow) var(--ease-out);
	}
	img.loaded {
		opacity: 1;
	}
	.fallback {
		display: grid;
		place-items: center;
		height: 100%;
		padding: var(--space-3);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 700;
		text-align: center;
	}
	.frame :global(.badge) {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
	}
	.overlay {
		position: absolute;
		inset: auto 0 0 0;
		padding: 2.5rem 0.75rem 0.75rem;
		background: linear-gradient(to top, rgba(8, 9, 11, 0.92), transparent);
		opacity: 0;
		transform: translateY(8px);
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}
	.overlay-title {
		display: block;
		font-weight: 800;
		font-size: var(--text-sm);
		line-height: 1.2;
	}
	.overlay-meta {
		display: block;
		margin-top: 0.2rem;
		color: var(--content-secondary);
		font-size: var(--text-xs);
	}
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.meta {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	@media (hover: hover) {
		.card:hover .frame,
		.card:focus-visible .frame {
			transform: translateY(-6px) scale(1.03);
			box-shadow: var(--elevation-3);
		}
		.card:hover .overlay,
		.card:focus-visible .overlay {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.card:active .frame {
		transform: scale(0.98);
	}
</style>
```

`src/lib/components/ui/poster-card/index.ts`: `import PosterCard, { type PosterItem } from './poster-card.svelte'; export { PosterCard, type PosterItem }; export default PosterCard;`

- [ ] **Step 5: BackdropImage**

`src/lib/components/ui/backdrop-image/backdrop-image.svelte`:

```svelte
<script lang="ts">
	import { backdropSrcSet } from '$lib/tmdb/images';

	interface Props {
		path: string | null | undefined;
		alt?: string;
		eager?: boolean;
		sizes?: string;
		class?: string;
	}

	let { path, alt = '', eager = false, sizes = '100vw', class: className = '' }: Props = $props();

	const image = $derived(backdropSrcSet(path));
	let loaded = $state(false);
</script>

{#if image}
	{#key image.src}
		<div class="backdrop {className}" style:background-image={`url(${image.placeholder})`}>
			<img
				src={image.src}
				srcset={image.srcset || undefined}
				{sizes}
				{alt}
				loading={eager ? 'eager' : 'lazy'}
				fetchpriority={eager ? 'high' : undefined}
				decoding="async"
				class:loaded
				onload={() => (loaded = true)}
			/>
		</div>
	{/key}
{/if}

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--surface-subtle) center / cover no-repeat;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transform: scale(1.04);
		transition:
			opacity var(--duration-slow) var(--ease-out),
			transform 1.2s var(--ease-out);
	}
	img.loaded {
		opacity: 1;
		transform: scale(1);
	}
</style>
```

`index.ts`: `import BackdropImage from './backdrop-image.svelte'; export { BackdropImage }; export default BackdropImage;`

- [ ] **Step 6: RankedRail**

`src/lib/components/ui/ranked-rail/ranked-rail.svelte`:

```svelte
<script lang="ts">
	import Rail from '../rail/rail.svelte';
	import PosterCard, { type PosterItem } from '../poster-card/poster-card.svelte';

	interface Props {
		label: string;
		items: PosterItem[];
	}
	let { label, items }: Props = $props();
</script>

<Rail {label}>
	{#each items as item, index (item.id)}
		<PosterCard {...item} rank={index + 1} eager={index < 3} />
	{/each}
</Rail>
```

`index.ts`: `import RankedRail from './ranked-rail.svelte'; export { RankedRail }; export default RankedRail;`

- [ ] **Step 7: HeroCarousel**

`src/lib/components/ui/hero-carousel/hero-carousel.svelte`:

```svelte
<script lang="ts" module>
	import type { PosterItem } from '../poster-card/poster-card.svelte';

	export interface HeroItem extends PosterItem {
		backdropPath: string | null;
		logoPath?: string | null;
		overview?: string | null;
		runtime?: number | null;
		genres?: string[];
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { backdropSrcSet, logoSrcSet } from '$lib/tmdb/images';
	import { formatRating, formatRuntime, formatYear } from '$lib/format';
	import BackdropImage from '../backdrop-image/backdrop-image.svelte';
	import MetaChips from '../meta-chips/meta-chips.svelte';
	import { nextIndex, previousIndex, swipeDirection } from './rotation';

	interface Props {
		items: HeroItem[];
		intervalMs?: number;
		// Rendered inside the text block, below the overview: the page decides the actions.
		actions?: Snippet<[HeroItem]>;
	}

	let { items, intervalMs = 8000, actions }: Props = $props();

	let index = $state(0);
	let paused = $state(false);
	let pointerStartX: number | null = null;

	const current = $derived(items[index] ?? null);
	const count = $derived(items.length);
	const logo = $derived(logoSrcSet(current?.logoPath));
	const meta = $derived(
		current
			? [
					formatRating(current.rating) ? `★ ${formatRating(current.rating)}` : null,
					formatYear(current.releaseDate),
					formatRuntime(current.runtime),
					...(current.genres ?? []).slice(0, 3)
				]
			: []
	);

	function goTo(target: number) {
		index = target;
	}

	$effect(() => {
		// Preload the next backdrop so the switch never shows a blank frame.
		const next = items[nextIndex(index, count)];
		const set = backdropSrcSet(next?.backdropPath);
		if (set && typeof Image !== 'undefined') {
			const preload = new Image();
			preload.src = set.src;
		}
	});

	$effect(() => {
		if (count <= 1 || paused) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') index = nextIndex(index, count);
		}, intervalMs);
		return () => window.clearInterval(timer);
	});

	function onPointerDown(event: PointerEvent) {
		pointerStartX = event.clientX;
	}

	function onPointerUp(event: PointerEvent) {
		if (pointerStartX === null) return;
		const direction = swipeDirection(event.clientX - pointerStartX);
		pointerStartX = null;
		if (direction === 1) index = nextIndex(index, count);
		if (direction === -1) index = previousIndex(index, count);
	}
</script>

{#if current}
	<section
		class="hero"
		aria-roledescription="carousel"
		aria-label="Featured titles"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={() => (pointerStartX = null)}
	>
		<BackdropImage path={current.backdropPath} eager={index === 0} sizes="100vw" />
		<div class="scrim" aria-hidden="true"></div>

		<div class="content" aria-live="polite">
			{#key current.id}
				<div class="text">
					{#if logo}
						<img
							class="logo"
							src={logo.src}
							srcset={logo.srcset || undefined}
							sizes="(min-width: 1024px) 420px, 70vw"
							alt=""
							loading="eager"
							decoding="async"
						/>
						<h1 class="sr-only">{current.title}</h1>
					{:else}
						<h1 class="title">{current.title}</h1>
					{/if}
					<MetaChips items={meta} class="meta" />
					{#if current.overview}<p class="overview">{current.overview}</p>{/if}
					{#if actions}<div class="actions">{@render actions(current)}</div>{/if}
				</div>
			{/key}
		</div>

		{#if count > 1}
			<div class="dots" role="tablist" aria-label="Choose featured title">
				{#each items as item, dotIndex (item.id)}
					<button
						type="button"
						role="tab"
						class="dot"
						class:active={dotIndex === index}
						aria-selected={dotIndex === index}
						aria-label={item.title}
						onclick={() => goTo(dotIndex)}
					>
						<span class="dot-fill" style:animation-duration={`${intervalMs}ms`}></span>
					</button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.hero {
		position: relative;
		min-height: min(70dvh, 560px);
		display: flex;
		align-items: flex-end;
		overflow: hidden;
		touch-action: pan-y;
		isolation: isolate;
	}
	@media (min-width: 1024px) {
		.hero {
			min-height: min(80dvh, 720px);
			align-items: center;
		}
	}
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 0%, rgba(8, 9, 11, 0.55) 40%, transparent 75%),
			linear-gradient(to right, rgba(8, 9, 11, 0.9) 0%, rgba(8, 9, 11, 0.35) 55%, transparent 100%);
	}
	.content {
		position: relative;
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-7);
	}
	.text {
		max-width: 44rem;
		animation: rise var(--duration-slow) var(--ease-out) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.logo {
		display: block;
		width: min(70vw, 420px);
		max-height: 160px;
		object-fit: contain;
		object-position: left bottom;
		margin-bottom: var(--space-4);
		filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.6));
	}
	.title {
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
	}
	.text :global(.meta) {
		margin-top: var(--space-3);
		color: var(--content-primary);
	}
	.overview {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 36rem;
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: 1.55;
	}
	@media (max-width: 639px) {
		.overview {
			-webkit-line-clamp: 2;
		}
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-5);
	}
	.dots {
		position: absolute;
		right: var(--page-gutter);
		bottom: var(--space-4);
		display: flex;
		gap: 0.4rem;
	}
	.dot {
		width: 2rem;
		height: var(--touch-target);
		display: flex;
		align-items: center;
	}
	.dot-fill {
		display: block;
		width: 100%;
		height: 3px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.25);
		overflow: hidden;
		position: relative;
	}
	.dot.active .dot-fill::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--brand-primary);
		transform-origin: left;
		animation: progress linear forwards;
		animation-duration: inherit;
	}
	.hero:hover .dot.active .dot-fill::after,
	.hero:focus-within .dot.active .dot-fill::after {
		animation-play-state: paused;
	}
	@keyframes progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
</style>
```

`src/lib/components/ui/hero-carousel/index.ts`: `import HeroCarousel, { type HeroItem } from './hero-carousel.svelte'; export { HeroCarousel, type HeroItem }; export * from './rotation'; export default HeroCarousel;`

- [ ] **Step 8: Gates and commit**

Run: `pnpm check && pnpm lint && pnpm test:unit -- --run` → 0 errors.

```bash
git add src/lib/components/ui
git commit -m "feat(kit): PosterCard, BackdropImage, RankedRail, HeroCarousel"
```

---

### Task 8: Navigation: links model, TopBar, BottomTabBar, layout

**Files:**

- Create: `src/lib/navigation/links.ts`, `src/lib/navigation/links.test.ts`
- Create: `src/lib/components/ui/top-bar/top-bar.svelte` + `index.ts`
- Create: `src/lib/components/ui/bottom-tab-bar/bottom-tab-bar.svelte` + `index.ts`
- Modify: `src/routes/(cinema)/+layout.svelte`
- Modify: `src/lib/components/layout/Footer.svelte` (brand + About link)
- Delete: `src/lib/components/layout/Header.svelte` (after `git grep -l "layout/Header.svelte" src` shows only the layout)

**Interfaces:**

- Produces: `PRIMARY_LINKS`, `TAB_LINKS` (`{ href; label; icon: 'home'|'film'|'tv'|'search'|'library'|'compass'|'sparkles' }`), `isActivePath(pathname, href)`; `TopBar` props `{ user: { username: string } | null }`; `BottomTabBar` (no props).

- [ ] **Step 1: Write the failing navigation test**

```ts
import { describe, expect, it } from 'vitest';
import { isActivePath, PRIMARY_LINKS, TAB_LINKS } from './links';

describe('navigation links', () => {
	it('matches the root only exactly and other sections by prefix', () => {
		expect(isActivePath('/', '/')).toBe(true);
		expect(isActivePath('/movies', '/')).toBe(false);
		expect(isActivePath('/movies', '/movies')).toBe(true);
		expect(isActivePath('/movies/abc', '/movies')).toBe(true);
		expect(isActivePath('/moviesx', '/movies')).toBe(false);
		expect(isActivePath('/tv/123', '/movies')).toBe(false);
	});

	it('maps the library tab to every personal route', () => {
		expect(isActivePath('/my/lists/1', '/my/films')).toBe(true);
		expect(isActivePath('/auth/login', '/my/films')).toBe(false);
	});

	it('exposes five tabs with unique hrefs and the primary sections', () => {
		expect(TAB_LINKS.map((link) => link.label)).toEqual([
			'Home',
			'Movies',
			'TV',
			'Search',
			'Library'
		]);
		expect(new Set(TAB_LINKS.map((link) => link.href)).size).toBe(5);
		expect(PRIMARY_LINKS.map((link) => link.href)).toEqual([
			'/',
			'/movies',
			'/tv',
			'/discover',
			'/cinema/picker'
		]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails** → FAIL (module missing).

- [ ] **Step 3: Implement links.ts**

```ts
export type NavIcon = 'home' | 'film' | 'tv' | 'search' | 'library' | 'compass' | 'sparkles';

export interface NavLink {
	href: string;
	label: string;
	icon: NavIcon;
	// Additional prefixes that count as "inside" this section.
	aliases?: string[];
}

export const PRIMARY_LINKS: NavLink[] = [
	{ href: '/', label: 'Home', icon: 'home' },
	{ href: '/movies', label: 'Movies', icon: 'film' },
	{ href: '/tv', label: 'TV', icon: 'tv', aliases: ['/tvshow', '/tvshows', '/shows'] },
	{ href: '/discover', label: 'Discover', icon: 'compass' },
	{ href: '/cinema/picker', label: 'Picker', icon: 'sparkles' }
];

export const TAB_LINKS: NavLink[] = [
	PRIMARY_LINKS[0],
	PRIMARY_LINKS[1],
	PRIMARY_LINKS[2],
	{ href: '/search', label: 'Search', icon: 'search' },
	{ href: '/my/films', label: 'Library', icon: 'library', aliases: ['/my'] }
];

function startsWithSegment(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isActivePath(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	const link = [...PRIMARY_LINKS, ...TAB_LINKS].find((candidate) => candidate.href === href);
	const prefixes = [href, ...(link?.aliases ?? [])];
	return prefixes.some((prefix) => startsWithSegment(pathname, prefix));
}
```

Run the test → PASS.

- [ ] **Step 4: TopBar**

`src/lib/components/ui/top-bar/top-bar.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import SearchIcon from 'lucide-svelte/icons/search';
	import { isActivePath, PRIMARY_LINKS } from '$lib/navigation/links';
	import Button from '../button/button.svelte';

	interface Props {
		user: { username: string } | null;
	}

	let { user }: Props = $props();

	let scrolled = $state(false);
	let query = $state('');

	$effect(() => {
		const update = () => (scrolled = window.scrollY > 24);
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		if (trimmed) goto(`/search?q=${encodeURIComponent(trimmed)}`);
	}
</script>

<header class="bar" class:scrolled>
	<div class="inner">
		<a href="/" class="brand" aria-label="Alan's Database home">
			<span class="mark" aria-hidden="true"></span>
			<span class="word">ALAN<span class="accent">DB</span></span>
		</a>

		<nav class="primary" aria-label="Primary">
			{#each PRIMARY_LINKS as link (link.href)}
				<a
					href={link.href}
					class="link"
					aria-current={isActivePath(page.url.pathname, link.href) ? 'page' : undefined}
					>{link.label}</a
				>
			{/each}
		</nav>

		<div class="right">
			<form class="search" role="search" onsubmit={submit}>
				<SearchIcon size={18} aria-hidden="true" />
				<input
					type="search"
					name="q"
					placeholder="Search titles"
					aria-label="Search the catalogue"
					autocomplete="off"
					bind:value={query}
				/>
				<kbd aria-hidden="true">⌘K</kbd>
			</form>
			<a href="/search" class="search-icon" aria-label="Search">
				<SearchIcon size={22} aria-hidden="true" />
			</a>
			{#if user}
				<Button href="/my/films" variant="outline" size="sm" class="account">{user.username}</Button
				>
			{:else}
				<Button href="/auth/login" variant="primary" size="sm" class="account">Sign in</Button>
			{/if}
		</div>
	</div>
</header>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: var(--z-bar);
		padding-top: var(--safe-top);
		background: linear-gradient(to bottom, rgba(8, 9, 11, 0.85), transparent);
		transition: background-color var(--duration-slow) var(--ease-out);
	}
	.scrolled {
		background: rgba(8, 9, 11, 0.82);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		box-shadow: 0 1px 0 var(--border-subtle);
	}
	.inner {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		max-width: var(--container-wide);
		height: var(--top-bar-height);
		margin: 0 auto;
		padding-inline: var(--page-gutter);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		font-weight: 900;
		letter-spacing: 0.04em;
	}
	.mark {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--brand-primary);
		box-shadow: var(--shadow-glow-emerald);
	}
	.accent {
		color: var(--brand-primary);
	}
	.primary {
		display: none;
		gap: 0.25rem;
	}
	.link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		padding-inline: 0.75rem;
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 700;
		transition:
			color var(--duration-base) var(--ease-out),
			background-color var(--duration-base) var(--ease-out);
	}
	.link:hover {
		color: var(--content-primary);
		background: rgba(255, 255, 255, 0.06);
	}
	.link[aria-current='page'] {
		color: var(--content-primary);
		background: rgba(255, 255, 255, 0.1);
	}
	.right {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}
	.search {
		display: none;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		padding-inline: 0.9rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.06);
		color: var(--content-tertiary);
		transition: border-color var(--duration-base) var(--ease-out);
	}
	.search:focus-within {
		border-color: var(--brand-border);
		color: var(--content-primary);
	}
	.search input {
		width: 11rem;
		background: transparent;
		border: 0;
		color: var(--content-primary);
		outline: none;
	}
	.search input::placeholder {
		color: var(--content-tertiary);
	}
	.search kbd {
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-xs);
		border: 1px solid var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 0.65rem;
	}
	.search-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-primary);
	}
	.right :global(.account) {
		display: none;
	}
	@media (min-width: 1024px) {
		.primary,
		.search {
			display: flex;
		}
		.search-icon {
			display: none;
		}
		.right :global(.account) {
			display: inline-flex;
		}
	}
</style>
```

`index.ts`: `import TopBar from './top-bar.svelte'; export { TopBar }; export default TopBar;`

- [ ] **Step 5: BottomTabBar**

`src/lib/components/ui/bottom-tab-bar/bottom-tab-bar.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import HomeIcon from 'lucide-svelte/icons/house';
	import FilmIcon from 'lucide-svelte/icons/film';
	import TvIcon from 'lucide-svelte/icons/tv';
	import SearchIcon from 'lucide-svelte/icons/search';
	import LibraryIcon from 'lucide-svelte/icons/library';
	import CompassIcon from 'lucide-svelte/icons/compass';
	import SparklesIcon from 'lucide-svelte/icons/sparkles';
	import { isActivePath, TAB_LINKS, type NavIcon } from '$lib/navigation/links';

	const ICONS: Record<NavIcon, typeof HomeIcon> = {
		home: HomeIcon,
		film: FilmIcon,
		tv: TvIcon,
		search: SearchIcon,
		library: LibraryIcon,
		compass: CompassIcon,
		sparkles: SparklesIcon
	};
</script>

<nav class="tabs" aria-label="Primary">
	{#each TAB_LINKS as link (link.href)}
		{@const Icon = ICONS[link.icon]}
		{@const active = isActivePath(page.url.pathname, link.href)}
		<a href={link.href} class="tab" class:active aria-current={active ? 'page' : undefined}>
			<Icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 1.8} />
			<span>{link.label}</span>
		</a>
	{/each}
</nav>

<style>
	.tabs {
		position: fixed;
		inset: auto 0 0 0;
		z-index: var(--z-bar);
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		height: calc(var(--bottom-bar-height) + var(--safe-bottom));
		padding-bottom: var(--safe-bottom);
		background: rgba(8, 9, 11, 0.9);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		border-top: 1px solid var(--border-subtle);
	}
	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		min-height: var(--bottom-bar-height);
		color: var(--content-tertiary);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		transition: color var(--duration-base) var(--ease-out);
	}
	.tab:active {
		transform: scale(0.95);
	}
	.active {
		color: var(--brand-primary);
	}
	@media (min-width: 1024px) {
		.tabs {
			display: none;
		}
	}
</style>
```

`index.ts`: `import BottomTabBar from './bottom-tab-bar.svelte'; export { BottomTabBar }; export default BottomTabBar;`

If `lucide-svelte/icons/house` does not exist in the installed version, use `lucide-svelte/icons/home` (check `ls node_modules/lucide-svelte/dist/icons | grep -E "^(house|home)\.svelte"`).

- [ ] **Step 6: Wire the cinema layout and footer**

Replace `src/routes/(cinema)/+layout.svelte`:

```svelte
<script lang="ts">
	import '../../app.css';
	import TopBar from '$lib/components/ui/top-bar';
	import BottomTabBar from '$lib/components/ui/bottom-tab-bar';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import CommandPalette from '$lib/components/ui/CommandPalette.svelte';
	import NavigationProgressBar from '$lib/components/layout/NavigationProgressBar.svelte';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: { user: { username: string } | null }; children?: Snippet } =
		$props();
</script>

<div class="app-layout" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="eager">
	<NavigationProgressBar />
	<a href="#main-content" class="sr-only skip-link">Skip to main content</a>
	<TopBar user={data.user} />
	<main id="main-content" class="main-content" tabindex="-1">
		{@render children?.()}
	</main>
	<Footer />
	<BottomTabBar />
	<ToastContainer />
	<CommandPalette />
</div>

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		/* The hero sits under the transparent bar. */
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
	}
	.main-content {
		flex: 1;
		padding-bottom: calc(var(--bottom-bar-height) + var(--safe-bottom));
	}
	@media (min-width: 1024px) {
		.main-content {
			padding-bottom: 0;
		}
	}
</style>
```

`data.user` already comes from `(cinema)/+layout.server.ts`. In `Footer.svelte`, change the brand to `ALAN<span class="accent">DB</span>` (drop the emoji and "CINEMA") and add a link row before `.footer-meta`:

```svelte
<nav class="footer-links" aria-label="Footer">
	<a href="/about">About</a>
	<a href="/status">Status</a>
	<a href="/kit">UI kit</a>
	<a href="https://github.com/TheoPerson/alandatabase.com" target="_blank" rel="noreferrer"
		>GitHub</a
	>
</nav>
```

with `.footer-links { display: flex; flex-wrap: wrap; gap: var(--space-4); } .footer-links a { color: var(--content-secondary); font-weight: 600; min-height: var(--touch-target); display: inline-flex; align-items: center; }`.

Delete `src/lib/components/layout/Header.svelte` once `git grep -l "layout/Header.svelte" src` returns nothing else.

- [ ] **Step 7: Gates and commit**

Run: `pnpm check && pnpm lint && pnpm test:unit -- --run` → 0 errors.

```bash
git add src/lib/navigation src/lib/components/ui src/routes/\(cinema\)/+layout.svelte src/lib/components/layout
git add -u
git commit -m "feat(nav): TopBar, mobile BottomTabBar, navigation links model"
```

---

### Task 9: `/kit` showcase page

**Files:**

- Create: `src/routes/(cinema)/kit/+page.svelte`
- Modify: `tests/accessibility.e2e.ts` (add `/kit`)

- [ ] **Step 1: Build the page**

```svelte
<script lang="ts">
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import RatingBadge from '$lib/components/ui/rating-badge';
	import MetaChips from '$lib/components/ui/meta-chips';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel, { type HeroItem } from '$lib/components/ui/hero-carousel';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';

	let selected = $state(['Drama']);

	// Sample items use TMDB paths that exist publicly; no database read on this page.
	const samples: HeroItem[] = [
		{
			id: 'sample-1',
			href: '/kit',
			title: 'Sample title one',
			posterPath: null,
			backdropPath: null,
			overview: 'A kit sample without images: every component must still look intentional.',
			releaseDate: '2014-11-05',
			runtime: 169,
			rating: 8.4,
			genres: ['Adventure', 'Drama', 'Science Fiction']
		},
		{
			id: 'sample-2',
			href: '/kit',
			title: 'Sample title two',
			posterPath: null,
			backdropPath: null,
			overview: 'Second slide to exercise rotation, dots and the swipe gesture.',
			releaseDate: '1999-03-31',
			runtime: 136,
			rating: 8.7,
			genres: ['Action', 'Science Fiction']
		}
	];

	const posters = Array.from({ length: 10 }, (_, index) => ({
		id: `poster-${index}`,
		href: '/kit',
		title: `Poster ${index + 1}`,
		posterPath: null,
		releaseDate: `${1990 + index}-01-01`,
		rating: 6 + index / 4,
		genre: index % 2 ? 'Drama' : 'Thriller'
	}));

	const tokens = [
		['--surface-canvas', 'Canvas'],
		['--surface-raised', 'Raised'],
		['--surface-overlay', 'Overlay'],
		['--brand-primary', 'Brand'],
		['--brand-hover', 'Brand hover'],
		['--content-primary', 'Text'],
		['--content-secondary', 'Text secondary'],
		['--content-tertiary', 'Text tertiary'],
		['--color-error', 'Error'],
		['--rating-star', 'Star']
	];
</script>

<svelte:head>
	<title>UI kit | Alan Database</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<HeroCarousel items={samples}>
	{#snippet actions(item)}
		<Button href={item.href} size="lg">Details</Button>
		<Button variant="secondary" size="lg">+ Watchlist</Button>
	{/snippet}
</HeroCarousel>

<div class="kit">
	<Section title="Colour tokens" eyebrow="Tokens">
		<div class="swatches">
			{#each tokens as [token, label] (token)}
				<div class="swatch">
					<span class="chip" style:background={`var(${token})`}></span>
					<span class="label">{label}</span>
					<code>{token}</code>
				</div>
			{/each}
		</div>
	</Section>

	<Section title="Type scale" eyebrow="Tokens">
		<div class="type">
			<p
				style="font-size: var(--type-display); font-weight: 900; letter-spacing: var(--tracking-tight)"
			>
				Display
			</p>
			<p style="font-size: var(--type-headline); font-weight: 800">Headline</p>
			<p style="font-size: var(--type-title); font-weight: 800">Title</p>
			<p style="font-size: var(--type-body)">Body — Plus Jakarta Sans, 1.6 line height.</p>
			<p
				style="font-size: var(--type-label); font-weight: 700; letter-spacing: var(--tracking-wide); text-transform: uppercase"
			>
				Label
			</p>
		</div>
	</Section>

	<Section title="Buttons" eyebrow="Primitives">
		<div class="row">
			<Button>Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="danger">Danger</Button>
			<Button loading>Loading</Button>
			<Button disabled>Disabled</Button>
			<Button href="/kit" variant="outline">As link</Button>
		</div>
		<div class="row">
			<Button size="sm">Small</Button>
			<Button size="md">Medium</Button>
			<Button size="lg">Large</Button>
			<Button size="icon" aria-label="Icon only">★</Button>
		</div>
	</Section>

	<Section title="Chips, badges, meta" eyebrow="Primitives">
		<div class="row">
			{#each ['Drama', 'Thriller', 'Comedy'] as genre (genre)}
				<Chip
					selected={selected.includes(genre)}
					onclick={() =>
						(selected = selected.includes(genre)
							? selected.filter((item) => item !== genre)
							: [...selected, genre])}>{genre}</Chip
				>
			{/each}
			<Chip onremove={() => (selected = [])}>Removable</Chip>
			<Chip href="/kit">Link chip</Chip>
		</div>
		<div class="row">
			<RatingBadge value="8.4" />
			<MetaChips items={['★ 8.4', '2014', '2h 49m', 'Science Fiction']} />
		</div>
	</Section>

	<Section title="Poster rail" eyebrow="Media" seeAllHref="/movies">
		<Rail label="Sample posters">
			{#each posters as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>

	<Section title="Ranked rail" eyebrow="Media">
		<RankedRail label="Sample ranking" items={posters} />
	</Section>

	<Section title="States" eyebrow="Feedback">
		<div class="row">
			<div style="width: 180px"><Skeleton height="270px" label="Loading poster" /></div>
			<EmptyState title="Nothing here yet" description="Empty states carry a next step." compact />
			<ErrorState title="Something went wrong" description="Error states say what to do." />
		</div>
	</Section>
</div>

<style>
	.kit {
		padding-bottom: var(--space-8);
	}
	.swatches,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		padding-inline: var(--page-gutter);
	}
	.row + .row {
		margin-top: var(--space-3);
	}
	.swatch {
		display: grid;
		gap: 0.25rem;
		width: 9rem;
		font-size: var(--text-xs);
	}
	.chip {
		display: block;
		height: 3rem;
		border-radius: var(--radius-md);
		box-shadow: var(--elevation-1);
	}
	code {
		color: var(--content-tertiary);
		font-family: var(--font-mono);
	}
	.type {
		display: grid;
		gap: var(--space-3);
		padding-inline: var(--page-gutter);
	}
</style>
```

- [ ] **Step 2: Add `/kit` to the axe suite and verify**

In `tests/accessibility.e2e.ts`, add `'/kit'` to `publicRoutes`. Run `pnpm check && pnpm lint`. Start the dev server against the local database and open `http://127.0.0.1:5173/kit` at 390 px and 1440 px; take screenshots and look at them (every variant visible, no overflow, dots paused on hover).

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(cinema\)/kit tests/accessibility.e2e.ts
git commit -m "feat(kit): /kit showcase page"
```

---

### Task 10: Home at `/`, landing moved to `/about`

**Files:**

- Modify: `src/lib/server/services/movie.service.ts` (add `getFeaturedMovies`, `getGenres`, `toPosterItem`, `toHeroItem`)
- Test: `src/lib/server/services/movie.service.featured.test.ts`
- Move: `src/routes/(hub)/+page.svelte` → `src/routes/(hub)/about/+page.svelte`
- Create: `src/routes/(cinema)/+page.server.ts`, `src/routes/(cinema)/+page.svelte`
- Modify: `src/routes/sitemap.xml/+server.ts` (add `/about`), `scripts/verify-production-hosts.mjs`, `tests/navigation.spec.ts`, `tests/responsive.e2e.ts`, `tests/accessibility.e2e.ts`
- Create: `tests/home.e2e.ts`

**Interfaces:**

- Produces: `getFeaturedMovies(limit = 5)`, `getGenres()`, `toPosterItem(movie)` → `PosterItem`, `toHeroItem(movie)` → `HeroItem`.
- Consumes: Task 7 `PosterItem`, `HeroItem`.

- [ ] **Step 1: Write the failing service test**

`src/lib/server/services/movie.service.featured.test.ts`:

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
import { getFeaturedMovies, getGenres, toHeroItem, toPosterItem } from './movie.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

afterAll(async () => {
	await pg.close();
});

async function insertMovie(
	tmdbId: number,
	title: string,
	backdrop: string | null,
	votes: number,
	average: number,
	adult = false
) {
	await pg.query(
		`insert into movies (tmdb_id, title, overview, poster_path, backdrop_path, vote_count, vote_average, popularity, adult, metadata)
		 values ($1, $2, 'Overview', '/p.jpg', $3, $4, $5, 10, $6, $7)`,
		[
			tmdbId,
			title,
			backdrop,
			votes,
			average,
			adult,
			title === 'Logo' ? JSON.stringify({ logoPath: '/logo.png' }) : null
		]
	);
}

describe('getFeaturedMovies', () => {
	it('returns standard movies with a backdrop and enough votes, best rated first', async () => {
		await insertMovie(1, 'No backdrop', null, 5000, 9.5);
		await insertMovie(2, 'Few votes', '/b.jpg', 50, 9.4);
		await insertMovie(3, 'Adult', '/b.jpg', 5000, 9.3, true);
		await insertMovie(4, 'Good', '/b.jpg', 5000, 8.1);
		await insertMovie(5, 'Logo', '/b.jpg', 5000, 8.9);
		await pg.query(`insert into genres (id, name) values (18, 'Drama'), (28, 'Action')`);
		await pg.query(
			`insert into movie_genres (movie_id, genre_id) select id, 18 from movies where tmdb_id = 5`
		);

		const featured = await getFeaturedMovies(5);

		expect(featured.map((movie) => movie.title)).toEqual(['Logo', 'Good']);
		const hero = toHeroItem(featured[0]);
		expect(hero.logoPath).toBe('/logo.png');
		expect(hero.genres).toEqual(['Drama']);
		expect(hero.href).toBe(`/movies/${featured[0].id}`);
		expect(toPosterItem(featured[1]).genre).toBeNull();
	});

	it('lists genres alphabetically', async () => {
		expect((await getGenres()).map((genre) => genre.name)).toEqual(['Action', 'Drama']);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/server/services/movie.service.featured.test.ts`
Expected: FAIL, `getFeaturedMovies is not a function`.

- [ ] **Step 3: Implement in movie.service.ts**

Add imports at the top of `src/lib/server/services/movie.service.ts`: `asc`, `gte`, `isNotNull` from `drizzle-orm`; `genres` from the schema; `import type { HeroItem } from '$lib/components/ui/hero-carousel/hero-carousel.svelte'; import type { PosterItem } from '$lib/components/ui/poster-card/poster-card.svelte';` (type-only imports are allowed from server code). Then add after `getTopRatedMovies`:

```ts
const FEATURED_MINIMUM_VOTES = 1000;

export async function getFeaturedMovies(limit = 5) {
	const results = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			isNotNull(movies.backdropPath),
			gte(movies.voteCount, FEATURED_MINIMUM_VOTES)
		),
		orderBy: [desc(movies.voteAverage), desc(movies.popularity)],
		limit: normalizeSearchLimit(limit),
		with: {
			genres: { with: { genre: true } },
			keywords: true
		}
	});
	return prepareVisibleMovies(results);
}

export async function getGenres() {
	return db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name));
}

function genreNames(movie: any): string[] {
	return (movie.genres ?? [])
		.map((relation: any) => relation.genre?.name ?? relation.name)
		.filter((name: unknown): name is string => typeof name === 'string' && name.length > 0);
}

export function toPosterItem(movie: any): PosterItem {
	return {
		id: String(movie.id),
		href: `/movies/${movie.id}`,
		title: movie.title,
		posterPath: movie.posterPath ?? null,
		releaseDate: movie.releaseDate ?? null,
		rating: movie.voteAverage ?? null,
		genre: genreNames(movie)[0] ?? null
	};
}

export function toHeroItem(movie: any): HeroItem {
	const metadata =
		movie.metadata && typeof movie.metadata === 'object' && !Array.isArray(movie.metadata)
			? (movie.metadata as Record<string, unknown>)
			: {};
	return {
		...toPosterItem(movie),
		backdropPath: movie.backdropPath ?? null,
		logoPath: typeof metadata.logoPath === 'string' ? metadata.logoPath : null,
		overview: movie.overview ?? null,
		runtime: movie.runtime ?? null,
		genres: genreNames(movie)
	};
}
```

Run the test → PASS. (If `applyLocalOverrides` strips `metadata`, keep it: check `stripVisibilityMetadata` only deletes `keywords`.)

- [ ] **Step 4: Move the landing and create the Home route**

```bash
git mv "src/routes/(hub)/+page.svelte" "src/routes/(hub)/about/+page.svelte"
```

Create `src/routes/(cinema)/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { hasPermission } from '$lib/server/auth/permissions';
import { logServerError } from '$lib/server/security/logging';
import { toggleWatchlist, getUserWatchlist } from '$lib/server/services/interaction.service';
import {
	getFeaturedMovies,
	getGenres,
	getTopRatedMovies,
	getTrendingMovies,
	toHeroItem,
	toPosterItem
} from '$lib/server/services/movie.service';
import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function settled<T>(result: PromiseSettledResult<T>, fallback: T, context: string): T {
	if (result.status === 'fulfilled') return result.value;
	logServerError(context, result.reason);
	return fallback;
}

export async function load({ locals }) {
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;

	// Every rail is independent: one failing query must not blank the page.
	const [featured, top10, trending, topRated, genres, tv, watchlist] = await Promise.allSettled([
		getFeaturedMovies(5),
		getTrendingMovies(10, 0),
		getTrendingMovies(12, 10),
		getTopRatedMovies(12, 0),
		getGenres(),
		getTop50IMDbTVShows(),
		user ? getUserWatchlist(user.id) : Promise.resolve([])
	]);

	const tvItems = settled(tv, [], 'Home TV rail failed')
		.slice(0, 10)
		.map((show) => ({
			id: `tv-${show.tmdbId}`,
			href: `/tv/${show.tmdbId}`,
			title: show.title,
			posterPath: show.posterPath,
			releaseDate: show.firstAirDate,
			rating: show.imdbRating,
			genre: show.genres[0] ?? null
		}));

	return {
		user,
		featured: settled(featured, [], 'Home featured failed').map(toHeroItem),
		top10: settled(top10, [], 'Home top 10 failed').map(toPosterItem),
		trending: settled(trending, [], 'Home trending failed').map(toPosterItem),
		topRated: settled(topRated, [], 'Home top rated failed').map(toPosterItem),
		genres: settled(genres, [], 'Home genres failed'),
		tv: tvItems,
		watchlist: settled(watchlist, [], 'Home watchlist failed')
			.map((item: any) => item.movie)
			.filter(Boolean)
			.map(toPosterItem),
		catalogueEmpty:
			featured.status === 'fulfilled' &&
			featured.value.length === 0 &&
			top10.status === 'fulfilled' &&
			top10.value.length === 0,
		error: [featured, top10, trending, topRated].every((result) => result.status === 'rejected')
	};
}

export const actions = {
	toggleWatchlist: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to update your watchlist.' });
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal watchlists need a signed-in account.' });
		}
		const data = await request.formData();
		const movieId = data.get('movieId')?.toString();
		if (!movieId || !UUID_PATTERN.test(movieId)) {
			return fail(400, { error: 'Movie identifier is invalid.' });
		}
		try {
			const interaction = await toggleWatchlist(locals.user.id, movieId);
			return { success: true, watchlist: interaction.watchlist };
		} catch (err) {
			logServerError('Watchlist update failed', err);
			return fail(500, { error: 'Watchlist could not be updated.' });
		}
	}
};
```

Create `src/routes/(cinema)/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import InfoIcon from 'lucide-svelte/icons/info';
	import PlusIcon from 'lucide-svelte/icons/plus';

	let { data } = $props();
</script>

<svelte:head>
	<title>Alan's Database — Films, series and your personal cinema</title>
	<meta
		name="description"
		content="A premium personal cinema: browse films and series, track what you watch, and find what to watch tonight."
	/>
	<link rel="canonical" href="https://alandatabase.com/" />
	<meta property="og:title" content="Alan's Database" />
	<meta property="og:description" content="Films, series and your personal cinema." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://alandatabase.com/" />
</svelte:head>

{#if data.featured.length > 0}
	<HeroCarousel items={data.featured}>
		{#snippet actions(item)}
			<Button href={item.href} size="lg">
				<InfoIcon size={20} aria-hidden="true" />
				Details
			</Button>
			{#if data.user}
				<form
					method="POST"
					action="?/toggleWatchlist"
					use:enhance={() =>
						async ({ result, update }) => {
							await update({ reset: false });
							addToast(
								result.type === 'success'
									? `Updated your watchlist for ${item.title}`
									: 'Watchlist could not be updated.',
								result.type === 'success' ? 'success' : 'error'
							);
						}}
				>
					<input type="hidden" name="movieId" value={item.id} />
					<Button type="submit" variant="secondary" size="lg">
						<PlusIcon size={20} aria-hidden="true" />
						Watchlist
					</Button>
				</form>
			{:else}
				<Button href="/auth/login?returnTo=%2F" variant="secondary" size="lg">
					<PlusIcon size={20} aria-hidden="true" />
					Watchlist
				</Button>
			{/if}
		{/snippet}
	</HeroCarousel>
{:else}
	<div class="hero-state">
		{#if data.error}
			<ErrorState
				title="The catalogue is unavailable"
				description="The database could not be reached. The public status page has the latest service information."
			>
				{#snippet action()}
					<a class="state-link" href="/status">Open system status</a>
				{/snippet}
			</ErrorState>
		{:else}
			<EmptyState
				title="No published movies yet"
				description="Run the metadata sync (pnpm --dir worker ingest:popular) to fill the catalogue."
				compact
			/>
		{/if}
	</div>
{/if}

{#if data.top10.length > 0}
	<Section title="Top 10 today" eyebrow="Trending now" seeAllHref="/movies">
		<RankedRail label="Top 10 today" items={data.top10} />
	</Section>
{/if}

{#if data.watchlist.length > 0}
	<Section title="Your watchlist" eyebrow="Keep going" seeAllHref="/my/films">
		<Rail label="Your watchlist">
			{#each data.watchlist as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.genres.length > 0}
	<Section title="Browse by genre" eyebrow="Discover">
		<div class="genres">
			{#each data.genres as genre (genre.id)}
				<Chip href={`/movies/catalog?genre=${genre.id}`}>{genre.name}</Chip>
			{/each}
		</div>
	</Section>
{/if}

{#if data.trending.length > 0}
	<Section title="Trending movies" seeAllHref="/movies/catalog">
		<Rail label="Trending movies">
			{#each data.trending as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.topRated.length > 0}
	<Section title="Top-rated cinema" seeAllHref="/movies/catalog?sort=rating">
		<Rail label="Top-rated cinema">
			{#each data.topRated as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.tv.length > 0}
	<Section title="Landmark series" eyebrow="Television" seeAllHref="/tv">
		<Rail label="Landmark series">
			{#each data.tv as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

<style>
	.hero-state {
		padding: calc(var(--top-bar-height) + var(--space-8)) var(--page-gutter) var(--space-7);
	}
	.state-link {
		color: var(--brand-primary);
		font-weight: 700;
	}
	.genres {
		display: flex;
		gap: var(--space-2);
		padding-inline: var(--page-gutter);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.genres::-webkit-scrollbar {
		display: none;
	}
</style>
```

- [ ] **Step 5: Update sitemap, production checks and E2E**

- `src/routes/sitemap.xml/+server.ts` `STATIC_URLS`: add `{ location: 'https://alandatabase.com/about', priority: '0.5', frequency: 'monthly' }`.
- `scripts/verify-production-hosts.mjs`: change `assert.match(apex.body, /A quieter way/u);` to `assert.match(apex.body, /aria-label="Featured titles"|No published movies yet/u);` and add after it:

```js
const about = await request('about page', 'https://alandatabase.com/about');
assert.equal(about.response.status, 200);
assert.match(about.body, /A quieter way/u);
```

- `tests/navigation.spec.ts`: replace the first test with

```ts
test('home is the cinema: featured carousel or an honest empty state', async ({ page }) => {
	await page.goto('/');
	const hero = page.getByRole('region', { name: 'Featured titles' });
	const empty = page.getByText('No published movies yet');
	await expect(hero.or(empty)).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible();
});

test('the project landing page lives at /about', async ({ page }) => {
	await page.goto('/about');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('A quieter way');
});
```

- `tests/responsive.e2e.ts` routes: add `'/about'` and `'/kit'`. `tests/accessibility.e2e.ts` publicRoutes: add `'/about'` (`/kit` was added in Task 9).
- Create `tests/home.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('Home navigation chrome', () => {
	test('shows the bottom tab bar on phones with 44px targets and one active tab', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/');
		const tabs = page.locator('nav.tabs a');
		await expect(tabs).toHaveCount(5);
		for (const tab of await tabs.all()) {
			expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
		await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveCount(1);
		await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveText(/Home/);
	});

	test('hides the bottom tab bar and shows primary links on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		await expect(page.locator('nav.tabs')).toBeHidden();
		await expect(page.getByRole('link', { name: 'Movies', exact: true }).first()).toBeVisible();
	});

	test('rails are labelled regions that scroll with the arrow control', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		const rail = page.getByRole('region', { name: 'Top 10 today' });
		test.skip(!(await rail.count()), 'needs catalogue data');
		await rail.hover();
		const before = await rail.evaluate((node) => node.scrollLeft);
		await page.getByRole('button', { name: 'Scroll Top 10 today forwards' }).click();
		await expect.poll(async () => rail.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before);
	});
});
```

- [ ] **Step 6: Run everything**

Run: `pnpm check && pnpm lint && pnpm test:unit -- --run` → 0 errors. Then with the dev server on `http://127.0.0.1:5173` against the real local catalogue:

`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test tests/home.e2e.ts tests/navigation.spec.ts tests/responsive.e2e.ts tests/accessibility.e2e.ts`

Expected: PASS. Take screenshots of `/` at 390 px and 1440 px and look at them: hero backdrop and logo, numbered Top 10, rails with arrows on hover, bottom tab bar on mobile, no horizontal overflow.

- [ ] **Step 7: Commit**

```bash
git add -A src/routes src/lib/server/services tests scripts
git commit -m "feat(home): cinematic home at /, landing moved to /about, rails and hero carousel"
```

---

### Task 11: Documentation and project state

**Files:**

- Modify: `PROJECT.md` (root URL statement), `ARCHITECTURE.md` (repository map: `src/lib/components/ui` kit, `src/lib/tmdb`, `src/lib/navigation`; application surfaces: `/`, `/about`, `/kit`; data model: watch providers), `CHANGELOG.md` (Unreleased), `ROADMAP.md` (slices 1–3 `verified` with evidence, 4–8 `in_progress`), `.agents/SESSION_STATE.md` (next action = next plan: movie detail + browse + search).

- [ ] **Step 1: Update the documents** with the facts from this plan (no claims without the gate output from Task 10 Step 6).

- [ ] **Step 2: Format and commit**

```bash
pnpm exec prettier --write PROJECT.md ARCHITECTURE.md CHANGELOG.md ROADMAP.md .agents/SESSION_STATE.md
git add PROJECT.md ARCHITECTURE.md CHANGELOG.md ROADMAP.md .agents/SESSION_STATE.md
git commit -m "docs: record premium foundation slices (data, kit, home)"
```
