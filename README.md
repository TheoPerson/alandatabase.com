# Alan's Data Base

Alan's Data Base is a SvelteKit application for a private, owner-first cinema workspace: discovering, launching approved playback, resuming, and organising personal films and series.

The GitHub repository is public, but the cinema product is not a public catalogue or social streaming service. Cinema routes and APIs are intended to remain authenticated and private, with optional sharing to a small group of trusted people later. The public hub and operational pages are separate from the private cinema surface.

## Current status

V3 is being developed on `agent/v3-foundation-core` through [PR #2](https://github.com/TheoPerson/alandatabase.com/pull/2). `main` remains the protected production baseline until the V3 work is reviewed and explicitly integrated.

This branch is a foundation, not a production-ready release. Authentication, authorization, adult-content isolation, database migration reconciliation, approved playback sources, resume/progress tracking, and the production-quality baseline still have outstanding work.

The latest recorded audit is available in [V3 Foundation Report](docs/V3_FOUNDATION_REPORT.md). It contains the verified architecture, route/data maps, security findings, validation evidence, operational constraints, and prioritised roadmap. Do not infer that the application is production-ready from a successful preview deployment alone.

## Product boundaries

- Private, authenticated Movies/TV experience for the owner first.
- Adult or explicit content is quarantined behind explicit intent and must stay out of normal browse, search, recommendations, artwork, SEO, previews, caches, and prefetches.
- Browse, search, catalogue, and detail reads should remain bounded and side-effect free.
- Global catalogue mutations require owner authorisation.
- Playback must use reviewed, allowlisted sources; arbitrary URLs, untrusted mirrors, and unrestricted iframes are not part of the approved product.
- Social graphs, public lists, broad multi-user launch, microservices, and native clients are outside the current V3 scope.

## Application surfaces

Canonical cinema surfaces include:

- `/movies` and `/movies/[id]`
- `/tv` and `/tv/[id]`
- `/discover`, `/search`, and `/my/*`
- `/auth/login`, `/auth/register`, and `/disclaimer`
- Protected local-read APIs such as `/api/search` and `/api/movies/catalog`

Legacy aliases and redirects may remain for compatibility while the route tree is consolidated. The current implementation does not yet provide a complete TV episode/progress model or a dependable cross-device resume loop.

## Production hostnames

The configured deployment uses one SvelteKit application with hostname routing:

- `alandatabase.com` — canonical public host.
- `www.alandatabase.com` and `alans-database.vercel.app` — canonical redirects.
- `status.alandatabase.com` — public status surface.
- `api.alandatabase.com` — API hostname mapped to the existing `/api` routes.

Hosted environment variables, database state, migrations, and external integrations must be verified separately before any production change.

## Stack

| Category | Technology |
| --- | --- |
| Framework | SvelteKit 2, Svelte 5 runes, TypeScript, Vite 8 |
| UI | Tailwind CSS 4, project CSS tokens, Bits UI/shadcn-style primitives |
| Database | PostgreSQL with Neon-compatible deployments |
| ORM | Drizzle ORM with `postgres` |
| Testing | Vitest and Playwright |
| Observability | Sentry; optional Telegram operational notifications |
| Integrations | Optional TMDB, Meilisearch, Gemini, and PGlite/local development support |
| Deployment | Vercel adapter; pnpm package manager |

## Local setup

Requirements: Node.js 20+, pnpm, and PostgreSQL. Docker Compose can provide local PostgreSQL and Meilisearch with development-only credentials.

```powershell
git clone https://github.com/TheoPerson/alandatabase.com.git
cd alandatabase.com
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm dev
```

The server reads `TMDB_API_KEY`; do not expose service credentials through `VITE_` variables. Never run migration or seed commands against production data. The committed SQL migrations and runtime schema still require reconciliation before changing an existing database.

## Quality commands

```powershell
pnpm lint
pnpm check
pnpm test:unit -- --run
pnpm test:e2e
pnpm build
```

The latest recorded audit (2026-08-19) found:

- Unit suite: passed — 5 files, 12 tests.
- `pnpm check`: failed on database connection-string typing and `/live` warnings.
- Formatting/lint: failed with existing formatting and ESLint issues.
- `pnpm build`: failed during the audited environment.
- E2E: not run because the preview server depends on the failing build.
- Latest Vercel status observed for the current V3 head: successful preview status; this is not equivalent to full QA or production readiness.

## Development rules

- Work on V3 from `agent/v3-foundation-core` or an explicitly based task branch.
- Treat `main` as protected: do not push, merge, rebase, reset, or commit there directly.
- Keep worktree ownership isolated; never assume another worktree's uncommitted changes exist.
- Preserve privacy, server-side authorization, adult-content isolation, data integrity, and secret hygiene.
- Use additive, backed-up migrations with a tested rollback path.
- Report exact validation results; do not claim checks, deployment, or integration without evidence.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
