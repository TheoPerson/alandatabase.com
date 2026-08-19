# Alan's Data Base

Alan's Data Base is a SvelteKit application with a public project hub and an authenticated personal Movies/TV area. Movies/TV V3 is being developed on `agent/v3-foundation-core`; `main` remains the public V2 baseline.

V3 is intended to be a private, owner/invite-controlled cinema for browsing, launching approved playback, resuming, and organizing personal history and lists. The current branch is a foundation, not a production-ready release. Playback sources, authorization, adult-content isolation, database migrations, and the production build all have P0 work outstanding.

Read [the V3 Foundation Report](docs/V3_FOUNDATION_REPORT.md) for the audited architecture, route and data maps, product/security review, verification evidence, operational constraints, and completion roadmap.

## Stack

- SvelteKit 2, Svelte 5 runes, TypeScript, and Vite 8
- Tailwind CSS 4 plus project CSS tokens and Bits UI-derived components
- Drizzle ORM with PostgreSQL
- Vitest and Playwright
- Vercel adapter currently selected in `svelte.config.js`
- Optional TMDB, Meilisearch, Gemini, Telegram, and Sentry integrations

## Local setup

Requirements: Node.js 20+, pnpm, and PostgreSQL. Docker Compose can start local PostgreSQL and Meilisearch; its credentials are development-only.

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm dev
```

Do not run migration or seed commands against production data. The committed SQL migrations do not yet fully match the runtime schema; follow the reconciliation and backup procedure in the foundation report before using `pnpm db:migrate` on an existing database.

The app reads the server-only `TMDB_API_KEY`, not `VITE_TMDB_API_KEY`. Never expose service credentials through `VITE_` variables.

## Quality commands

```powershell
pnpm lint
pnpm check
pnpm test:unit -- --run
pnpm test:e2e
pnpm build
```

As of the 2026-08-19 audit, only the unit suite passes. The report records the exact failures. Do not infer a passing build from this README.

## Safety constraints

- Work on V3 only from `agent/v3-foundation-core`; do not merge or push it to `main` without an approved release process.
- Keep cinema pages and APIs authenticated and private/no-store.
- Require owner authorization for global catalog mutations.
- Keep reads and searches pure; ingestion must be an explicit, bounded, authorized action.
- Enforce adult intent server-side across list, search, detail, artwork, recommendation, source, URL, and cache paths.
- Do not add untrusted streaming mirrors or arbitrary iframe playback.
- Use additive, backed-up database migrations with a tested rollback path.
