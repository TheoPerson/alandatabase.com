# Architecture

Verified against `agent/v3-foundation-core` at `9e724ce` plus current working-tree P0 hardening edits on 2026-08-19. Provisional or incomplete areas are explicit below.

## System shape

The repository is a pnpm workspace with two runtime concerns:

1. A SvelteKit monolith serves the public hub, cinema UI, server actions, and HTTP APIs.
2. The `worker` package performs reviewed TMDB metadata ingestion and optional Meilisearch setup.

There are no microservices, message broker, separate API application, or native clients.

```text
Browser
  -> SvelteKit hooks (Sentry, device experiment, session, route policy, adult warning)
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
  mutation routes retain the session guard.
- `auth.alandatabase.com` redirects to the existing session login flow on the
  canonical host. Authentication remains the repository's session-based
  SvelteKit flow; no separate auth service is invented.

The server hook applies HTTPS canonicalization, security headers, narrow API
CORS, and production cookie policy before route handling. Static assets,
`_app` files, query strings, and existing API paths are left untouched.

## Stack

- SvelteKit 2.70, Svelte 5.56 runes, TypeScript 5.8 in strict mode, and Vite 8.
- Tailwind CSS 4 through the Vite plugin, project CSS variables in `src/app.css`, and Bits UI/shadcn-style primitives.
- Drizzle ORM 0.45 with `postgres-js` and PostgreSQL.
- Vitest for colocated server/component tests; Playwright for browser tests in `tests/`.
- Sentry client/server instrumentation through `@sentry/sveltekit`.
- Vercel adapter selected in `svelte.config.js`.
- Node-based worker using `tsx`; pnpm is the repository package manager.

## Repository map

| Path                      | Responsibility                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/(hub)`        | Public vault, projects, setup/status displays, and developer tools. Route groups do not appear in URLs.                             |
| `src/routes/(cinema)`     | Mixed route group: public session exceptions (`/auth/login`, `/auth/register`) plus cinema pages protected by the centralized hook. |
| `src/routes/api`          | Session-protected cinema APIs plus the separately authenticated Telegram webhook.                                                   |
| `src/lib/components`      | Layout, movie/player, and reusable UI components.                                                                                   |
| `src/lib/server/auth`     | Password/session helpers and centralized route classification.                                                                      |
| `src/lib/server/policies` | Fail-closed content visibility policy.                                                                                              |
| `src/lib/server/queries`  | Bounded local read models such as search.                                                                                           |
| `src/lib/server/services` | Movie, TV, interaction, AI/Telegram, and related application logic.                                                                 |
| `src/lib/server/db`       | Drizzle schema, connection, seed data, and the misleading legacy `ensureTablesExist` helper.                                        |
| `drizzle`                 | Generated PostgreSQL migration SQL and metadata.                                                                                    |
| `worker`                  | TMDB metadata ingestion, ingestion safety checks, and optional search-index setup.                                                  |
| `tests`                   | Playwright E2E specifications.                                                                                                      |
| `docs` / `Artifacts.MD`   | Audit and historical discovery; not all claims describe current code.                                                               |

## Request, authentication, and privacy flow

`src/hooks.server.ts` sequences Sentry with the application handler. It creates a long-lived anonymous device ID for A/B assignment, validates the `session` cookie, populates `event.locals`, and applies route policy.

`src/lib/server/auth/cinema-access.ts` protects the Movies/TV/discover/personal/search/live/API prefixes. Anonymous protected pages redirect to login; anonymous protected APIs return JSON 401. `/auth/login` and `/auth/register` are explicit public exceptions. `/api/telegram/webhook` is session-exempt because it requires Telegram configuration, a webhook secret, and an allowed chat ID.

Authenticated cinema pages also pass through a stored `hasAcceptedAdultGate` warning. This is a cinema-wide acknowledgement, not a complete separate adult-content authorization model. Global catalog edit/merge actions additionally require the current user to match `OWNER_USER_IDS` or `OWNER_EMAILS`. After resolution, cinema responses receive private/no-store headers and a CSP with `frame-src 'none'`.

Passwords use salted scrypt. Session tokens are 32 random bytes stored in PostgreSQL with a 30-day expiry. Authorization remains incomplete: there is no normalized role/invite schema, and env owner configuration is an interim boundary rather than a reusable invite model. Session-cookie `Secure` behavior also depends on the Vercel environment rather than every production host.

## Application surfaces

- `/movies`, `/movies/catalog`, `/search`, and `/discover` read the approved local movie catalog.
- `/movies/[id]` renders local metadata and an explicit playback-unavailable sheet.
- `/my/films`, `/my/lists`, and `/my/settings` manage user-owned interactions, lists, statistics, and settings.
- `/tv`, `/tvshow`, and `/tvshows` share a committed in-code TV snapshot; TV has no database persistence or real episode catalog.
- `/live` is a protected compatibility surface that accepts no URL and embeds nothing.
- `/api/search` and `/api/movies/catalog` are bounded local reads.
- `/api/ai/chat` sends filtered personal taste/review context to Gemini and stores bounded conversation history.
- `/api/telemetry/stream-play` and `/api/telemetry/events` return HTTP 410 until an approved source pipeline and owner-only redacted telemetry stream exist.
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

Committed migrations create the original movie/user model and later movie override/lock fields. The runtime schema additionally declares `users.settings`, `activities`, and `ai_chat_sessions` without matching committed SQL. Reconcile this against a backup and the real deployed schema before production changes.

## Playback and external integrations

Playback components render `PlaybackUnavailable`; runtime safety tests prohibit iframe tags and known mirror domains. The cinema CSP denies all frames. Approved source storage, health checks, player transport, progress capture, and fallback logic are future work.

The application retains shared TMDB types/code and loads artwork from the TMDB image CDN, but current application catalog reads are local-only. Reviewed metadata ingestion is an operator/worker responsibility: the worker calls TMDB and writes metadata only after a fail-closed adult/keyword safety decision. Its CLI validates supported commands and `ingest-id` arguments before database setup or network actions; the legacy seed helper still requires replacement with explicit reviewed migration/seed operations.

Other optional integrations:

- Gemini: authenticated chat/recommendations; personal ratings, favorites, and review text can leave the system.
- Telegram: notifications plus a fail-closed, allowlisted, local-search-only webhook.
- Sentry: browser/server error and trace instrumentation.
- Meilisearch: optional worker setup; application reads currently use PostgreSQL.

Server configuration is environment-driven. `.env.example` documents core database, owner identification, TMDB, Meilisearch, Gemini, and webhook values. Code also recognizes `POSTGRES_URL`, `PREVIEW_DATABASE_URL`, `ALLOW_OWNER_SETUP`, Sentry/Vercel variables, and additional Telegram routing variables not fully catalogued there.

## UI conventions

Svelte components use runes and route data is loaded server-side where practical. The cinema layout supplies the header/footer, skip link, command palette, toast container, and navigation progress indicator. Styling mixes Tailwind utilities, CSS variables, component-local CSS, and legacy hub styles.

The intended direction is high-contrast Swiss-OLED, but the implementation still mixes emerald/gold accents, glass effects, emoji, and marketing language. Global focus-visible and reduced-motion rules exist. Responsive and accessibility coverage remains incomplete, particularly at 320px, in the header/player dialog, tabs, charts, search controls, and loading/error states.

## Testing, build, and deployment

Root commands:

- `pnpm check` — Svelte/TypeScript diagnostics.
- `pnpm test:unit -- --run` — Vitest tests under `src`.
- `pnpm --dir worker test` — ingestion safety tests.
- `pnpm lint` — repository-wide Prettier then ESLint.
- `pnpm test:e2e` — Playwright; its config currently invokes `npm run build && npm run preview` internally.
- `pnpm build` — Vite/SvelteKit production build using the Vercel adapter.

Current verification evidence belongs in `ROADMAP.md` or a task handoff rather than this architectural reference. Repository-wide formatting/lint debt and stale Playwright assumptions remain. Local packaging is also affected by the Windows apostrophe-containing workspace path and Vercel symlink permissions, so it is not yet a clean release signal.

GitHub Actions runs lint, check, unit/E2E, and build for `main` pushes and PRs to `main`, using Node 20 and pnpm 9. It does not target the V3 branch or provision PostgreSQL/Meilisearch test services. `netlify.toml` remains committed with Node 22 and a `build` publish directory, but Netlify is not the active SvelteKit adapter. Deployment configuration is evolving and must not be inferred from that file alone.
