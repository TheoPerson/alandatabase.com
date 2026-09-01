# Global Release Calendar

## Decision

The calendar is a protected personal planning surface for globally popular
upcoming films. It is not an exhaustive country catalogue, a cinema-showtime
service, or a notification-delivery system. Discovery remains an explicit
owner action in this change; no cron is configured.

## Discovery and synchronization

- `POST /api/admin/calendar/sync` requires the persistent owner role.
- A new run requests the first five TMDB discover pages for the inclusive
  rolling 90-day window, with `include_adult=false`, `language=en-US`, and
  `sort_by=popularity.desc`.
- Results are deduplicated, ordered by popularity with deterministic date/TMDB
  ID tie-breaking, and capped at 100 films.
- The candidate IDs are stored with the sync run. Each request processes at
  most 20 and returns:

```json
{
	"runId": "uuid",
	"nextCursor": "20",
	"processed": 20,
	"inserted": 4,
	"updated": 10,
	"skipped": 5,
	"failed": 1,
	"complete": false
}
```

The client continues with `runId` and `nextCursor`. A stale cursor is rejected.
Film failures are counted without discarding completed films, so a later run is
safe: source keys, hashes, unique constraints, upserts, and transactions make
accepted writes idempotent.

## Data and safety

Migration `0005_fresh_roland_deschain.sql` adds:

- `calendar_sync_runs` for bounded progress and counters;
- `movie_release_events` for one global primary event plus typed regional
  events;
- `movie_provider_snapshots` for current country-specific availability; and
- `movie_release_reminders` for user/event/offset ownership.

Every candidate receives validated detail and keyword data before the existing
fail-closed TMDB classifier permits the first write. Adult, explicit, or
unclassified titles are skipped. Unknown dates and release types remain
`unknown`/null. Raw TMDB responses are never serialized to the calendar.

Provider entries are snapshots supplied by JustWatch through TMDB. They do not
represent a release date, showtime, or guaranteed playback link. The UI shows
providers only for the selected two-letter country and labels stale snapshots.

## Personal behavior

`/movies/calendar` requires an authenticated account. The URL preserves view,
7/30/90-day range, search, genre, release type, region, watchlist, watched,
tracked, and Alan Score filters. Tracked means at least one release reminder.

Reminders support release day, one day before, or seven days before. Duplicate
rows are prevented by the database. Due dates use the saved IANA timezone,
falling back to `Europe/Paris`; visible dates use the browser locale. Authenticated
all-day exports are available at `/movies/calendar/reminders/[id].ics`.

Email, push, Telegram, and other delivery claims are excluded.

## Preview and rollback

Preview deployment requires an isolated preview database with migration `0005`
and a freshly rotated, sensitive, branch-scoped `TMDB_READ_TOKEN`. Do not use a
pasted or production token. Provision the preview owner through the gated setup
flow, disable `ALLOW_OWNER_SETUP`, and redeploy before sharing the preview.

Rollback is to revert the calendar commit, discard the isolated preview
database branch, and redeploy the preceding Alan Score preview artifact. No
production migration or deployment is part of this work.
