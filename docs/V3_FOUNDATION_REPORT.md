# Movies / TV V3 Foundation Report

Audit date: 2026-08-19

Branch: `agent/v3-foundation-core` at `4ed0c75`

Base: `main` at `8867cfc`

This report is derived from the repository, Git history, and local verification. No deployed database, hosting dashboard, or external service was inspected.

## Executive summary

This is a SvelteKit monolith containing a public project/tools hub and an authenticated personal cinema. V3 adds an authentication baseline, adult warning, redesigned movie UI, infinite catalog loading, player sheets, and a live iframe viewer. The branch is clean, matches its remote, and is 21 commits ahead of `main` without divergence, so its Git ancestry is safe to continue.

It is not production-ready. Core private-cinema requirements are missing: approved sources, TV/episode data, playback progress, resume, and real playback history. `/live` and most APIs bypass the centralized guard. Unauthenticated search can expose adult title/artwork and mutate the DB on GET. Global catalog writes lack owner authorization. Fixed credentials and a service token are committed. Player paths use unapproved mirrors. Runtime schema and SQL migrations disagree. Unit tests pass, but lint, type-check, and build fail.

Decision: continue only on this branch, but do not deploy or merge it until P0 is complete.

## Architecture map

### Stack and layers

- SvelteKit 2.70, Svelte 5.56 runes, TypeScript, Vite 8.
- Tailwind CSS 4, project CSS tokens, and Bits UI-derived primitives.
- SvelteKit routes/actions -> server services -> Drizzle ORM -> PostgreSQL.
- Separate `worker` workspace for TMDB ingestion and optional Meilisearch indexing.
- Vercel adapter selected; a conflicting Netlify configuration remains committed.

`src/hooks.server.ts` loads sessions, assigns A/B tests, attempts owner bootstrap, guards selected paths, and sets private cache headers. Services cover movies, TV, interactions, AI, Telegram, and telemetry.

### Routes

| Surface     | Routes                                                                                            | Current status                                                    |
| ----------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Public hub  | `/`, `/projects`, `/setup`, `/status`, `/tools/*`                                                 | Setup/status expose operational metadata; status calls TMDB.      |
| Auth        | `/auth/login`, `/auth/register`                                                                   | Registration is environment-gated.                                |
| Cinema      | `/movies*`, `/tv*`, `/discover`, `/search`, `/my/*`, `/disclaimer`                                | Protected only when included in `cinema-access.ts`.               |
| Live        | `/live`                                                                                           | Not classified as protected.                                      |
| APIs        | `/api/ai/chat`, `/api/movies/catalog`, `/api/search`, `/api/telegram/webhook`, `/api/telemetry/*` | Central guard does not classify `/api`; only AI self-checks auth. |
| Non-product | `/demo/*`, `/sentry-example-page`                                                                 | Still shipped publicly.                                           |

Svelte route groups such as `(cinema)` are not URL segments. Current TOP 10 links to `/cinema/movies/*` are broken after proxy route deletion.

### Authentication and authorization

Passwords use salted `scrypt`; session tokens use 32 random bytes and DB-backed expiry. The cookie is HttpOnly/SameSite=Lax, but `Secure` depends on both production and `VERCEL=1`. Role is an untyped `settings.isAdmin` value. Global catalog edit, custom creation, and merge do not enforce it. There is no invite or normalized role model.

### Database

Global entities: collections, movies, people, genres, keywords, companies, videos, cast, and crew. User-owned entities: sessions, movie interactions, lists/items, reviews, activities, and AI chats. Useful FKs and uniqueness constraints exist.

Missing core entities: TV shows, seasons, episodes, approved media sources/provenance, playback events, and per-user progress. `watched` is a manual interaction, not playback history.

Committed migrations do not create all runtime structures, including `users.settings`, activities, and AI chat sessions. `ensureTablesExist` seeds; it does not migrate.

### Data and player flow

Movie reads use PostgreSQL but missing IDs/searches can call TMDB and ingest asynchronously. Thus GET/search can mutate state and create external cost. TV is a hard-coded Top 50 enriched live from TMDB.

The active movie UI opens `PlayerSheet`; separate TV and `StreamPlayerContainer` implementations construct other third-party iframe URLs. `/live` accepts an arbitrary URL. There is no approved-source table, allowlist, source health, bounded timeout, progress capture, or resume.

### External services and environment

| Service     | Variables                                              | Risk/gap                                                               |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| PostgreSQL  | `DATABASE_URL`, `POSTGRES_URL`, `PREVIEW_DATABASE_URL` | Preview URL wins; example is incomplete; migration drift.              |
| TMDB        | `TMDB_API_KEY`, `TMDB_READ_TOKEN`                      | Unbounded reads/ingestion paths.                                       |
| Meilisearch | `MEILI_HOST`, `MEILI_MASTER_KEY`                       | Optional worker; Compose credentials are dev-only.                     |
| Gemini      | `GEMINI_API_KEY`                                       | Personal data sent externally without defined consent/retention/rates. |
| Telegram    | token, webhook secret, chat config                     | Committed fallback token; webhook fails open when secret absent.       |
| Sentry      | plugin/instrumentation variables                       | Missing-token build warnings; public example route.                    |

`.env.example` omits several variables and hosting assumptions. README previously named `VITE_TMDB_API_KEY`, while code correctly reads server-only `TMDB_API_KEY`.

### Deployment and CI

The active adapter is Vercel, but `netlify.toml` expects a Netlify `build` output. CI uses Node 20/pnpm 9 only for `main`; Netlify declares Node 22. E2E builds before previewing, so the current build failure blocks it. CI provisions no DB/services/environment.

## Branch analysis

- `HEAD` equals `origin/agent/v3-foundation-core`.
- Merge-base is current `main`; `main...HEAD` is `0 21`.
- Diff: 44 files, +1,949/-1,982.
- Twelve nested `/cinema/*` proxy files were deleted.
- Foundation work includes auth tests/guarding, registration gate, adult warning, mobile detail restyle, infinite catalog, Tailwind fixes, and direct player opening.
- Risk/dead areas include duplicate TV/player paths, demo/Sentry/telemetry surfaces, deleted aliases still linked, and extensive whitespace errors.

The branch is Git-safe to continue but deployment-unsafe.

## Product and UX review

Current flow:

- `/movies`: hero, Top 10, Trending, Top Rated; no Continue Watching or personal recommendations.
- Detail: lightweight metadata and Play; credits always empty; missing interaction controls.
- Playback: third-party iframe sheet without dependable loading timeout, retry, fallback, focus handling, progress, or history.
- `/my/films`: watched/watchlist/favorite interactions, not playback resume/history.
- Discover: fixed popularity groups and a random-per-request item, despite “tailored/daily” language.
- TV: static list plus live TMDB enrichment; detail defaults to S1E1 without episode/progress data.

Strengths: coherent dark intent, reusable cards/posters, skip link, global focus-visible, reduced-motion handling, mobile-stacked detail, and some empty states.

Gaps obstructing the premium experience: unsafe player, broken links, blank load failures, misleading personalization, no resume loop, and fragmented navigation/player implementations.

## UI system, accessibility, and performance

The UI mixes zinc/black, emerald, gold, HSL/shadcn tokens, glass effects, emoji, and loud marketing labels. It needs one governed Swiss-OLED language.

Static findings requiring later browser measurement:

- Header is likely to overflow at 320px; global `overflow-x:hidden` masks it.
- Hero has a 560px minimum and non-wrapping CTAs.
- Personal grid uses `minmax(320px,1fr)` inside roughly 272px content width at 320px.
- Detail uses brittle `65vh`; images often request large/original TMDB assets without `srcset/sizes`.
- Player sheet lacks dialog semantics, focus trap, Escape close, focus restore, and 44px close target.
- Tabs/sorts lack ARIA state; search relies on placeholders; heatmap is inaccessible to keyboard/AT.
- No route-level bounded loading/error system; navigation progress is simulated.

No preview was launched because the production build fails. Overflow/performance statements are code-based predictions, not screenshots.

## Technical and security review

Positive foundations: strict TS configuration, server-side actions, service separation, DB FKs, session expiry, private headers on correctly classified cinema pages, and focused unit tests.

Verified P0 findings:

1. Request-time bootstrap creates a privileged account from committed fixed credentials and bypasses adult intent. Rotate credentials/sessions and replace it with explicit setup.
2. A production-looking Telegram token is committed. Revoke/rotate it immediately; do not repeat it in documentation.
3. Webhook auth is optional; anonymous POST can drive TMDB, ingestion, DB writes, and Telegram.
4. `/live`, search, catalog, and telemetry APIs bypass centralized auth. Catalog is explicitly public-cacheable.
5. Unauthenticated search can return adult title/artwork and background-ingest it.
6. Adult intent is split between `hasAcceptedAdultGate` and `adultEnabled`; direct detail/source checks are incomplete. Custom content is conflated with adult content.
7. Any authenticated user can edit/merge global catalog records; merge touches other users' related data.
8. Player paths use untrusted mirrors, broad iframe permissions, and missing/weak sandbox/referrer controls.
9. GET/search performs uncontrolled external calls and writes.
10. AI chat lookup/update/reset is keyed by chat cookie without also constraining `userId`; no defined consent, retention, or rate/body policy.

Other quality risks: high `any` use, duplicated paths, stale tests, 404 converted to 500 in detail load, silent blank browse failure, missing CSP/Permissions-Policy, and inconsistent deployment/package versions.

Unverified deployment assumptions: whether the token is active, actual host/env/TLS, deployed DB contents/migrations, CDN behavior, and external service configuration.

## Database migration and rollback approach

1. Take encrypted logical and schema-only backups; rehearse restore.
2. Introspect deployed schema and journal read-only.
3. Create reviewed additive migrations for current drift before new roles, visibility, sources, TV/episodes, and progress.
4. Quarantine ambiguous adult/custom rows by default.
5. Deploy compatibility-first code; backfill in bounded batches.
6. Validate counts, nulls, FKs, uniqueness, classification, and ownership.
7. Roll back app code/feature flags while leaving additive structures; forward-fix migrations. Do not drop metadata or rewrite IDs initially.

## Verification evidence

| Command                                        | Result                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git status/branch/log/merge-base/rev-list/diff | Clean initial worktree; remote aligned; 21 ahead, 0 behind.                                                                                         |
| `pnpm run test:unit -- --run`                  | PASS: 5 files, 12 tests.                                                                                                                            |
| `pnpm run check`                               | FAIL: 2 DB connection-string type errors; 2 `/live` warnings.                                                                                       |
| `pnpm run lint`                                | FAIL at Prettier: 178 files.                                                                                                                        |
| `pnpm exec eslint .`                           | FAIL: 5 errors, 359 warnings.                                                                                                                       |
| `pnpm run build`                               | FAIL after 995 modules: generated private-env import path parse error on this Windows apostrophe-containing path; also `/live` and Sentry warnings. |
| E2E                                            | NOT RUN: web server command begins with failing build; specs are also statically stale.                                                             |
| `git diff --check main...HEAD`                 | FAIL: extensive trailing whitespace.                                                                                                                |

Unit success does not establish end-to-end security. No deployed service, DB, real browser, mobile device, accessibility scanner, or external source was tested.

## Prioritized roadmap

### P0 — blockers and risks

| Recommendation                           | Why / areas / user impact                                               | Risk                       | Acceptance criteria and validation                                                                                   | Rollback                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Rotate secrets; remove request bootstrap | Prevent known owner access and anonymous DB mutation; auth/hook/hosting | High coordination          | No fixed secret; requests never create users; secret scan + fresh-DB/anonymous tests + session invalidation evidence | Disable setup; restore backup only, never old credentials |
| Default-deny cinema APIs and `/live`     | Restore privacy; access rules, endpoints, cache headers                 | Medium regression          | Anonymous matrix returns 401/redirect; private/no-store; explicit public allowlist; route integration tests          | Revert allowlist only without reopening writes            |
| Fail-close cost integrations; pure GET   | Stop abuse/writes/cost; Telegram/search/catalog/TMDB                    | Medium                     | Missing secret unavailable; caller allowlist, bounds/rates; GET produces no DB writes; mock/spies verify             | Disable integrations                                      |
| Quarantine mirrors/arbitrary URLs        | Safe, truthful playback; all player/live paths and headers              | High playback availability | Approved HTTPS sources only; explicit unavailable state; CSP/sandbox/referrer; malicious URL/timeout browser tests   | Playback-unavailable flag                                 |
| Enforce adult isolation end-to-end       | Prevent search/detail/artwork/cache leakage                             | High classification        | Default deny; separate explicit intent; direct IDs cannot bypass; custom separate; auth/intent fixture matrix        | Disable adult feature; keep quarantined                   |
| Require owner role for global mutation   | Protect catalog and users' data                                         | Medium migration           | Invite cannot mutate; central server owner guard; merge dry-run/audit; integration tests                             | Disable admin mutations                                   |
| Reconcile migrations                     | Prevent deployment/data loss                                            | High data                  | Backup/restore rehearsed; drift clean; fresh DB and production-clone migration pass                                  | Roll back code/flags; retain additive schema; forward-fix |
| Restore check/lint/build/CI              | Establish trustworthy baseline                                          | Medium cleanup             | All pass on supported clean clone and V3 CI                                                                          | Revert scoped cleanup commits                             |

### P1 — usable V3 core

| Recommendation                              | Why / areas / user impact                 | Risk            | Acceptance criteria and validation                                                                         | Rollback                              |
| ------------------------------------------- | ----------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Add approved sources, TV/episodes, progress | Enables reliable cross-device resume      | High foundation | Per-user movie/episode position, completion, provenance, bounded writes; migration/service/two-session E2E | Feature flags; preserve additive rows |
| Consolidate browse/detail/player            | Fix broken paths and duplicate playback   | Medium          | Every card reaches detail; one accessible player; bounded retry/unavailable; click/failure E2E             | Compatibility alias/player flag       |
| Continue Watching + truthful history        | Delivers central private-cinema loop      | Medium          | Accurate resume; completion moves to history; clear empty/errors; cross-device E2E                         | Hide surfaces; preserve progress      |
| Integrate watchlist/favorite/watched/lists  | Practical organization from browse/detail | Low-medium      | Server-confirmed persistence; failure reverts UI; ownership tests/E2E                                      | Remove controls only                  |
| Truthful recommendations                    | Remove fake personalization               | Low             | Editorial labels; deterministic daily; AI opt-in/bounds; query/date tests                                  | Revert copy/query                     |

### P2 — premium quality

| Recommendation               | Why / areas / user impact | Risk       | Acceptance criteria and validation                                                                             | Rollback               |
| ---------------------------- | ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Govern one Swiss-OLED system | Calm visual consistency   | Medium     | One palette/type/spacing/CTA; visual inventory/snapshots                                                       | Token/component revert |
| Responsive hardening         | iPhone-first usability    | Medium     | No overflow at 320; 44px targets; safe areas/dynamic viewport/responsive images; viewport matrix + real iPhone | Component revert       |
| WCAG 2.2 AA pass             | Keyboard/VoiceOver access | Low-medium | Browse/play/close restores focus; semantic states; no serious axe issues; zoom reflow; axe/manual tests        | Component revert       |
| Honest states/performance    | No blank/brittle flows    | Low        | Bounded load/error/retry; no fake progress; measured budgets                                                   | Feature/component flag |
| Modern QA matrix             | Prevent regressions       | Low        | Current auth/adult/core/mobile/keyboard/failure tests; V3 CI                                                   | Test-only revert       |

### Later

- Social graph/public lists: outside private owner-focused scope.
- Microservices: no demonstrated need; added operational cost.
- Automated bulk/adult ingestion: defer until authorization, provenance, classification, budgets, and review exist.
- Advanced AI personalization: defer until deterministic browse/resume/lists and consent policy work.
- Native clients: responsive web and iPhone Safari reliability first.

## Approval gate

Stop before broad implementation. Recommended first approved phase: credential incident containment plus default-deny route/API protection, without schema mutation unless separately reviewed. Every phase must declare scope and acceptance criteria, use a coherent commit, run relevant verification, and report rollback.
