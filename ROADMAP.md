# Movies / TV V3 Roadmap

Verified against `agent/v3-foundation-core` on 2026-08-21. States use the
canonical vocabulary in `AGENTS.md`.

Nothing below is `merged` to `main` or `deployed` unless explicitly labeled. The Product/Project Lead approves scope and phase transitions.

## `verified` — production hostname integration

- The Vercel production deployment serves the configured aliases for
  `alandatabase.com`, `www`, `api`, `auth`, `status`, and
  `alans-database.vercel.app`.
- The canonical apex is live over HTTPS; `www` and the Vercel hostname return
  permanent redirects to it without a loop.
- `status.alandatabase.com/` serves the existing public Status page, while
  `api.alandatabase.com/` and `/health` serve the API index and liveness probe.
- API catalog routes remain session-protected and reject an untrusted CORS
  origin. Static assets receive the same baseline security headers as dynamic
  responses.
- Release evidence is recorded by `pnpm test:production`, Playwright, Vercel's
  completed production build, and direct checks for apex/www/status/api/auth,
  HTTPS canonicalization, CORS, and private route containment.

## `verified` — V3 foundation outcomes

These outcomes are verified in the current V3 worktree/branch, not in production.

### Investigation and documentation

- Audited Git state, routes, services, schema/migrations, auth, data flows, playback, UI, tests, CI, and deployment configuration.
- Added `docs/V3_FOUNDATION_REPORT.md` and corrected the README's V3 positioning.

### P0.1 — private-route and runtime-secret containment

- Removed request-time creation of a fixed privileged account.
- Centralized protection and private/no-store behavior for cinema pages, `/live`, and APIs.
- Removed the committed Telegram fallback from runtime code; the webhook now requires configured secret/token/chat allowlist.
- Added route-policy and webhook regression tests.

External credential rotation, historical session invalidation, and deployment-state verification are not proven by repository code and remain P0 operations.

### P0.2 — playback containment

- Removed known third-party mirror iframes and arbitrary live-stream URLs.
- Replaced movie, TV, catalog, and live player surfaces with truthful unavailable states.
- Disabled playback telemetry, denied frame sources through CSP, restored canonical links, and added safety tests.

### P0.3 — local reads and standard-content quarantine

- Removed TMDB calls, ingestion, seeding, and notification side effects from browse/search/detail GET paths.
- Added bounded local queries and a central fail-closed standard-content policy.
- Quarantined adult-flagged, negative/custom, and known explicit-keyword rows across standard, personal, and AI contexts without deleting data.
- Sanitized local overrides, bound AI sessions to users, made TV reads local, and added privacy/integrity tests.

Evidence at `9e724ce`: `pnpm check` passed with 0 diagnostics; app unit tests passed 89/89; worker safety tests passed 10/10. This does not establish merge or deployment.

### P0.4 — interim owner and telemetry containment

- Added an environment-configured owner boundary for global catalog edit/merge actions using `OWNER_USER_IDS` and `OWNER_EMAILS`.
- Disabled `/api/telemetry/events` with HTTP 410 until an owner-only redacted event stream is designed.
- Hardened the worker CLI so unsupported commands and invalid `ingest-id` arguments exit before database setup or network work.

Current evidence: full app unit tests pass 109/109; `pnpm check` passes with 0
diagnostics; worker safety tests pass 11/11; repository lint has no errors. The
legacy apostrophe-containing Windows path still triggers a Vite/Rolldown parser
defect, so production-package proof also uses a neutral-path clean checkout and
Vercel.

### P0.5 — public entry experience

- Replaced the Vault OS dashboard as the first-arrival experience with a Cinema-first landing page.
- Added explicit project discipline signals for product, frontend, backend, responsive UX, SEO/hosting, security, and QA.
- Added page-level title, description, and social metadata for the public entry route.
- Live smoke check: `/` returned `200` with the new hero and discipline sections; `pnpm check` passed with 0 diagnostics.

### P0.6 — production access, telemetry, and release checks

- Kept safe catalogue browse public while owner-gating personal data,
  playback, setup, administration, and non-public APIs.
- Added first-class hostname routing for the canonical, status, API, and auth
  surfaces without duplicating the SvelteKit application.
- Corrected owner return paths, production/preview cookie scope, private cache
  policy, safe server diagnostics, and Sentry data minimization.
- Replaced stale/destructive Playwright flows and added non-destructive
  production host/CORS/header smoke verification.
- Established a repository-wide Prettier baseline and removed lint errors.

### P0.7 — operational status and pre-release hardening

- Rebuilt `/status` as a responsive public availability and release-notes
  surface backed by live application/database probes, optional UptimeRobot v3
  history, and the canonical `CHANGELOG.md` feed.
- Added an original transform-driven fluid status animation with a verified
  reduced-motion fallback and no horizontal overflow at 320 px.
- Fixed the malformed movie visibility predicate, independent discovery
  fallback, duplicate TV route identity, JSON tool hydration crash, and static
  metadata override.
- Removed two raw PostgreSQL clusters from Git tracking, ignored generated
  runtime/build files, and replaced stored raw session tokens with digests.
- Added keyed durable login throttling, one-time concurrency-safe owner setup,
  stricter setup validation, and Auth `noindex` metadata.
- Restored the worker TypeScript build, removed implicit seed-on-start, and
  separated its database lifecycle from SvelteKit.
- Prepared additive migration `0002_wet_masque.sql`; it passes two consecutive
  ephemeral migration runs and rejects duplicate throttling state, but has not
  been run against a hosted database.
- Expanded V3 CI triggers with PostgreSQL-backed E2E, app/worker tests, and
  app/worker builds.

Evidence: `pnpm check` passes with 0 diagnostics; app unit tests pass 127/127;
worker tests pass 11/11; lint passes; the worker build passes and the complete
SvelteKit/Vercel build passes from a neutral Windows validation path using
junction-compatible aliases for the adapter's Linux symlinks. Unmodified Vite
client/server compilation also passes; local Windows packaging without
Developer Mode stops only on adapter symlink creation. Playwright passes 12/12
against the local production preview. Host-header checks pass for apex, www
redirect, Status, API, API health, and Auth. This is local verification, not
deployment evidence; unchanged Linux CI/Vercel packaging remains required.

## `in_review` — V5 convergence (working branch `TheoPerson/V5-Alan-s-Data-Base`)

Not merged to `main`, not deployed. The repository had two diverged lines from
`8867cfc` (2026-08-14): the V3 hardened line (53 commits, never merged) and `main`
(Movie Picker, CI/format fixes, Netlify adapter). This branch merges the V3 tip
into `main`'s line (`f4a0931`) and brings the picker under the V3 rules.

Evidence on this branch (local, Node v26 / Windows): `pnpm check` 0 errors;
`pnpm test:unit -- --run` 41 files / 260 tests; worker tests 11/11;
`prettier --check` clean; `eslint` 0 errors (warnings are the pre-existing
baseline); `pnpm build` (Netlify adapter) exits 0.

Not verified: Playwright E2E, a build on Netlify itself (pnpm 11 support on
Netlify's build image is unconfirmed), any hosted database, and migrations
`0002`-`0004` outside PGlite. The `main` baseline before this work had a failing build, red lint and two
unit-test files that could not import.

Open items that need the Product Lead:

1. **Rotate the Telegram bot token** that `main` hard-coded (public repository, so
   treat it as exposed) and decide on Git history cleanup.
2. **Hosting**: decided on Netlify (Product Lead, 2026-10-12) because the Vercel
   project is disabled (HTTP 402 `DEPLOYMENT_DISABLED`). DNS still points to
   Vercel and the Netlify site still serves an old pre-V3 build; the cutover
   steps are in `docs/MISE_EN_LIGNE_NETLIFY.md`.
3. **Picker audience**: signed-in only (current, fail-closed) or a guest mode.
4. **Production database state of `main`**: confirm whether `0002_movie_picker.sql`
   was applied by hand before running any migration.
5. Which of the unmerged `codex/*` branches (`alan-score`, `global-release-calendar`,
   `tv-episode-notifications`; each parented on `agent/v3-foundation-core`) to take.

## `verified` — premium experience, slices 1–3 (data, UI kit, Home)

Spec: `docs/superpowers/specs/2026-10-12-premium-cinema-experience-design.md`;
plan: `docs/superpowers/plans/2026-10-12-premium-foundation-kit-home.md`.
Verified in this worktree on 2026-10-12, not merged, not deployed:

- `pnpm check` 0 errors; `pnpm test:unit -- --run` 290/290; worker tests
  16/16; ESLint 0 errors; Prettier clean; `pnpm build` (Netlify adapter)
  passes; Playwright 25/25 (`home`, `navigation`, `responsive` 320–1920 px,
  `accessibility` axe on `/`, `/about`, `/movies`, `/tv`, `/search`,
  `/auth/login`, `/status`, `/kit`) against the production preview.
- Local catalogue on the owner's machine (not in the repository): 178 movies
  with backdrops, 164 title logos, 1938 FR provider rows, 167 trailers.
- Screenshots of `/` and `/kit` at 390 px and 1440 px reviewed.
- Independent whole-branch review (fresh context, Opus): 0 critical, 10 important,
  24 minor. Every important finding fixed test-first in one pass; after it:
  `pnpm check` 0 errors, vitest 294/294, worker 16/16, Playwright 32/32 (adds
  `tests/chrome.e2e.ts`). Deferred minors, each owned by a later slice: reduced
  motion beyond durations, rail/dot keyboard support, pinch-zoom, landscape
  safe areas, `/about` canonical, `returnTo=/`, number formatting edge, worker
  robustness (non-array kinds, stale logo), `/kit` image states, `backdrop-filter`
  on badges, unquoted CSS `url()`, TopBar search `action`, ⌘K label on Windows;
  plan-level departures: no hero Trailer action yet, TV rail unranked, overview
  clamps at 3 lines, mobile hero capped at 560 px, search does not expand,
  sign-in hidden below 1024 px, no sign-out control.

## `verified` — premium experience, slice 4 (movie detail and trailer player)

Spec: `docs/superpowers/specs/2026-10-12-movie-detail-and-player-design.md`
(sections 1–8 plus the judged design brief); plan:
`docs/superpowers/plans/2026-10-12-movie-detail-and-player.md` (12 tasks,
executed inline, test-first). Verified in this worktree on 2026-10-14, not
merged, not deployed:

- `pnpm check` 0 errors (21 warnings, baseline); ESLint 0 errors (457 warnings,
  mostly `prefer-const` on Svelte 5 `$props` destructuring); Prettier clean;
  `pnpm test:unit -- --run` 327/327 in 56 files; `pnpm build` (Netlify adapter)
  passes; Playwright 51 passed, 2 skipped (full suite on the production
  preview, including `tests/detail.e2e.ts` and detail cases in the responsive
  320–1920 px and axe suites). Worker unchanged, its tests not re-run.
- Screenshots reviewed at 320, 390, 768 and 1440 px: header, every tab, the
  player at 390 and 1440 px, the settings sheet and panel, and `/kit`.
- Product rulings recorded in the plan ledger and the handoff: controls below
  the stage, no fill/zoom or picture-in-picture for YouTube, four settings
  tabs, auto-resume with a chip, reviews link to the existing review route,
  touch never auto-hides controls, `frame-src` allowlists exactly one origin.
- Independent whole-branch review: recorded below once it has run.

## `in_progress` — premium experience, slices 5–8

Browse at `/movies` with filters, search palette, TV/Discover/Picker/Library
and auth restyles, then the performance/accessibility/visual pass. Each slice
gets its own plan under `docs/superpowers/plans/`.

## `proposed` — picker follow-ups

- Explicit, operator-run IMDb/OMDb enrichment (worker command, HTTPS, bounded batch)
  to fill `movies.imdb_*`; reads must keep using stored values only.
- Filter picker genres in SQL instead of after the top-240 fetch.
- Surface taste-profile read failures instead of silently falling back to the guest profile.

## `in_review` — agentic operating context

- Root `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, and `ROADMAP.md` establish worktree isolation, authority, canonical states, approval gates, current facts, and V3 priorities.
- The public entry experience changed in P0.5; protected cinema behavior remains unchanged.

## `in_review` — P0 stabilization

- Persistent owner/admin/member authorization, invitation lifecycle, audit
  events, and single-owner enforcement are implemented in the task worktree.
  Owner retains personal/system access, admin is catalogue-only, and member has
  public browse only.
- Public-read containment, authenticated cache privacy, bounded catalogue/search
  reads, merge integrity, dependency security, Node 24/pnpm 11 alignment, and
  objective responsive/accessibility defects have been addressed.
- Full repository gates and independent review remain required before this work
  can become `verified` or be integrated. Migrations remain undeployed.

## `approved` — remaining P0 foundations

Implementation may proceed autonomously only within the approved item and acceptance criteria. Architecture, production, destructive, or scope-expanding decisions return to the Product Lead.

1. **Authorization rollout**
   - Back up and reconcile the hosted database before applying migrations `0002`
     and `0003` through the reviewed runbook.
   - Verify owner bootstrap, invitation, revocation, role change, and rollback on
     the isolated target before enabling hosted registration.
   - Keep user-scoped reviews, interactions, and private lists owner-only and
     separate from catalogue administration.

2. **Operational abuse and privacy controls**
   - Verify rotation of previously exposed credentials and invalidate affected sessions where required.
   - Disable or owner-gate/redact the global telemetry event stream.
   - Keep Gemini unavailable until explicit enablement, timeout,
     quota/rate/concurrency, consent, retention, and deletion controls exist.
   - Complete production cookie/CSRF verification and session-revocation operations across supported hosts.

3. **Worker and migration safety**
   - Back up the deployed database, re-check duplicate throttling and identity
     rows, and apply the prepared additive migrations through the reviewed runbook.
   - Add content classification/provenance only through reviewed, rollback-safe
     schema changes.

4. **Trustworthy quality baseline**
   - Add authenticated-owner Playwright fixtures without committing credentials.
   - Expand mobile, keyboard, accessibility, and clean-checkout release coverage.

## `proposed` — P1 usable private cinema loop

- Model owner-approved movie and TV sources with provenance, validation, availability, and safe failure behavior.
- Add normalized TV shows, seasons, and episodes without discarding the movie catalog.
- Replace the static `TOP_50_IMDB_TV` snapshot (`tv.service.ts`) with DB-backed
  TV reads under the same fail-closed standard-content visibility as movies
  (adult/keyword quarantine, no synthesized dates or placeholder counts).
  Product Lead direction approved 2026-10-08; additive migration, rollback-safe,
  implementation pending.
- Add per-user playback progress, completion, resume position, and truthful history.
- Consolidate browse → detail → player into one accessible source/player architecture.
- Add Continue Watching and persist progress across sessions/devices.
- Integrate personal actions into browse/detail with server-confirmed success and failure states.
- Use truthful deterministic editorial language until personalization is real.

P1 acceptance target: the authenticated mobile flow browse → detail → approved playback → resume is reliable, tested, and recoverable under source/network failure.

## `proposed` — P2 premium product quality

- Govern one Swiss-OLED design system for palette, typography, spacing, surfaces, interaction language, and imagery.
- Eliminate overflow and brittle heights from 320px through large OLED displays; support safe areas and dynamic mobile viewports.
- Complete WCAG 2.2 AA-intent keyboard, focus, semantic state, contrast, zoom/reflow, and VoiceOver behavior.
- Add bounded loading, error, retry, offline, and empty states; remove misleading feedback.
- Establish responsive visual-regression, accessibility, and performance budgets.

## Explicitly deferred

- Social graph, feeds, public-community features, and watch parties: outside the private owner-focused core.
- Microservices: the current monolith has no demonstrated need for the operational cost.
- Automated bulk/adult ingestion and a dedicated adult UI: blocked on classification, provenance, owner authorization, artwork/cache isolation, and explicit intent.
- Advanced AI personalization: deterministic catalog, progress, lists, consent, and cost controls come first.
- Native clients: responsive iPhone web reliability is the prerequisite.
