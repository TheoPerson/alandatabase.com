# Media node: the owner's films from the online site (option B)

Approved by the Product Lead on 2026-10-19 ("GO ET B"): a small server on the owner's PC, exposed
with Tailscale Funnel, streams the local library to the site hosted on Netlify.

## Topology

- **App** (alandatabase.com, Netlify): pages, accounts, catalogue. It never touches a disk. With
  `MEDIA_ORIGIN` and `MEDIA_GRANT_KEY` set, the owner's player page carries a playback grant.
- **Media node** (the owner's PC): the same build started with `MEDIA_NODE=1`, `MEDIA_APP_ORIGIN`,
  `MEDIA_GRANT_KEY`, the media variables (`MEDIA_LIBRARY_ROOTS`, `FFMPEG_PATH`, `FFPROBE_PATH`) and
  `DATABASE_URL` pointing at the **same hosted database** as the app (files, progress, users).
  It answers `/api/media/**` and `/api/health` only; every other path is 404.
- **Funnel** publishes the node on its own port (`https://<pc>.ts.net:8443` → `127.0.0.1:4174`).
  The tailnet-only preview on 443 is unchanged.

## Playback grant

`v1.<payload>.<signature>`: payload is base64url JSON `{ u: userId, exp: unix seconds, aud: "media" }`,
signature is HMAC-SHA256 over `v1.<payload>` with `MEDIA_GRANT_KEY` (32 characters or more, the same
value on both sides, never in the repository). Lifetime 12 hours (a long film plus pauses); a reload of
the player page mints a new one.

The node accepts a grant only if the signature matches (constant-time), it has not expired, the
audience is `media`, and the user is **still the owner and not disabled** in the database at that
moment. A grant never creates a cookie or a session.

## Why the grant travels in the URL

The iPhone's native HLS player cannot add headers, and relative URIs in a playlist drop the query
string. So the node appends `mt=<grant>` to every URL it emits: the session's playlist, subtitle,
chapter and trickplay paths, every URI inside the playlists, and the trickplay sheets. The client turns
these paths into absolute node URLs. The grant is short-lived, owner-only and HTTPS-only; rotating
`MEDIA_GRANT_KEY` revokes every grant at once.

## Browser rules on the node

- CORS: `Access-Control-Allow-Origin` is exactly `MEDIA_APP_ORIGIN` (no credentials, `Vary: Origin`);
  preflight allows `GET, POST, PUT, DELETE` with `content-type`.
- JSON mutations (start/stop a session, save progress) accept the app origin when a valid grant is
  present, instead of the same-origin rule.
- Without `MEDIA_NODE`, nothing changes: same-origin cookies, exactly as today.

## Failure behaviour

- Node offline or Funnel off: the player shows its existing "library offline" error; the site works.
- Grant expired: 401, the player asks for a reload (existing unauthorized state).
- Funnel bandwidth is not guaranteed; adaptive quality steps down on a slow link.

## Out of scope

Third-party mirrors (never), several owners, offline downloads, a custom domain for the node (Funnel
only serves `*.ts.net`).
