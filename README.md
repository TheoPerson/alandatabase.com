# Alan's Data Base

Alan's Data Base is a SvelteKit application with a public, read-only Movies/TV
catalogue and an owner-first personal cinema workspace.

The GitHub repository and safe catalogue are public. Personal lists, settings,
playback, catalogue mutation, setup, and administration remain server-enforced
owner-only surfaces. The application is not a public streaming directory and
does not embed unapproved media sources.

## Current status

V3 is being developed on `agent/v3-foundation-core` in the canonical public
repository, [TheoPerson/alandatabase.com](https://github.com/TheoPerson/alandatabase.com).
`main` remains protected until V3 is explicitly reviewed and integrated.

The production host integration and access boundaries are in place. The product
remains an evolving V3: the additive database reconciliation migration is
prepared but not applied, while normalized owner/invite roles, approved
playback sources, TV persistence, and resume/progress tracking still require
product work.

The latest recorded audit is available in [V3 Foundation Report](docs/V3_FOUNDATION_REPORT.md). It contains the verified architecture, route/data maps, security findings, validation evidence, operational constraints, and prioritised roadmap. Do not infer that the application is production-ready from a successful preview deployment alone.

## Product boundaries

- Public, side-effect-free browse/search/detail for the safe catalogue.
- Owner-only personal data, playback, setup, administration, and non-public APIs.
- Adult or explicit content is quarantined behind explicit intent and must stay out of normal browse, search, recommendations, artwork, SEO, previews, caches, and prefetches.
- Browse, search, catalogue, and detail reads should remain bounded and side-effect free.
- Global catalogue mutations require owner authorisation.
- Playback must use reviewed, allowlisted sources; arbitrary URLs, untrusted mirrors, and unrestricted iframes are not part of the approved product.
- Social graphs, public lists, broad multi-user launch, microservices, and native clients are outside the current V3 scope.

## Application surfaces

Canonical cinema surfaces include:

- `/movies` and `/movies/[id]`
- `/tv` and `/tv/[id]`
- public `/discover` and `/search`; owner-only `/my/*`
- `/auth/login`, `/auth/register`, and `/disclaimer`
- public `/api` metadata and `/api/health`; owner-only local data APIs such as
  `/api/search` and `/api/movies/catalog`

Legacy aliases and redirects may remain for compatibility while the route tree is consolidated. The current implementation does not yet provide a complete TV episode/progress model or a dependable cross-device resume loop.

## Production hostnames

The configured deployment uses one SvelteKit application with hostname routing:

- `alandatabase.com` — canonical public host.
- `www.alandatabase.com` and `alans-database.vercel.app` — canonical redirects.
- `status.alandatabase.com` — public status surface.
- `api.alandatabase.com` — API hostname mapped to the existing `/api` routes.
- `auth.alandatabase.com` — first-class login/logout portal using the existing
  SvelteKit session flow.

Vercel Development, Preview, and Production variables are separate. Copy only
the non-sensitive names from `.env.example`; never commit hosted values.
Authorization is persistent (`owner`, `admin`, `member`) and fails closed for
unknown roles. First-owner creation is a one-time bootstrap documented in
`docs/AUTHORIZATION_MIGRATION_RUNBOOK.md`; environment variables are never a
runtime permission fallback.

## Stack

| Category      | Technology                                                           |
| ------------- | -------------------------------------------------------------------- |
| Framework     | SvelteKit 2, Svelte 5 runes, TypeScript, Vite 8                      |
| UI            | Tailwind CSS 4, project CSS tokens, Bits UI/shadcn-style primitives  |
| Database      | PostgreSQL with Neon-compatible deployments                          |
| ORM           | Drizzle ORM with `postgres`                                          |
| Testing       | Vitest and Playwright                                                |
| Observability | Sentry; optional Telegram operational notifications                  |
| Integrations  | Optional TMDB, Meilisearch, Telegram, and PGlite development support |
| Deployment    | Vercel adapter; Node 24 and pnpm 11.15.1                             |

## Local setup

Requirements: Node.js 24+, pnpm 11.15.1, and PostgreSQL. Docker Compose can
provide local PostgreSQL and Meilisearch with development-only credentials.

```powershell
git clone https://github.com/TheoPerson/alandatabase.com.git
cd alandatabase.com
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm dev
```

The worker reads `TMDB_API_KEY`; standard application reads do not call TMDB.
Do not expose service credentials through `VITE_` variables. Never run migration
or seed commands against production data. Migrations `0002` and `0003` require a
backup and the reviewed authorization runbook before hosted use.

## Quality commands

```powershell
pnpm lint
pnpm check
pnpm test:unit -- --run
pnpm test:e2e
pnpm build
```

Historical foundation baseline (2026-08-21; not current release evidence):

- Application unit suite: 28 files and 127 tests pass.
- Worker safety suite: 11 tests pass and the worker TypeScript build succeeds.
- `pnpm check`: 0 errors and 0 warnings.
- `pnpm lint`: passes.
- Vite client/server compilation and the Vercel adapter complete from a neutral
  Windows path using junction-compatible aliases. Without Windows Developer
  Mode, the unmodified adapter stops only when creating Linux-style function
  symlinks; unchanged Linux CI/Vercel packaging remains the release gate.
- 12 Playwright tests pass against the production preview, including Status at
  320 px and reduced motion. Live hostname evidence remains required for an
  actual deployment.

## Development rules

- Work on V3 from `agent/v3-foundation-core` or an explicitly based task branch.
- Treat `main` as protected: do not push, merge, rebase, reset, or commit there directly.
- Keep worktree ownership isolated; never assume another worktree's uncommitted changes exist.
- Preserve privacy, server-side authorization, adult-content isolation, data integrity, and secret hygiene.
- Use additive, backed-up migrations with a tested rollback path.
- Report exact validation results; do not claim checks, deployment, or integration without evidence.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
