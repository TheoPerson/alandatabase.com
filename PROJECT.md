# Alan's Data Base

Verified against `agent/v3-foundation-core` at `9e724ce` plus current working-tree P0 hardening edits on 2026-08-19.

## Product

Alan's Data Base is a personal web application with two current surfaces:

- a public project-and-tools landing page; and
- an authenticated Movies/TV area being developed as V3.

The root URL is the public project landing page; Cinema is the primary entry point and the focused developer tools remain available below it.

Movies/TV V3 is intended to become Alan's private, owner- or invite-controlled cinema: a calm, premium place to browse a personal catalog, open a title, use an approved player, resume viewing, and organize progress, history, favorites, watchlists, lists, and recommendations. The intended core journey is mobile browse → detail → playback → resume/organization.

This is not intended to be a public streaming directory, social network, generic movie database, or clone of a commercial service. The Product/Project Lead owns product scope and release decisions.

## Confirmed current state

The repository currently provides:

- session-based login and environment-gated registration;
- server-side session protection for cinema pages and APIs, an environment-configured owner boundary for global catalog edit/merge operations, and a separately authenticated Telegram webhook;
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
- cinema responses are private/no-store and deny frame sources.

These are containment foundations, not a finished player. There is no approved media-source model, TV/season/episode persistence, playback progress, resume position, or genuine playback history. Current “watched” data is a manual interaction.

## Required product principles

- Private and personal by default; owner/invite access must be enforced on the server.
- Playback reliability and resume continuity matter more than catalog breadth.
- Design iPhone-first, then desktop, with calm Swiss-OLED clarity rather than dashboard noise.
- Show honest unavailable, loading, error, and empty states.
- Adult content requires a separate explicit-intent boundary with no cross-surface leakage.
- User data, sources, and global catalog mutations must have clear ownership and provenance.
- Reads must be bounded and side-effect free; ingestion and costly integrations are explicit operations.
- Preserve the monolith and existing data until evidence justifies structural change.

## Current product constraints

- V3 is work in progress and is neither the public `main`/V2 release nor evidence of deployment.
- Global catalog mutations are env owner-gated, but there is no normalized owner-role or invite lifecycle; reusable owner setup is not a safe invite flow.
- Adult handling is a conservative quarantine, not a completed adult-content product.
- Playback, TV episodes, progress, resume, and truthful playback history remain incomplete.
- Database migration drift and external AI privacy/cost controls block production readiness.

Implementation facts live in `ARCHITECTURE.md`; approved direction and status live in `ROADMAP.md`.
