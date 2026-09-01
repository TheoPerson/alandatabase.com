# Changelog

All notable Alan Database V3 changes are recorded here. The public status page
renders this same source, so repository history and product-facing patch notes
stay aligned.

The format follows Keep a Changelog principles. V3 remains pre-release until
its launch gates are explicitly verified.

## [Unreleased]

### Major Updates

- Rebuilt the public Status surface as the operational and release-information centre for Alan Database.
- Restored the public movie discovery pipeline after a malformed SQL visibility predicate made catalogue reads fail.
- Added persistent owner/admin/member authorization with one-time invitations,
  revocable sessions, audit events, and database-enforced single-owner identity.

### Minor Updates

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

### Security

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

- Made CI dependency installation explicit: lifecycle scripts are enabled only
  for the reviewed native packages in pnpm's build allowlist.
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

### Known Issues

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
