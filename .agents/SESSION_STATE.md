# Session State

## Updated

2026-10-14 — premium experience slice 4 (movie detail page and trailer player)
delivered on `TheoPerson/V5-Alan-s-Data-Base` (see `ROADMAP.md` for evidence).

## Authority

`AGENTS.md` (rules), `PROJECT.md` (product), `ARCHITECTURE.md` (system),
`ROADMAP.md` (direction and canonical states), `CHANGELOG.md` (release notes).
This file is only a short handoff pointer.

## Where things stand

- Branch state: `in_review`. Nothing pushed, merged or deployed.
- Done: V3 + picker convergence, Netlify move, auth/rate-limit fixes, real
  local catalogue, UI kit + `/kit`, cinema Home at `/`, landing at `/about`,
  movie detail at `/movies/[id]` with the full-screen trailer player.
- The slice 4 plan ledger (rulings, per-task evidence) lives in the git-ignored
  `.superpowers/sdd/2026-10-12-movie-detail-and-player/progress.md` until the
  final review is recorded; the rulings are repeated in the handoff message.
- The local PGlite catalogue is lost when its server dies uncleanly: re-run the
  two worker ingest commands (about 3 minutes). It must be running for the
  production preview, the E2E suite and the detail/player screenshots.
- Migrations `0002`–`0005` are prepared and undeployed.
- Playwright E2E must run against the production preview (default
  `playwright.config.ts`), not the Vite dev server.
- Only legitimate playback exists: official YouTube trailers through the IFrame
  API on `youtube-nocookie.com`, "where to watch" provider links, and later the
  owner's own files (separate spec). No third-party mirror will be added.

## Next actions, in priority order

1. Independent whole-branch review of slice 4 (fresh context, most capable
   model), then one fix pass; record the outcome in `ROADMAP.md`.
2. Next plan: Browse at `/movies` (filters, `/movies/catalog` redirect) and the
   search palette; then TV, Discover, Picker, Library and auth restyles.
3. Performance (CLS/LCP script), accessibility and visual baselines; docs.
4. Owner's-own-files player: separate spec (`FileSource` behind the fixed
   `PlayerSource` contract); infrastructure decision pending.
5. Owner operations: Netlify cutover (`docs/MISE_EN_LIGNE_NETLIFY.md`), TMDB
   key and Telegram token rotation (both were committed publicly in history),
   the rejected browser Sentry DSN (HTTP 403 on every page).

## Useful commands

`pnpm check`, `pnpm lint`, `pnpm test:unit -- --run`, `pnpm --dir worker test`,
`pnpm build`, `pnpm exec playwright test` (builds and previews on 4173; needs
`DATABASE_URL` and `RATE_LIMIT_HASH_KEY` in `.env`; set
`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173` to reuse a running preview).
Local catalogue: serve a PGlite database (`pglite-server --db=<dir> --port=5433
--max-connections=10`), then `WORKER_DATABASE_URL=... pnpm --dir worker
ingest:popular` and `ingest:top-rated` with `TMDB_API_KEY` in `.env`.
