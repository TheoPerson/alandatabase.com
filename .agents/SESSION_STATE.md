# Session State

## Updated

2026-10-12 — premium experience slices 1–3 delivered on
`TheoPerson/V5-Alan-s-Data-Base` (see `ROADMAP.md` for evidence).

## Authority

`AGENTS.md` (rules), `PROJECT.md` (product), `ARCHITECTURE.md` (system),
`ROADMAP.md` (direction and canonical states), `CHANGELOG.md` (release notes).
This file is only a short handoff pointer.

## Where things stand

- Branch state: `in_review`. Nothing pushed, merged or deployed.
- Done: V3 + picker convergence, Netlify move, auth/rate-limit fixes, real
  local catalogue, UI kit + `/kit`, cinema Home at `/`, landing at `/about`.
- Migrations `0002`–`0005` are prepared and undeployed.
- Playwright E2E must run against the production preview (default
  `playwright.config.ts`), not the Vite dev server.

## Next actions, in priority order

1. Next plan: movie detail (trailer facade with `youtube-nocookie` allowlisted
   in the CSP and in `player-safety.test.ts`, cast/crew, where to watch from
   `movie_watch_providers`, more like this), then Browse at `/movies`
   (filters, `/movies/catalog` redirect) and the search palette.
2. TV, Discover, Picker, Library and auth restyles on the kit.
3. Performance (CLS/LCP script), accessibility and visual baselines; docs.
4. Owner operations: Netlify cutover (`docs/MISE_EN_LIGNE_NETLIFY.md`), TMDB
   key and Telegram token rotation (both were committed publicly in history).

## Useful commands

`pnpm check`, `pnpm lint`, `pnpm test:unit -- --run`, `pnpm --dir worker test`,
`pnpm build`, `pnpm exec playwright test` (builds and previews on 4173; needs
`DATABASE_URL` and `RATE_LIMIT_HASH_KEY` in `.env`).
Local catalogue: serve a PGlite database (`pglite-server --db=<dir> --port=5433
--max-connections=10`), then `WORKER_DATABASE_URL=... pnpm --dir worker
ingest:popular` and `ingest:top-rated` with `TMDB_API_KEY` in `.env`.
