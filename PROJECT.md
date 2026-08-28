# Alan's Data Base

Updated against the `v3-stabilization` task worktree on 2026-08-28. Hosted and
deployment state is called out separately and is not implied by source state.

## Product

Alan's Data Base is a personal web application with two current surfaces:

- a public project-and-tools landing page and public Movies/TV catalogue; and
- an owner-only portal for personal data, playback, and setup, plus restricted
  catalogue administration for invited administrators.

The root URL is the public project landing page; Cinema is the primary entry point and the focused developer tools remain available below it.

Movies/TV V3 is intended to become a calm, premium public catalogue with an
owner-controlled personal cinema behind authentication. Visitors can browse the
safe catalogue without an account. Only Alan can access personal organization,
playback, system administration, and setup; invited administrators can perform
catalogue mutations only. The intended owner journey is mobile
browse → detail → playback → resume/organization.

This is not intended to be a public streaming directory, social network, generic movie database, or clone of a commercial service. The Product/Project Lead owns product scope and release decisions.

## Confirmed current state

The repository currently provides:

- digest-backed session login, one-time owner setup, and invitation-gated
  registration with persistent `owner`, `admin`, and `member` roles;
- server-side owner protection for personal/system pages and data APIs,
  catalogue-only mutation permission for administrators, no private permission
  for members, and a separately authenticated Telegram webhook;
- movie home, catalog, local search, discover, detail, review/edit/merge routes, and personal list/statistics surfaces;
- watchlist, favorite, watched, rating, review, and custom-list data models;
- a committed local Top-50 TV snapshot with browse/detail aliases;
- optional Telegram, Sentry, TMDB-worker, and Meilisearch integrations; Gemini
  chat returns unavailable until its privacy and abuse controls are complete;
- a public operational Status surface with live probes, optional UptimeRobot
  history, and release notes rendered from the repository changelog;
- a dark cinema UI using project CSS tokens, Tailwind utilities, and reusable Svelte components.

The current V3 branch deliberately contains safeguards against unsafe behavior:

- standard movie reads and search use the local database rather than ingesting or calling TMDB;
- adult-flagged, negative/custom, and known explicit-keyword rows are quarantined from standard surfaces;
- unapproved iframe mirrors, arbitrary live URLs, and playback telemetry are removed or return an unavailable state;
- telemetry event streaming returns unavailable until an owner-only redacted stream is designed;
- every authenticated response is private/no-store and cinema responses deny
  frame sources.

These are containment foundations, not a finished player. There is no approved media-source model, TV/season/episode persistence, playback progress, resume position, or genuine playback history. Current “watched” data is a manual interaction.

## Required product principles

- Public browse is read-only; personal data, playback, setup, role/invitation
  operations, and system administration are owner-only. Invited administrators
  may mutate the global catalogue only. Members receive public browse only.
- Playback reliability and resume continuity matter more than catalog breadth.
- Design iPhone-first, then desktop, with calm Swiss-OLED clarity rather than dashboard noise.
- Show honest unavailable, loading, error, and empty states.
- Adult content requires a separate explicit-intent boundary with no cross-surface leakage.
- User data, sources, and global catalog mutations must have clear ownership and provenance.
- Reads must be bounded and side-effect free; ingestion and costly integrations are explicit operations.
- Preserve the monolith and existing data until evidence justifies structural change.

## Current product constraints

- V3 remains on its integration branch rather than protected `main`; production
  deployment evidence is tracked separately in `ROADMAP.md` and release
  reports.
- Persistent authorization and one-time invitation primitives are implemented
  in source, including a single-owner database invariant. Their additive
  migration has not been applied to a hosted database.
- Adult handling is a conservative quarantine, not a completed adult-content product.
- Playback, TV episodes, progress, resume, and truthful playback history remain incomplete.
- Migrations `0002` and `0003` remain undeployed until the target database is
  backed up and reconciled through the reviewed runbook. AI remains disabled
  until consent, timeout, quota, concurrency, retention, and deletion controls
  are implemented and approved.

Implementation facts live in `ARCHITECTURE.md`; approved direction and status live in `ROADMAP.md`.
