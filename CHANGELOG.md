# Changelog

All notable Alan Database V3 changes are recorded here. The public status page
renders this same source, so repository history and product-facing patch notes
stay aligned.

The format follows Keep a Changelog principles. V3 remains pre-release until
its launch gates are explicitly verified.

## [Unreleased]

### Major Updates

- Movie detail page rebuilt on the kit: cinematic header (backdrop, poster, TMDB title logo, tagline, meta, genre chips), Play trailer / Watchlist / Favourite / Watched / Rate / Share with the real saved state and toasts worded from the server result, five tabs (Overview with key crew and Where to watch FR/US from JustWatch data, Cast & crew, Videos, Details with keyword chips, Saga & similar), a reviews list, and shareable `#tab` links.
- Trailer player: a full-screen dialog playing official YouTube trailers through the IFrame API on `youtube-nocookie.com` (the stage is created by the API, never by a hand-written iframe). Controls sit in an apron below the stage: play, ±10 s, seek with the buffered range, volume, captions, speed, fullscreen, keyboard shortcuts (`?` lists them), resume on this device for 90 days, Back and Escape close it, focus returns to the Play button; a settings sheet (Video, Audio, Subtitles, Playback) says why a row is unavailable for YouTube.
- New cinema home at `/`: full-bleed featured carousel (backdrop, TMDB title logo, meta, actions, auto-advance with pause and swipe), numbered Top 10, Trending, Top-rated, genre chips, TV and watchlist rails. The former landing page moved to `/about`.
- New UI kit under `src/lib/components/ui` (Button, Chip, RatingBadge, MetaChips, Section, Rail, RankedRail, PosterCard, BackdropImage, HeroCarousel, TopBar, BottomTabBar) built on new tokens (type scale, elevation, motion, layering, safe areas), showcased at `/kit`.
- Mobile navigation: a fixed bottom tab bar (Home, Movies, TV, Search, Library) with safe-area padding replaces the hamburger menu; the top bar turns solid on scroll.
- Rebuilt the public Status surface as the operational and release-information centre for Alan Database.
- Restored the public movie discovery pipeline after a malformed SQL visibility predicate made catalogue reads fail.
- Added persistent owner/admin/member authorization with one-time invitations,
  revocable sessions, audit events, and database-enforced single-owner identity.
- Combined the two diverged lines of the project on the V5 working branch:
  the V3 hardened line (`agent/v3-foundation-core` plus the 2026-10-08 audit) and
  `main`'s Movie Picker. The picker is available to signed-in accounts at
  `/cinema/picker` and now follows the V3 content, access, and read-safety rules.

### Minor Updates

- UI kit additions: Tabs, Dialog, Sheet, Slider, Tooltip, PersonCard, TrailerFacade, ProviderLogo, StarRating (bits-ui RatingGroup, half stars), ResumeBar, PlayerShell / PlayerSettings / ShortcutHelp; BackdropImage gains `animate` and `priority`, PosterCard can render a link-less frame; all shown on `/kit`.
- Detail reads: `getMovieById` loads watch providers, up to 30 crew rows and keyword names; new bounded `similarMovies` and `collectionMovies` reads under the standard-content predicate.
- One server helper (`applyInteraction`) backs the `logInteraction` action on both `/movies/catalog/[id]` and `/movies/[id]` and returns the saved state.
- Poster cards reserve their aspect ratio, blur up from a tiny placeholder, use `srcset`, and fall back to a titled frame when artwork fails to load.
- Worker: `sync-top-rated` command; ingestion now stores TMDB watch providers (FR, US) and title logos.
- Added a Picker link to the cinema header and mobile menu, and made the picker API
  expand `preset` server-side (previously `?preset=` was accepted but ignored).

- Added a server-side UptimeRobot v3 integration for monitor 803733856 with 30-day uptime, incident, downtime, and response-time metrics.
- Added an original fluid status animation using GPU-friendly transforms, responsive composition, and a reduced-motion fallback.
- Made discovery rails independent so a failed optional query no longer takes down the complete page.
- Standardized local and CI tooling on Node 24 and pnpm 11.15.1 and applied
  reviewed patch-level framework updates.
- Made the Prettier gate line-ending-neutral so unchanged LF-indexed files do not
  fail solely because Git checks them out as CRLF on Windows.
- Standardized remaining server-only secret reads on runtime `process.env`, avoiding
  invalid generated imports when a Windows workspace path contains an apostrophe.

### Fixed

- Removed the `PlayerSheet` placeholder and the Browse hero "Playback status" button; the detail page no longer reads raw TMDB field names.
- Kit Tabs scroll only their own list on selection; `scrollIntoView` had also moved the page to the tab list on load.
- `/tv` overview text used a hard-coded colour with 3.87:1 contrast; it now uses the secondary text token (axe serious violation).
- Independent review of the foundation slices (0 critical, 10 important, all fixed test-first): the movie detail page no longer covers the top bar; the footer clears the mobile tab bar; Discover and Picker are reachable on phones; the radar logo is back in the top bar; the featured carousel has a pause control, stays silent for screen readers while rotating, crossfades backdrops, reserves the logo height and keeps its action row in place; the hero watchlist button shows the real saved state and words its toast from the server; the home watchlist rail is capped at 20; hero copy gets a local vignette for contrast; ranked posters keep the full poster width and two-digit ranks fit; browser tests wait for hydration.
- Ran the overnight V3 audit (2026-10-08) on an isolated task worktree and fixed
  the safe subset: Discover now strips classification keywords through the shared
  post-filter, `searchMovies` escapes LIKE wildcards and clamps trending/top-rated
  bounds, review reads project only public author columns, catalogue override
  writes are length/format-bounded, trailing-slash API auxiliaries keep their
  intended session posture, session-cookie deletion mirrors cookie attributes,
  the Telegram webhook compares secrets in constant time, and API credentialed
  CORS is sent only with an allowed origin.
- Corrected rating attribution from IMDb to TMDB catalogue data (no fabricated
  fallbacks), labelled the TV Top 50 an editorial snapshot, and aligned the
  disclaimer with the enforced adult-quarantine policy.
- Hardened playback quarantine: the global safety test now scans every blocked
  pattern, and the player container no longer accepts trailer/custom-URL props.
- Improved keyboard and screen-reader access (hub `<main>` landmark, scrollable
  cast/genre regions, labelled rating buttons, single-announce poster fallback,
  distinct dialog-dismiss control) and made landing actions wrap at 320px.
- Guarded the dual-repo sync script against implicit `main` pushes and aligned
  the worker test command/engines with the root Node 24 pin.

- Preserved deep-linked search queries in the interactive search field and
  enforced same-origin form mutations consistently in development and deployed
  runtimes.
- Fixed `/discover` returning HTTP 500 while `/movies` silently displayed an empty catalogue.
- Fixed `/tv` becoming blank because Nathan for You and True Detective shared the same keyed TMDB identifier.
- Fixed `/tools/json` crashing during hydration because a derived value mutated component state.
- Fixed the worker TypeScript build and restored the optional Meilisearch client.
- Fixed static document metadata overriding route-specific titles and descriptions, including the Status page title.
- Fixed anonymous catalogue pagination, unstable/unbounded catalogue and discover
  queries, quarantined-person metadata exposure, invalid interaction writes, and
  merge loss of activities, watch dates, notes, and spoiler state.
- Fixed tablet/mobile header and action clipping, command palette dead links and
  keyboard behavior, invisible skip links, selected-filter semantics, cached
  poster hydration, empty image requests, false clipboard success, reduced
  motion, and small-text contrast.

- Fixed the standard-content visibility predicate failing inside relational
  queries (`db.query.movies.findMany/findFirst`). The relational builder re-aliased
  its `movie_keywords` columns to `movies`, so PostgreSQL rejected the query with
  `column movies.movie_id does not exist`. Nineteen call sites use it. Reproduced
  and fixed with a PGlite-backed test on the repository's pinned Drizzle; not yet
  observed against a hosted database.
- Fixed the picker recommending quarantined movies: it filtered only on
  `adult = false`, so custom (non-TMDB) rows and rows with known explicit keywords
  could be recommended. It now uses the shared standard-content predicate.
- Fixed the picker usually reporting no director: the crew relation took an
  unordered first five rows and then looked for the director among them.
- Fixed the production build, which failed on `main` since the picker landed
  because a browser component imported a runtime value from `$lib/server`.
  Presets and types now live in client-safe `$lib/picker/`.
- Fixed the picker page being public while every call it makes required a session;
  `/cinema/picker` is now an authenticated route.
- Fixed sign-in, registration and admin access mutations failing on a real database:
  the rate limiter embedded JavaScript `Date` objects in a raw SQL template, and
  postgres-js (the application driver) cannot serialize them, so every call threw
  `ERR_INVALID_ARG_TYPE` before reaching PostgreSQL. Timestamps now go through the
  column encoder. Reproduced with a statement-parameter test, then confirmed end to end
  (first owner, access control, second owner refused, sign-out/sign-in) against an empty
  database through the real driver. The PGlite-based tests missed it because the PGlite
  driver accepts `Date` values.
- Fixed server diagnostics hiding the real database error: `safeDiagnostic` cut the
  long "Failed query: ..." message at 350 characters before the underlying PostgreSQL
  `cause` appeared. The cause (with its SQLSTATE) now leads, still redacted and bounded.

### Security

- The cinema CSP `frame-src` now allows exactly `https://www.youtube-nocookie.com` (previously `'none'`); any incoming `frame-src` is replaced, never merged. `player-safety.test.ts` still scans every source file for iframes and mirrors, allows the embed host string only in the IFrame API adapter and the CSP module, and requires the adapter to build the player through `new YT.Player`.
- Removed the hard-coded Telegram bot token and chat-ID fallback that `main` still
  shipped in `telegram.service.ts`. The token remains in public Git history and must
  be treated as compromised and rotated by the owner.
- Picker API input is validated and bounded: whitelisted filter keys, numeric and
  list limits, UUID movie ids, a fixed set of event actions, and small flat
  metadata. Clients can no longer create arbitrary `picker_<anything>` activity types.
- Picker reads are side-effect free: removed per-request IMDb/OMDb enrichment (up to
  one outbound call per candidate, a plaintext-HTTP URL carrying the API key, and
  database writes from a GET) and the activity row written on every recommendation.
- Removed two local PostgreSQL clusters from Git tracking while preserving the local files on disk.
- Added ignore rules for local database clusters and worker build output.
- Replaced raw database session tokens with SHA-256 digests while retaining random Secure, HttpOnly session cookies.
- Added durable, keyed login throttling by request address and account, with a one-time concurrency-safe owner setup flow.
- Strengthened owner setup validation and marked authentication pages as non-indexable.
- Applied private/no-store policy to every authenticated response, removed the
  unused public-read tracking cookie, disabled Gemini until privacy controls
  exist, and removed the unapproved VidZY/TMDB request-time demo.
- Serialized invitation creation/acceptance by normalized email, removed
  registration PII notifications, and made session validation reads side-effect
  free.
- Required owner permission for personal actions embedded in public catalogue
  pages and expire legacy raw-token sessions during authorization migration.

### Technical Improvements

- Pure, unit-tested player logic under `src/lib/player`: the `PlayerSource` contract, versioned preferences with default-merging, a resume store (90-day expiry, 50 entries), time formatting, the auto-hide reducer, the shortcut table and a controller exercised with a fake source; detail helpers (`pickTrailers`, `keyCrew`, `groupProviders`), PGlite tests for the new reads and a mocked loader test.
- E2E: `tests/detail.e2e.ts` (single heading, tabs by keyboard and hash, Where to watch, player open/close with at most one `youtube-nocookie` frame, 320 px, signed-out login links) plus detail-page cases in the responsive and axe suites; `tests/helpers.ts` finds a real film from Home.
- Migration `0005_movie_watch_providers` (additive, `IF NOT EXISTS`, covered by the PGlite migration test).
- Pure helpers with unit tests: TMDB image sets, formatters, rail scroll math, carousel rotation, navigation link matching, worker provider/logo selection.
- Playwright: `tests/home.e2e.ts` (bottom bar targets, desktop links, rail arrow); `/about` and `/kit` added to the responsive and axe suites; the E2E gate runs on the production preview.
- Migrated CI dependency policy to pnpm 11's strict `allowBuilds` map, with
  reviewed native builds allowed and the optional Sentry CLI script denied.
- Separated the data worker connection lifecycle from the SvelteKit runtime.
- Removed implicit seed-on-worker-start behavior and made worker database initialization lazy.
- Added an additive, fail-safe schema reconciliation migration for runtime tables and durable authentication throttling.
- Expanded GitHub Actions coverage to the V3 branch and added worker tests and builds to CI.
- Added regression coverage for generated visibility SQL, TV route identities, release-note parsing, and uptime status normalization.
- Removed inactive Netlify adapters/CLI/configuration and cleared all high-severity
  dependency advisories; Vercel remains the sole deployment adapter.
- Added additive authorization migration `0003_complete_skrulls.sql`, hardened
  migration prechecks/constraint reconciliation, isolated preview database URL
  selection, required explicit worker mutation targets, and added expiry-indexed
  rate-limit cleanup.

- Added database-backed tests that run committed migrations on an in-memory
  PostgreSQL (PGlite) via `createMigratedTestDatabase()`, covering the visibility
  predicate through both Drizzle query builders and the picker read path.
- Picker migration `0002_movie_picker.sql` was never registered in the Drizzle
  journal on `main`; it is now `0004_movie_picker_imdb` with snapshot and journal
  entry, idempotent (`IF NOT EXISTS`) for databases where it was applied by hand.
- Moved the deployment target to Netlify (the Vercel project is disabled): Netlify
  is the sole adapter, `netlify.toml` carries Node 24 and the baseline security
  headers, and `vercel.json` / `@sveltejs/adapter-vercel` are removed.
- Session cookie options (`Secure`, shared `.alandatabase.com` domain) are derived
  from the request URL instead of `VERCEL*` variables, which Netlify does not expose
  to functions at runtime. The preview-database guard reads Netlify's deploy context
  baked in at build time. The Netlify default host redirects to the canonical host.
- Raised the Vitest hook timeout to 60 seconds for database-backed tests.

### Known Issues

- The browser Sentry DSN is rejected by the ingest endpoint (HTTP 403 on every page); owner configuration.
- The top bar ⌘K hint sits below 4.5:1 contrast once the bar is in its scrolled state (pre-existing; deferred).
- The committed TV snapshot carries poster paths that no longer resolve on the TMDB CDN; those cards show the titled fallback until TV becomes database-backed.
- Review minors deferred to slices 4–8 (recorded in `ROADMAP.md`): reduced-motion only shortens durations, rail keyboard focus movement, carousel dot keyboard support, pinch-zoom on the hero, landscape safe-area gutters, `/about` canonical URL, `returnTo=/` falling back to `/movies`, number formatting just below a unit, migration `0005` rollback note (`DROP TABLE movie_watch_providers`).
- Hero trailer playback, movie detail, browse, search palette, TV/Discover/Picker/Library restyles are the next slices (`ROADMAP.md`).
- Migration `0004_movie_picker_imdb.sql` (three nullable `movies.imdb_*` columns)
  is additive and undeployed. Treat it like `0002`/`0003`: back up and review first.
- DNS for every production hostname still points to Vercel, whose project is
  disabled (HTTP 402); the Netlify site still serves an old pre-V3 build. Restoring
  the site needs the database migration decision, Netlify environment variables, a
  Netlify deploy, and the DNS move (see `docs/MISE_EN_LIGNE_NETLIFY.md`).
- The picker's IMDb rating columns are empty until an explicit, operator-run
  enrichment job exists, so it ranks on TMDB ratings. The curated rating list that
  `imdb.ts` held remains in Git history.
- The picker applies genre filters after fetching the top 240 rows by rating, so a
  narrow genre can return a small or empty pool.
- Signed-in accounts only: there is no guest picker. Opening it to anonymous
  visitors is a product decision (`proposed`).
- The leaked Telegram bot token and the old committed PGlite clusters remain in Git
  history; rotation and history cleanup are owner operations.
- UptimeRobot metrics require a server-only `UPTIMEROBOT_API_KEY`; the Status page falls back to live application and database probes when it is absent.
- Migrations `0002_wet_masque.sql` and `0003_complete_skrulls.sql` are prepared
  but have not been applied to any hosted database; they require a verified
  backup and the reviewed migration runbook before deployment.
- Hosted authentication now requires a high-entropy server-only `RATE_LIMIT_HASH_KEY` before this patch can be released.
- PostgreSQL cluster files still exist in Git history even though they are no longer tracked; history cleanup and credential/session rotation remain release operations.
- Hosted invitation and role operations remain disabled until migration rollout
  and end-to-end authorization verification are complete.
- Gemini recommendations remain unavailable until consent, timeout, quota,
  concurrency, retention, and deletion controls are implemented.
- Windows hosts without Developer Mode cannot create the function symlinks emitted by `adapter-vercel`; local validation uses equivalent junction aliases and Linux CI/Vercel remains the authoritative packaging gate.

## [3.0.0-alpha.1] - 2026-08-21

### Major Updates

- Established the V3 SvelteKit monolith, public Movies/TV catalogue, owner portal, API surface, and hostname-aware Status/Auth/API routing.
- Replaced the former dashboard-first entry with a Cinema-first public landing experience.

### Minor Updates

- Added local movie browse, search, discovery, detail, lists, interactions, TV snapshot, and catalogue administration surfaces.
- Added canonical routing for `alandatabase.com`, `www`, `api`, `auth`, `status`, and the Vercel production alias.

### Security

- Centralized server-side owner protection, private cache policy, cookie hardening, CORS restrictions, content quarantine, and secret-safe diagnostics.
- Removed arbitrary iframe playback, unsafe mirrors, public telemetry streaming, and read-time ingestion side effects.

### Technical Improvements

- Added the worker ingestion safety boundary, Sentry privacy controls, production hostname verification, and the V3 test baseline.
- Documented the product, architecture, operating rules, and prioritized roadmap at repository root.

### Known Issues

- V3 does not yet provide an approved source model, persistent TV episodes, playback progress, or cross-device resume.
- The runtime schema still requires additive migration reconciliation before any production schema change.
