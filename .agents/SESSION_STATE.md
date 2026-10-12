# Session State

## Updated

2026-10-12 — reconciled by the V5 convergence session. The earlier version of this
file described a streaming-mirror player and a WatchParty plan; both contradict the
approved V3 rules in `AGENTS.md` / `PROJECT.md` and were removed.

## Authority

`AGENTS.md` (rules), `PROJECT.md` (product), `ARCHITECTURE.md` (system),
`ROADMAP.md` (direction and canonical states), `CHANGELOG.md` (release notes).
This file is only a short handoff pointer.

## Where things stand

- Branch `TheoPerson/V5-Alan-s-Data-Base` = V3 hardened line + `main`'s Movie Picker.
  State: `in_review` (not merged, not deployed). Evidence is in `ROADMAP.md`.
- Nothing from this branch has been pushed, merged to `main`, or deployed.
- Migrations `0002`-`0004` are prepared and undeployed.

## Next actions, in priority order

1. Owner: rotate the Telegram bot token that `main` hard-coded; decide hosting
   (Vercel vs Netlify); decide guest vs signed-in picker (see `ROADMAP.md`).
2. Run Playwright E2E and the Vercel adapter build under Node 24 (this machine had v26).
3. Review the unmerged `codex/*` feature branches (`alan-score`,
   `global-release-calendar`, `tv-episode-notifications`) for integration.
4. Explicit IMDb enrichment worker command; picker genre filtering in SQL.
5. P1 from `ROADMAP.md`: DB-backed TV, approved sources, resume/progress.

## Useful commands

`pnpm check`, `pnpm lint`, `pnpm test:unit -- --run`, `pnpm --dir worker test`,
`pnpm build` (set `NETLIFY=true` to build the Netlify adapter).
Local preview without a database: serve a PGlite database (see the
`createMigratedTestDatabase()` helper), set `DATABASE_URL=...?max=1`,
`NODE_ENV=development ALLOW_DEV_AUTH_BYPASS=true pnpm exec vite dev`.
