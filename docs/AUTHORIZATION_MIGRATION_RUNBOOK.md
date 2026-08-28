# Persistent authorization migration runbook

This runbook is for a reviewed operator action. The application and migration
are implemented locally; no hosted database is changed automatically.

## Guarantees

- Existing accounts migrate to `member`; no email or environment value silently
  grants production authorization.
- Only `owner` can manage invitations, roles, and account state.
- `admin` can manage catalog records but cannot grant roles or create owners.
- Invitations can grant only `admin` or `member`, expire after seven days, and
  store only a SHA-256 token digest.
- Disabled accounts and revoked sessions fail closed.
- Owner bootstrap is serialized, explicit, and audited.

## Pre-migration checks

1. Take a restorable PostgreSQL backup and record the restore procedure.
2. Confirm the target is the intended Preview or Production database. Never use
   a Preview database URL for Production or the reverse.
3. Review the account that will become owner without copying its email or ID to
   source control or logs.
4. Run the local quality gates and the PGlite migration test:

   ```text
   pnpm check
   pnpm exec vitest run src/lib/server/db/migrations.test.ts
   pnpm build
   ```

## Migration sequence

1. Set `DATABASE_URL` only in the operator shell to the reviewed target.
2. Run `pnpm db:migrate`. Migration `0003_complete_skrulls.sql` adds roles,
   account disabling, revocable sessions, invitations, and auth audit events.
   It intentionally expires and revokes every pre-migration browser session;
   users must sign in again after deployment.
3. Verify the migration history and inspect counts, not private data:

   ```sql
   select role, count(*) from users group by role order by role;
   select count(*) from auth_invites;
   select count(*) from auth_audit_events;
   ```

4. If this is an existing database, set `WORKER_DATABASE_URL` to the same
   reviewed target and set the one-command confirmation:

   ```text
   OWNER_BOOTSTRAP_CONFIRM=bootstrap-persistent-owner
   ```

5. Run the audited bootstrap with the reviewed account UUID:

   ```text
   pnpm auth:bootstrap-owner -- --user-id <existing-user-uuid>
   ```

   The script refuses to continue if an owner already exists, the account is
   missing or disabled, the UUID is malformed, or the confirmation is absent.

6. Immediately unset `OWNER_BOOTSTRAP_CONFIRM` and `WORKER_DATABASE_URL` from
   the operator shell. They are not runtime application variables.

For a brand-new empty database, set a random server-only `OWNER_SETUP_KEY` of at
least 32 characters, create the first account through `/auth/register`, then
remove the key from Development, Preview, and Production. It must never remain
as a long-lived authorization mechanism.

## Post-migration verification

1. Sign in through `https://auth.alandatabase.com`.
2. Verify `/admin/access` is available only to the owner.
3. Create a short-lived test member invitation, use it once, and confirm reuse
   fails.
4. Confirm a member receives `403` for catalog mutations and admin routes.
5. Confirm an admin can manage catalog data but receives `403` for
   `/admin/access`.
6. Revoke other sessions from `/my/settings` and verify the current session
   remains valid.
7. Disable a disposable account and verify all its sessions are rejected.

## Rollback

Application rollback is preferred over dropping columns or tables. The schema
changes retain audit/session history, but pre-migration sessions stay expired so
the prior application cannot reactivate raw session tokens. Sessions created by
the new application are digest-only and are not understood by the prior
application. If rollback is required, restore the reviewed backup or redeploy the
prior application while keeping the new columns intact, then require a fresh
sign-in. Do not delete authorization records during an incident.
