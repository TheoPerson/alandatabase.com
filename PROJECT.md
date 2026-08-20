# Alan's Data Base

Verified against `agent/v3-foundation-core` on 2026-08-21.

## Product

Alan's Data Base is a personal web application with two current surfaces:

- a public project-and-tools landing page and public Movies/TV catalogue; and
- an owner-only portal for personal data, playback, catalogue administration,
  and setup.

The root URL is the public project landing page; Cinema is the primary entry point and the focused developer tools remain available below it.

Movies/TV V3 is intended to become a calm, premium public catalogue with an
owner-controlled personal cinema behind authentication. Visitors can browse the
safe catalogue without an account. Only Alan can access personal organization,
playback, administration, and setup. The intended owner journey is mobile
browse → detail → playback → resume/organization.

This is not intended to be a public streaming directory, social network, generic movie database, or clone of a commercial service. The Product/Project Lead owns product scope and release decisions.

## Confirmed current state

The repository currently provides:

- session-based login and environment-gated registration;
- server-side owner protection for personal/admin pages and data APIs, an
  environment-configured owner boundary for global catalog operations, and a
  separately authenticated Telegram webhook;
- movie home, catalog, local search, discover, detail, review/edit/merge routes, and personal list/statistics surfaces;
- watchlist, favorite, watched, rating, review, and custom-list data models;
- a committed local Top-50 TV snapshot with browse/detail aliases;
- optional Gemini, Telegram, Sentry, TMDB-worker, and Meilisearch integrations;
- a dark cinema UI using project CSS tokens, Tailwind utilities, and reusable Svelte components.

The current V3 branch deliberately contains safeguards against unsafe behavior:

- standard movie reads and search use the local database rather than ingesting or calling TMDB;
- adult-flagged, negative/custom, and known explicit-keyword rows are quarantined from standard surfaces;
- unapproved iframe mirrors, arbitrary live URLs, and playback telemetry are removed or return an unavailable state;
- telemetry event streaming returns unavailable until an owner-only redacted stream is designed;
- owner-only responses are private/no-store and deny frame sources.

These are containment foundations, not a finished player. There is no approved media-source model, TV/season/episode persistence, playback progress, resume position, or genuine playback history. Current “watched” data is a manual interaction.

## Required product principles

- Public browse is read-only; personal data, playback, setup, and administration
  are owner-only and enforced on the server.
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
- Global catalog mutations are env owner-gated, but there is no normalized owner-role or invite lifecycle; reusable owner setup is not a safe invite flow.
- Adult handling is a conservative quarantine, not a completed adult-content product.
- Playback, TV episodes, progress, resume, and truthful playback history remain incomplete.
- Database migration drift blocks schema changes until the deployed database is
  backed up and reconciled. Optional AI remains disabled unless explicitly and
  safely configured.

Implementation facts live in `ARCHITECTURE.md`; approved direction and status live in `ROADMAP.md`.
