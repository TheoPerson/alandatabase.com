# Movies / TV V3 Roadmap

Verified against `agent/v3-foundation-core` on 2026-08-21. States use the
canonical vocabulary in `AGENTS.md`.

Nothing below is `merged` to `main` or `deployed` unless explicitly labeled. The Product/Project Lead approves scope and phase transitions.

## `in_review` - Alan Score

- Added a seven-dimension owner score with rated-dimension weight normalization,
  one-decimal results, explicit coverage, and unrated/partial/complete states.
- Added an owner/movie unique persistence model, server-calculated upsert/reset
  services, and an owner-only editor on canonical `/movies/[id]`.
- Preserved the legacy five-star column and values while removing its new-entry
  control; no conversion is inferred.
- Source and local verification do not imply merge or deployment. Independent
  review, an isolated hosted preview database, and preview evidence remain gates.

## `in_review` - Global Release Calendar

- Added an authenticated agenda/month calendar for globally popular upcoming
  films, with a deterministic rolling 90-day TMDB discovery set capped at 100.
- Added owner-only manual synchronization in batches of at most 20, fail-closed
  classification, transactional idempotent event/provider ingestion, and
  partial/stale/failure visibility.
- Added country-specific current provider snapshots with JustWatch attribution,
  TMDB credits, personal-state filters, duplicate-safe owner reminders, due
  state, and authenticated all-day `.ics` export.
- Local source, migration, unit, worker, and rendered browser evidence is
  complete. A fresh hosted preview database, a rotated preview-only TMDB token,
  Linux CI/Vercel evidence, and independent review remain gates. Scheduling,
  delivery channels, merge, and production deployment are excluded.

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
