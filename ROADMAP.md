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

## `in_review` — agentic operating context

- Root `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, and `ROADMAP.md` establish worktree isolation, authority, canonical states, approval gates, current facts, and V3 priorities.
- The public entry experience changed in P0.5; protected cinema behavior remains unchanged.

## `approved` — remaining P0 foundations

Implementation may proceed autonomously only within the approved item and acceptance criteria. Architecture, production, destructive, or scope-expanding decisions return to the Product Lead.

1. **Owner and invite authorization**
   - Replace the interim env owner boundary with a normalized server-side owner/invite model for global edit/merge/ingestion operations.
   - Replace reusable owner setup with a one-time, concurrency-safe setup and later invite lifecycle.
   - Keep user-scoped reviews, interactions, and private lists separate from global administration.

2. **Operational abuse and privacy controls**
   - Verify rotation of previously exposed credentials and invalidate affected sessions where required.
   - Disable or owner-gate/redact the global telemetry event stream.
   - Put Gemini behind explicit enablement with timeout, quota/rate/concurrency, consent, retention, and deletion controls.
   - Complete cookie, CSRF, login-rate, and session-revocation review across supported hosts.

3. **Worker and migration safety**
   - Validate worker commands before database/network action; remove implicit seed-on-start behavior and obsolete keyword probes.
   - Introspect the deployed database read-only, back it up, and reconcile runtime schema with additive migrations.
   - Add roles/invites and content classification/provenance only through reviewed, rollback-safe schema changes.

4. **Trustworthy quality baseline**
   - Add V3 CI triggers and required service provisioning.
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
