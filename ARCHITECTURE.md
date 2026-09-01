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

The Vercel project serves one SvelteKit deployment through the configured
production hostnames. Hostname routing is implemented in `src/hooks.ts` and
`src/lib/host-routing.ts`; it preserves the existing route tree instead of
creating parallel applications:

- `alandatabase.com` is the canonical public host.
- `www.alandatabase.com` and `alans-database.vercel.app` redirect to the
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
CORS, and production cookie policy before route handling. `vercel.json` mirrors
the non-sensitive security headers at the Vercel edge so static assets receive
the same baseline. Static assets, `_app` files, query strings, and existing API
paths are left untouched.

## Stack

- SvelteKit 2.70, Svelte 5.56 runes, TypeScript 5.9 in strict mode, and Vite 8.
- Tailwind CSS 4 through the Vite plugin, project CSS variables in `src/app.css`, and Bits UI/shadcn-style primitives.
- Drizzle ORM 0.45 with `postgres-js` and PostgreSQL.
- Vitest for colocated server/component tests; Playwright for browser tests in `tests/`.
- Sentry client/server instrumentation through `@sentry/sveltekit`.
- Vercel adapter selected in `svelte.config.js`.
- Node 24 is the runtime baseline; the worker uses `tsx`, and pnpm 11.15.1 is
  pinned as the repository package manager.

## Repository map

| Path                      | Responsibility                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/routes/(hub)`        | Public vault/status plus the owner-only admin and setup surfaces. Route groups do not appear in URLs.    |
| `src/routes/(cinema)`     | Public catalogue/detail pages, owner-only personal/playback operations, and the session auth portal.     |
| `src/routes/api`          | Public API metadata/health, owner-gated cinema APIs, plus the separately authenticated Telegram webhook. |
| `src/lib/components`      | Layout, movie/player, and reusable UI components.                                                        |
| `src/lib/server/auth`     | Password/session helpers and centralized route classification.                                           |
| `src/lib/server/policies` | Fail-closed content visibility policy.                                                                   |
| `src/lib/server/queries`  | Bounded local read models such as search.                                                                |
| `src/lib/server/services` | Movie, TV, interaction, owner-scoped Alan Score, AI/Telegram, and related application logic.             |
| `src/lib/server/db`       | Drizzle schema, connection, seed data, and the misleading legacy `ensureTablesExist` helper.             |
| `drizzle`                 | Generated PostgreSQL migration SQL and metadata.                                                         |
| `worker`                  | TMDB metadata ingestion, ingestion safety checks, and optional search-index setup.                       |
| `tests`                   | Playwright E2E specifications.                                                                           |
| `docs` / `Artifacts.MD`   | Audit and historical discovery; not all claims describe current code.                                    |

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
private/no-store headers, and cinema uses a CSP with `frame-src 'none'`.

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

## Alan Score

`src/lib/alan-score.ts` is the single typed definition of the seven dimensions,
their `20/15/10/15/10/15/15` weights, accepted half-step values, calculation,
coverage, status, and tag normalization. Only rated dimensions contribute to the
weighted denominator. The computed result is rounded to one decimal.

`movie_personal_scores` stores one row per user/movie with database range,
half-step, result-state, foreign-key, and unique-ownership constraints. The
additive `0004_optimal_karma.sql` migration is safe to re-run against a fresh
preview baseline. `alan-score.service.ts` resolves only standard visible movies,
recalculates every write server-side, and scopes reads, upserts, and deletes by
the authenticated user ID.

The canonical `/movies/[id]` load omits the personal payload entirely unless the
persistent owner role is present. Its named save/reset actions enforce that same
owner boundary before reading form data. Existing `user_movie_interactions.rating`
values are not converted or deleted; the old entry control is removed and an
existing value may be displayed only as `Legacy rating`. Catalog duplicate
merges move the score with its movie and, on conflict, preserve target values,
fill only missing dimensions, and recalculate the result.

## Application surfaces

- `/movies`, `/movies/catalog`, `/search`, and `/discover` read the approved local movie catalog.
- `/movies/[id]` renders local metadata and an explicit playback-unavailable sheet.
- `/my/films`, `/my/lists`, and `/my/settings` manage user-owned interactions, lists, statistics, and settings.
- `/tv`, `/tvshow`, and `/tvshows` share a committed in-code TV snapshot; TV has no database persistence or real episode catalog.
- `/live` is a protected compatibility surface that accepts no URL and embeds nothing.
- `/api/search` and `/api/movies/catalog` are bounded local reads.
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

Playback components render `PlaybackUnavailable`; runtime safety tests prohibit iframe tags and known mirror domains. The cinema CSP denies all frames. Approved source storage, health checks, player transport, progress capture, and fallback logic are future work.

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
`RATE_LIMIT_HASH_KEY`. Vercel supplies `VERCEL`, `VERCEL_ENV`, and `NODE_ENV`;
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
- `pnpm test:unit -- --run` — Vitest tests under `src`.
- `pnpm --dir worker test` — ingestion safety tests.
- `pnpm lint` — repository-wide Prettier then ESLint.
- `pnpm test:e2e` — Playwright against a local production preview, or against
  `PLAYWRIGHT_BASE_URL` when verifying an external deployment.
- `pnpm test:production` — production hostname, routing, CORS, and header smoke
  checks.
- `pnpm build` — Vite/SvelteKit production build using the Vercel adapter.

Current verification evidence belongs in `ROADMAP.md` or a task handoff rather
than this architectural reference. The repository-wide Prettier baseline and
current public/owner Playwright assumptions are maintained by the quality
commands above. A Vite/Rolldown parser defect still affects builds from the
legacy Windows directory whose name contains an apostrophe; build validation is
therefore also run from a neutral-path clean checkout and by Vercel. On Windows
hosts without Developer Mode, the Vercel adapter's final function aliases also
require a junction-compatible validation harness; the unchanged Linux CI/Vercel
build remains the authoritative packaging gate.

GitHub Actions runs lint, check, app/worker tests, Chromium E2E, and app/worker
builds for `main` and `agent/v3-foundation-core`, using Node 24 and pnpm 11.15.1. Authenticated
database integration still needs an isolated CI database fixture;
Meilisearch remains optional. Vercel is the sole configured deployment adapter;
stale Netlify tooling and configuration have been removed.
