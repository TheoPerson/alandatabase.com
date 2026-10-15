# Architecture

Updated against the `v3-stabilization` task worktree on 2026-08-28. Provisional,
undeployed, or incomplete areas are explicit below.

## System shape

The repository is a pnpm workspace with two runtime concerns:

1. A SvelteKit monolith serves the public hub, cinema UI, server actions, and HTTP APIs.
2. The `worker` package performs reviewed TMDB metadata ingestion and optional Meilisearch setup.

There are no microservices, message broker, separate API application, or native clients.

```text
Browser
  -> SvelteKit hooks (Sentry, session, route policy, adult warning)
  -> route load/action or API handler
  -> server query/service/policy
  -> Drizzle ORM -> PostgreSQL

Operator worker
  -> TMDB client -> ingestion safety policy -> Drizzle/PostgreSQL
  -> optional Meilisearch configuration
```

## Production hostnames

The Netlify site serves one SvelteKit deployment through the configured
production hostnames (hosting moved from Vercel to Netlify on 2026-10-12 after the
Vercel project was disabled; DNS cutover is an owner operation). Hostname routing is implemented in `src/hooks.ts` and
`src/lib/host-routing.ts`; it preserves the existing route tree instead of
creating parallel applications:

- `alandatabase.com` is the canonical public host.
- `www.alandatabase.com`, `the-alans-data-base.netlify.app` and the retired
  `alans-database.vercel.app` redirect to the
  canonical HTTPS host.
- `status.alandatabase.com/` rewrites to the existing public `/status` page.
- `api.alandatabase.com/` rewrites to `/api`; `/health` rewrites to
  `/api/health`. API metadata and liveness are public, while catalog and
  mutation routes are owner-gated.
- `auth.alandatabase.com` is the first-class session login portal. It rewrites
  `/` to `/auth/login`, keeps the auth hostname for login/register/logout, and
  shares only the Secure, HttpOnly session cookie with sibling production
  hosts. Authentication remains the repository's session-based SvelteKit flow;
  no separate auth service is invented.
- The public cinema catalogue remains browseable without an account.
  Personal data and playback require the persistent `owner`; catalog mutations
  require `admin` or `owner`; system, role, and invitation operations require
  the single persistent `owner`. Members receive public browse only. Unknown
  roles fail closed.

The server hook applies HTTPS canonicalization, security headers, narrow API
CORS, and production cookie policy before route handling. `netlify.toml` mirrors
the non-sensitive security headers at the Netlify edge so static assets receive
the same baseline. Static assets, `_app` files, query strings, and existing API
paths are left untouched.

## Stack

- SvelteKit 2.70, Svelte 5.56 runes, TypeScript 5.9 in strict mode, and Vite 8.
- Tailwind CSS 4 through the Vite plugin, project CSS variables in `src/app.css`, and Bits UI/shadcn-style primitives.
- Drizzle ORM 0.45 with `postgres-js` and PostgreSQL.
- Vitest for colocated server/component tests; Playwright for browser tests in `tests/`.
- Sentry client/server instrumentation through `@sentry/sveltekit`.
- `@sveltejs/adapter-netlify` in `svelte.config.js` (Netlify is the sole deployment adapter).
- Node 24 is the runtime baseline; the worker uses `tsx`, and pnpm 11.15.1 is
  pinned as the repository package manager.

## Repository map

| Path                      | Responsibility                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/(hub)`        | Public vault/status plus the owner-only admin and setup surfaces. Route groups do not appear in URLs.                                                                                      |
| `src/routes/(cinema)`     | Public catalogue/detail pages, owner-only personal/playback operations, and the session auth portal.                                                                                       |
| `src/routes/api`          | Public API metadata/health, owner-gated cinema APIs, plus the separately authenticated Telegram webhook.                                                                                   |
| `src/lib/components/ui`   | The UI kit: one folder per component (`button`, `chip`, `rail`, `poster-card`, `hero-carousel`, `top-bar`, `bottom-tab-bar`, …) built on the tokens in `src/app.css`; showcased at `/kit`. |
| `src/lib/components`      | Layout, movie/player, and legacy components not yet moved into the kit.                                                                                                                    |
| `src/lib/player`          | Playback logic with no UI: the `PlayerSource` contract, the YouTube IFrame API adapter (the only file naming the embed host), controller, preferences, resume store, shortcuts, auto-hide. |
| `src/lib/catalogue`       | Plain data shapes (`PosterItem`, `HeroItem`) and pure detail helpers (`pickTrailers`, `keyCrew`, `groupProviders`) shared by loaders and the kit.                                          |
| `src/lib/tmdb`            | Client-safe TMDB image URL/`srcset` helpers and YouTube key validation.                                                                                                                    |
| `src/lib/navigation`      | Primary and tab link model with `isActivePath`.                                                                                                                                            |
| `src/lib/server/auth`     | Password/session helpers and centralized route classification.                                                                                                                             |
| `src/lib/server/policies` | Fail-closed content visibility policy.                                                                                                                                                     |
| `src/lib/server/queries`  | Bounded local read models such as search.                                                                                                                                                  |
| `src/lib/server/picker`   | Movie Picker: request validation, candidate query (standard-content policy), scoring, taste profile.                                                                                       |
| `src/lib/picker`          | Client-safe picker types and presets shared with the browser (never import `$lib/server` from the UI).                                                                                     |
| `src/lib/server/services` | Movie, TV, interaction, AI/Telegram, and related application logic.                                                                                                                        |
| `src/lib/server/db`       | Drizzle schema, connection, seed data, and the misleading legacy `ensureTablesExist` helper.                                                                                               |
| `drizzle`                 | Generated PostgreSQL migration SQL and metadata.                                                                                                                                           |
| `worker`                  | TMDB metadata ingestion, ingestion safety checks, and optional search-index setup.                                                                                                         |
| `tests`                   | Playwright E2E specifications.                                                                                                                                                             |
| `docs` / `Artifacts.MD`   | Audit and historical discovery; not all claims describe current code.                                                                                                                      |

## Request, authentication, and privacy flow

`src/hooks.server.ts` sequences Sentry with the application handler. It validates
the `session` cookie, populates `event.locals`, and applies route policy without
creating an unrelated anonymous identifier on public reads.

`src/lib/server/auth/cinema-access.ts` keeps catalogue, detail, TV, discovery,
and search pages public for browsing. Personal data and playback are owner-only;
catalogue mutation routes accept owners and admins; other non-public APIs are
owner-gated. Anonymous protected pages
redirect to `auth.alandatabase.com`; anonymous protected APIs return JSON 401.
Authenticated non-owners receive 403. `/auth/login`, `/auth/register`, and the
public API metadata/liveness routes are explicit public exceptions.
`/api/telegram/webhook` is session-exempt because it requires Telegram
configuration, a webhook secret, and an allowed chat ID.

Protected catalogue and owner cinema pages also pass through a stored `hasAcceptedAdultGate`
warning. This is a cinema-wide acknowledgement, not a complete separate
adult-content authorization model. Every authenticated response receives
private/no-store headers, and cinema uses a CSP whose `frame-src` allows exactly
`https://www.youtube-nocookie.com` (the trailer player, created through the official
YouTube IFrame API in `src/lib/player/youtube-source.ts`, the only file that may name
that host; `player-safety.test.ts` enforces it).

Passwords use salted scrypt. Session tokens are 32 random bytes; only SHA-256
digests are stored in PostgreSQL with a 30-day expiry. Production cookies are
Secure, HttpOnly, SameSite=Lax, and scoped to `.alandatabase.com` so the auth
portal can establish a session for sibling hosts. Preview cookies remain
host-only because a preview hostname cannot set the production apex domain.
Login attempts are durably limited by keyed address and account digests. Owner
setup is environment-enabled, limited to an empty user table, serialized by a
PostgreSQL advisory transaction lock, and audited in the creation transaction.
Persistent roles, account disabling, revocable sessions, digest-only one-time
invitations, and audit events are implemented. Invitation creation and
acceptance serialize by normalized email. The hosted migration and operational
rollout remain incomplete.

## Application surfaces

- `/` is the cinema home: a featured carousel (standard titles with a backdrop and at least 1000 votes, best rated first) and independent rails; one failing rail never blanks the page. `/about` is the former project landing page. `/kit` is the public, `noindex` UI kit showcase.
- `/movies` (Browse: genre, decade, minimum rating and sort filters through `catalogue.service.ts`), `/search`, the search palette (`/api/search`) and `/discover` read the approved local movie catalog. `/movies/catalog` is a permanent redirect to `/movies` with the same filters.
- `/movies/[id]` renders local metadata as a cinematic header, personal actions (watchlist, favourite, watched, rating through the shared `logInteraction` action), five tabs (overview with key crew and where to watch, cast & crew, videos, details, saga & similar, all bounded local reads under the standard-content predicate), reviews, and the full-screen trailer player.
- `/my/films`, `/my/lists`, and `/my/settings` manage user-owned interactions, lists, statistics, and settings.
- `/tv` and `/tv/[id]` read a committed in-code TV snapshot (ids, titles and artwork verified against TMDB on 2026-10-15); `/tvshow` and `/tvshows` redirect permanently to `/tv`. TV has no database persistence or real episode catalog.
- `/live` is a protected compatibility surface that accepts no URL and embeds nothing.
- `/api/search` and `/api/movies/catalog` are bounded local reads.
- `/cinema/picker` and `/api/picker/*` require a signed-in account. A recommendation reads only stored data (standard-content policy, stored `imdb_*` columns) and writes nothing; `/api/picker/events` records explicit user actions. Request bodies are validated in `src/lib/server/picker/request.ts`.
- `/api/ai/chat` returns HTTP 410 and sends no personal data externally until
  approved consent, abuse, timeout, retention, and deletion controls exist.
- `/api/telemetry/stream-play` and `/api/telemetry/events` return HTTP 410 until an approved source pipeline and owner-only redacted telemetry stream exist.
- `/admin` is an owner-only surface map for the production project hosts; it
  never displays secret values.
- `/status` performs live application/PostgreSQL probes, optionally reads
  30-day monitor history from UptimeRobot v3 with a server-only key, and renders
  `CHANGELOG.md` as the public release feed.
- The public hub is a separate surface with legacy tools/demo pages.

## Data model and data flows

The global movie catalog contains collections, movies, people, genres, keywords, production companies, videos, cast, and crew. User-owned data contains sessions, movie interactions, lists/items, reviews, activities, and AI chat sessions. Foreign keys and useful uniqueness constraints cover most joins.

Current boundaries:

- Application browse, search, catalog, and detail reads are local-only; they do not call TMDB or ingest.
- Standard surfaces require `adult=false`, a positive TMDB ID, loaded keyword classification, and no known explicit ingestion keyword. The policy fails closed.
- Raw `localOverrides` are not serialized to normal clients; only whitelisted text/date overrides are applied.
- Adult/custom rows remain stored but quarantined; visibility policy deletes no data.
- `movie_watch_providers` (migration `0005`, additive, re-runnable) stores TMDB/JustWatch availability per region and kind; the worker replaces a movie's rows on each ingest and stores the best English/neutral PNG title logo in `movies.metadata.logoPath`.
- TV data is an in-code snapshot, not part of the Drizzle schema.
- No media source/provenance, season/episode, playback event, or progress/resume table exists.

Committed migrations create the original movie/user model and later movie
override/lock fields. Additive migration `0002_wet_masque.sql` reconciles
`users.settings`, `activities`, `ai_chat_sessions`, and durable `rate_limits`
without deleting data; it fails if duplicate throttling rows require operator
review. It has been validated twice against an ephemeral PostgreSQL-compatible
database but has not been applied to a hosted database. Back up and inspect the
target before any production migration. Additive migration
`0003_complete_skrulls.sql` adds persistent roles, revocable sessions,
invitations, and auth audit events; it rejects multiple owners and
case-insensitive duplicate emails and enforces a single-owner index. It is also
prepared but not applied to a hosted database.

## Playback and external integrations

Official trailers play through the YouTube IFrame API on `youtube-nocookie.com` inside a full-screen dialog (`src/lib/components/ui/player`): the stage element is created by the API, never by a hand-written iframe, controls never overlay the embed, and only `src/lib/player/youtube-source.ts` and the CSP allowlist may name that host. Everything else renders `PlaybackUnavailable`; runtime safety tests prohibit iframe tags and known mirror domains across the whole source tree, and the cinema CSP `frame-src` allows exactly that one origin. Approved source storage, health checks, player transport, progress capture, and fallback logic are future work.

The application retains shared TMDB types/code and loads artwork from the TMDB image CDN, but current application catalog reads are local-only. Reviewed metadata ingestion is an operator/worker responsibility: the worker calls TMDB and writes metadata only after a fail-closed adult/keyword safety decision. Its CLI validates supported commands and `ingest-id` arguments before database setup or network actions; the legacy seed helper still requires replacement with explicit reviewed migration/seed operations.

Other optional integrations:

- Gemini: runtime chat is disabled with HTTP 410; no personal ratings, favorites,
  or review text are sent externally.
- Telegram: notifications plus a fail-closed, allowlisted, local-search-only webhook.
- Sentry: browser/server error and trace instrumentation with request payload,
  cookies, headers, query strings, DB values, and AI inputs/outputs disabled or
  scrubbed before transmission. Build-plugin telemetry is disabled.
- Meilisearch: optional worker setup; application reads currently use PostgreSQL.

Server configuration is environment-driven. `.env.example` documents the
non-sensitive shape of database access, one-time owner setup, rate-limit hashing,
UptimeRobot, TMDB, Meilisearch, Gemini, Sentry, and Telegram configuration,
including `POSTGRES_URL`, `PREVIEW_DATABASE_URL`, `OWNER_SETUP_KEY`, and
`RATE_LIMIT_HASH_KEY`. Netlify exposes its deploy context (`CONTEXT`) only during the build, so
`vite.config.ts` bakes it in for the preview-database guard, and session cookie
options derive from the request URL rather than platform variables;
no secret uses a client-visible `PUBLIC_` prefix.

Persistent authorization lives in PostgreSQL: `users.role` defines
`owner|admin|member`, `users.disabled_at` disables an account, sessions are
soft-revoked and touched, invitation tokens are stored only as SHA-256 digests,
and sensitive mutations append to `auth_audit_events`. The public registration
surface is closed unless a valid one-time invitation is supplied or an empty
database is being initialized with a high-entropy `OWNER_SETUP_KEY`.

## UI conventions

Svelte components use runes and route data is loaded server-side where practical. The cinema layout supplies the header/footer, skip link, command palette, toast container, and navigation progress indicator. Styling mixes Tailwind utilities, CSS variables, component-local CSS, and legacy hub styles.

The intended direction is high-contrast Swiss-OLED, but the implementation still
mixes emerald/gold accents, glass effects, emoji, and marketing language. Global
focus-visible, visible skip-link, dialog focus, reduced-motion, responsive action,
and selected-filter semantics exist. Broader authenticated browser, chart, and
screen-reader coverage remains incomplete.

## Testing, build, and deployment

Root commands:

- `pnpm check` — Svelte/TypeScript diagnostics.
- `pnpm test:unit -- --run` — Vitest tests under `src`. Database-backed tests use `createMigratedTestDatabase()` (`src/lib/server/testing/pglite.ts`): an in-memory PostgreSQL with every committed migration applied, so Drizzle relational queries run as real SQL.
- `pnpm --dir worker test` — ingestion safety tests.
- `pnpm lint` — repository-wide Prettier then ESLint.
- `pnpm test:e2e` — Playwright against a local production preview, or against
  `PLAYWRIGHT_BASE_URL` when verifying an external deployment.
- `pnpm test:production` — production hostname, routing, CORS, and header smoke
  checks.
- `pnpm build` — Vite/SvelteKit production build using the Netlify adapter.

Current verification evidence belongs in `ROADMAP.md` or a task handoff rather
than this architectural reference. The repository-wide Prettier baseline and
current public/owner Playwright assumptions are maintained by the quality
commands above. A Vite/Rolldown parser defect still affects builds from the
legacy Windows directory whose name contains an apostrophe; build validation is
therefore also run from a neutral-path clean checkout and by CI. The Netlify
adapter builds locally on Windows without Developer Mode; the Linux CI build
remains the authoritative packaging gate.

GitHub Actions runs lint, check, app/worker tests, Chromium E2E, and app/worker
builds for `main` and `agent/v3-foundation-core`, using Node 24 and pnpm 11.15.1. Authenticated
database integration still needs an isolated CI database fixture;
Meilisearch remains optional. `netlify.toml` mirrors the baseline security headers for static assets.
