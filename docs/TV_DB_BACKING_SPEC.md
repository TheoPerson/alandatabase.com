# TV DB-backing spec (`proposed`)

Product Lead direction approved 2026-10-08 (see ROADMAP P1). No schema,
migration, or route change is made by this document. Implementation must be a
separate reviewed task with backup/rollback evidence.

## Current state (why this exists)

- `src/lib/server/services/tv.service.ts` serves a static `TOP_50_IMDB_TV`
  array (810 lines). `getTVShowDetails()` synthesizes `first_air_date` as
  `${year}-01-01`, `last_air_date`/`vote_count`/`episode_count` as `null`, and
  seasons as `Season N` placeholders.
- None of the movie-catalogue guarantees apply: no `adult`/keyword quarantine,
  no DB, no pagination, stale poster strings. Any "TV safety" claim is
  currently false for these surfaces.
- Routes served: `tv/+page.server.ts`, `tv/[id]/+page.server.ts`.

## Goal

DB-backed TV catalogue with **visibility parity** with movies: the same
fail-closed standard-content policy, the same keyword/adult quarantine, honest
dates/counts or explicit "unknown" — never synthesized precision.

## Design (implementation task, not this doc)

1. **Schema (additive migration `0004_*`)**: `tv_shows` (tmdbId unique,
   `adult` boolean not null, name/overview/dates/counts nullable where TMDB
   unknown, `localOverrides` jsonb, `isLocked`), junctions `tv_genres`,
   `tv_keywords` (mirroring `movie_genres`/`movie_keywords`), `tv_seasons`
   (showId, seasonNumber, episodeCount nullable, airDate nullable).
   No `NOT NULL` on data TMDB may not provide; no backfill fabrication.
2. **Visibility**: generalize `src/lib/server/policies/movie-visibility.ts`
   (`isStandardMovie` / `standardMovieVisibilityWhere`) to a shared
   standard-content predicate reused by a `tv-visibility` wrapper over
   `tv_shows` + `tv_keywords` (same blocked keyword IDs). TV detail/person
   surfaces filter through it; quarantine-only shows return `null` like
   `getPersonById` does for movies.
3. **Worker ingest**: extend `worker/src/tmdb/` with a TV path reusing
   `ingest-safety.ts` ordering (safety check before first insert), single
   `db.transaction()` per show (per round-2 B3 pattern), `isLocked` pre-check,
   bulk junction inserts. No bulk/adult ingest (still blocked per ROADMAP).
4. **Reads**: `getTopTVShows(limit, offset)` clamped like
   `normalizeSearchLimit`; detail loader resolves via visibility predicate;
   `prepareStandardTVShow()` strips `keywords` and applies overrides (mirror
   `prepareStandardMovie`). Static `TOP_50_IMDB_TV` becomes a frozen editorial
   seed used only to backfill rows through the safety-checked ingest — then
   deleted from the service module.
5. **Tests**: PGlite migration test (baseline→0004, re-run idempotent),
   visibility unit tests (adult/keyword-quarantined rows excluded, metadata
   stripped), service tests (no synthesized dates: unknown stays `null` and
   renders "unknown"), Playwright `/tv` + `/tv/[id]` quarantine assertions
   (`iframe==0` pattern already exists for movies).

## Acceptance criteria

- `/tv` and `/tv/[id]` read only from DB through the visibility predicate.
- A quarantined-keyword or `adult=true` show is unreachable via browse,
  detail, search, sitemap, and API.
- No rendered date/count the DB does not hold; unknowns render as unknown.
- Migration `0004` passes two consecutive ephemeral runs; rollback = restore
  backup or keep columns with prior app (same pattern as runbook 0002/0003).
- Gates: `check` 0 errors, unit + worker green, E2E TV matrix green in Linux CI.

## Out of scope

- Bulk/adult TV ingestion and dedicated adult UI (ROADMAP explicitly deferred).
- Per-user TV progress/resume (P1 loop item, separate task).
- Playback sources (quarantine stays; unavailable states unchanged).
