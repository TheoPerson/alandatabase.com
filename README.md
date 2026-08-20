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

The production host integration, access boundaries, and release checks are in
place. The product remains an evolving V3: normalized owner/invite roles,
database migration reconciliation, approved playback sources, TV persistence,
and resume/progress tracking still require product work.

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
the non-sensitive names from `.env.example`; never commit hosted values. Owner
access fails closed until `OWNER_USER_IDS` or `OWNER_EMAILS` identifies the
existing owner account.

## Stack

| Category      | Technology                                                               |
| ------------- | ------------------------------------------------------------------------ |
| Framework     | SvelteKit 2, Svelte 5 runes, TypeScript, Vite 8                          |
| UI            | Tailwind CSS 4, project CSS tokens, Bits UI/shadcn-style primitives      |
| Database      | PostgreSQL with Neon-compatible deployments                              |
| ORM           | Drizzle ORM with `postgres`                                              |
| Testing       | Vitest and Playwright                                                    |
| Observability | Sentry; optional Telegram operational notifications                      |
| Integrations  | Optional TMDB, Meilisearch, Gemini, and PGlite/local development support |
| Deployment    | Vercel adapter; pnpm package manager                                     |

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

Current branch evidence (2026-08-21):

- Unit suite: 25 files and 109 tests pass.
- Worker safety suite: 11 tests pass.
- `pnpm check`: 0 errors and 0 warnings.
- `pnpm lint`: passes with no errors; advisory warnings remain tracked.
- Production build, Playwright, and live hostname evidence are required for each
  release and reported with the deployment rather than inferred from a preview.

## Development rules

- Work on V3 from `agent/v3-foundation-core` or an explicitly based task branch.
- Treat `main` as protected: do not push, merge, rebase, reset, or commit there directly.
- Keep worktree ownership isolated; never assume another worktree's uncommitted changes exist.
- Preserve privacy, server-side authorization, adult-content isolation, data integrity, and secret hygiene.
- Use additive, backed-up migrations with a tested rollback path.
- Report exact validation results; do not claim checks, deployment, or integration without evidence.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
