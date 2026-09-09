# TV Episode Notifications

This feature follows a TV series from the canonical `/tv/[id]` detail page. It
is separate from the watchlist: saving a show does not enable episode alerts.
The owner can choose release day, one day before, or seven days before and can
pause or remove the subscription from `/my/alerts`.

## Runtime flow

`tv_episode_subscriptions` stores the owner, default profile, TMDB show, timing,
timezone, and the last check state. The sync route fetches a bounded set of
English TMDB TV metadata, applies the existing fail-closed adult and keyword
policy, and stores normalized episode events. Unknown air dates are retained but
never notified. A unique show/season/episode event key and a unique
user/profile/event delivery key make retries idempotent.

The notification row is created only when its configured local date is due. It
is visible in the owner inbox and links to the TV detail page with season and
episode query parameters. Push delivery is an independent per-device outbox:
each device is claimed atomically, explicit provider rejection may retry with a
bounded backoff, and an unknown network outcome is recorded as `uncertain`
rather than sent again. The service worker opens only same-origin TV or inbox
paths. Email, push beyond Web Push, Telegram, and mobile delivery are not part
of this feature.

## Operations

`GET /api/cron/tv-episodes` is the scheduled entry point. It requires
`Authorization: Bearer $CRON_SECRET`, returns a private no-store response, and
does nothing unless `TV_EPISODE_SYNC_ENABLED=true`. Each invocation processes at
most 20 due subscriptions and has a bounded runtime. The Vercel schedule is
daily at 07:00 UTC to remain compatible with Hobby limits; the persisted next
check timestamp keeps work fair across owners. Scheduling is intentionally
manual/owner-approved for preview and this branch does not deploy or migrate a
hosted database.

Required server-only environment values are:

- `DATABASE_URL` for the intended non-production database;
- `TMDB_READ_TOKEN` (the legacy API key is not required for this flow);
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` for browser push;
- `CRON_SECRET` with at least 32 random characters; and
- `TV_EPISODE_SYNC_ENABLED=true` only after the rollout has been reviewed.

The public VAPID key is returned only to the authenticated owner. The private
key, TMDB token, cron secret, database URL, and generated subscription payloads
must never be committed, logged, or placed in pull requests. Any value pasted
into chat is considered compromised and must be revoked and replaced in the
scoped Vercel environment before release.

## Schema and rollback

Migration `0006_tv_episode_notifications.sql` is additive and creates
`tv_episode_subscriptions`, `tv_episode_events`, `notification_events`,
`push_subscriptions`, `push_notification_deliveries`, and `tv_episode_sync_runs`
with foreign keys, checks, indexes, timestamps, and idempotent unique keys. It
must be applied twice against a fresh isolated preview database before any
hosted rollout. Rollback is a feature-commit revert, disposal of the isolated
preview database branch, and redeployment of the previous preview artifact;
production is unaffected until a separate migration approval exists.

## Attribution and privacy

TMDB supplies TV metadata and episode dates. The existing `/about` Data Sources
and Credits page carries the required TMDB notice. Personal subscriptions,
inbox rows, device endpoints, and read state are owner-scoped on the server;
anonymous pages receive no personal notification fields. Browser-visible dates
use the browser locale while due-date calculations use the stored timezone,
falling back to `Europe/Paris`.
