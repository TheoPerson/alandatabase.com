# Movie detail and player — design spec

Date: 2026-10-12. Status: approved direction by the Product Lead ("Movix-grade
detail page and player"); details delegated. Follows the premium experience
spec (`2026-10-12-premium-cinema-experience-design.md`, slice 4) and its kit.

## 1. Intent

Every poster on Home leads to `/movies/[id]`. Today that page is a plain
summary with a dead "Playback status" button. It becomes the richest screen of
the product: a cinematic header, personal actions that work, a tabbed body with
everything the catalogue knows, and a real player with a settings panel at the
level of Movix's (format, speed, subtitles, OLED, resume). The player plays the
title's official trailers now; the next spec connects the owner's own files to
the same player.

Success: a signed-out visitor can open any film, watch its trailer full screen
and see where it streams legally in France; a signed-in owner can mark it
watched, favourite, to-watch, rate it, and come back to the trailer where they
left it. Nothing flashes, nothing shifts, every control works with a keyboard
and on a phone.

Out of scope: third-party streaming mirrors (never), own-file playback (next
spec), comments, an images gallery (TMDB images are not ingested), TV detail.

## 2. Data

All local. `getMovieById` already loads genres, cast (15, ordered), crew (10),
videos, keywords and the collection. It gains `watchProviders` and raises the
crew limit to 30 so Director, Writer, Screenplay, Director of Photography,
Original Music Composer and Editor can be found.

New read helpers (pure, tested):

- `pickTrailers(videos)`: YouTube only, valid 11-character keys, official first,
  Trailer before Teaser, newest first, at most 6.
- `keyCrew(crew)`: the roles above, one person per role, in that order.
- `groupProviders(rows, region)`: Stream (flatrate), Free (free + ads), Rent,
  Buy, each ordered by `displayPriority`, with the region's JustWatch link.
- `similarMovies(movieId, primaryGenreId)`: same primary genre, standard
  visibility, by popularity, excludes the film, at most 12, bounded.
- `collectionMovies(collectionId, movieId)`: standard-visibility siblings by
  release date, feeds the Saga tab.

Personal state for the signed-in user: `getUserInteraction` (watched,
favourite, watchlist, rating, watch date) and `getUserMovieReviews`.

Resume position for trailers lives in `localStorage` per video key. Trailers
are not watch history, so nothing is written server-side.

## 3. Screen: `/movies/[id]`

**Header**: full-bleed `BackdropImage` with the kit scrim, pulled under the top
bar like Home. On 768 px and wider a poster card sits left (2:3, the PosterCard
frame without a link) and the text right; on phones the poster floats over the
lower edge of the backdrop. Title (TMDB logo when stored, else text), tagline,
`MetaChips` (★ rating with vote count, year, runtime) and genre `Chip`s linking
to `/movies/catalog?genre=`.

**Actions** (kit `Button`s, wrap on phones):

- **Play trailer** (primary, only when a trailer exists) opens the player.
- **Watchlist**, **Favourite**, **Watched**: toggles showing the real saved
  state, optimistic UI, toast worded from the server result, busy while
  submitting; signed out → `/auth/login?returnTo=/movies/[id]`.
- **Rate**: a 10-star control in a small `Sheet`, stored through the existing
  `logInteraction` action (`type=rating`).
- **Share**: Web Share API; fallback copies the URL and toasts.

**Tabs** (`Tabs` component; the URL hash `#cast` etc. selects a tab so links
are shareable; arrow keys move between tabs):

1. **Overview**: synopsis, key crew list (role → person link), the "Where to
   watch" block (provider logos grouped Stream / Free / Rent / Buy, FR/US
   switch, JustWatch attribution, link to the TMDB watch page), and a
   collection banner when the film belongs to one.
2. **Cast & crew**: cast rail of `PersonCard`s (photo, name, character), then
   the crew grouped by department.
3. **Videos**: trailer and teaser cards (`TrailerFacade`: YouTube thumbnail and
   a play button); clicking opens the player on that video.
4. **Details**: release date (long form), runtime, original title and
   language, status, budget and revenue (`formatMoney`), TMDB and IMDb links,
   keywords as chips linking to search.
5. **Saga & similar**: the collection rail when any, then "More like this".

A tab with nothing to show says so in one line (`EmptyState` compact). Errors
keep the existing 404/500 pages. Signed in, the existing review form appears
below the tabs, restyled on the kit.

## 4. Player

Opened from "Play trailer" or a video card. A route-less full-screen `Dialog`:
`history.pushState` so Back closes it, Escape closes, focus is trapped, body
scroll is locked, focus returns to the opener.

Surface: a 16:9 stage on a black canvas with kit controls overlaid. Controls
auto-hide after 3 s without pointer or key activity; on touch they stay until
tapped. Controls: play/pause, −10 s / +10 s, progress bar with seek and the
buffered range, time / duration, mute and volume, speed, subtitles (CC),
settings (gear), picture-in-picture when supported, fullscreen. Keyboard:
Space or K, J/L (±10 s), arrows (±5 s / volume), M, F, C, Escape; `?` lists the
keys.

Settings panel (bottom sheet on phones, side panel on desktop) with tabs like
Movix's: **Quality** (from the source; "Auto" for YouTube), **Format** (fill,
fit, 16:9, 4:3, zoom slider), **Speed** (0.5 → 2 in 0.25 steps), **Subtitles**
(tracks from the source, or off), **Subtitle style** (size, background,
position), **Progress** (resume on/off, forget position), **Audio** (volume
boost up to 2× through a `GainNode`, with a warning, only for sources that
allow it), **OLED** (pure black chrome, dimmed controls). Choices persist in
`localStorage` under one key and apply to every source.

Source adapter interface (`PlayerSource`): `load(container, options)`,
`play()`, `pause()`, `seek(seconds)`, `setRate(rate)`, `setVolume(level)`,
`getState()`, `on(event, handler)`, `qualities()`, `subtitleTracks()`,
`destroy()`. Two adapters:

- **YouTubeSource** (this spec): the YouTube IFrame Player API on
  `www.youtube-nocookie.com`, loaded only when the player opens. The API script
  (`https://www.youtube.com/iframe_api`) is the only third-party script; it is
  injected on demand and removed with the player. Quality is Auto; format and
  zoom apply to the stage; speed and volume map to the API; subtitles are
  YouTube's own (`cc_load_policy`); audio boost is unavailable.
- **FileSource** (next spec): `<video>` plus HLS. The interface is fixed now;
  no code yet.

Security: the CSP `frame-src` becomes exactly `https://www.youtube-nocookie.com`
and `script-src` gains `https://www.youtube.com` (global directives; the script
is still injected only when the player mounts). `player-safety.test.ts` keeps
scanning every source file; its allowlist gains one file, the YouTube adapter,
which may reference `youtube-nocookie.com` and build an iframe through the
official API, and nothing else may. The video key is validated with
`isYouTubeKey` before any embed.

Resume: the trailer position is saved every 5 s to `localStorage`
(`player:pos:<key>`) and offered on reopen ("Resume at 1:12" / "Start over")
when past 10 s and not within the last 15 s.

Reduced motion: no auto-hide animation, instant control fades. Fluidity: the
stage reserves 16:9 before the iframe loads; the thumbnail stays until the
first frame; controls move with transform and opacity only.

## 5. Kit additions

`Tabs`, `Dialog` (full-screen variant), `Sheet` (bottom on phones, side on
desktop), `Slider`, `Tooltip`, `PersonCard`, `TrailerFacade`, `ProviderLogo`,
`StarRating`, `PlayerShell` (stage, controls, settings) and `PlayerSettings`.
All on tokens; every control at least 44 px on touch; all shown on `/kit`.

## 6. Accessibility

Tabs follow the ARIA tabs pattern. The player is a labelled dialog; every
control has a name; the progress bar is a `slider` with keyboard support; the
settings panel traps focus; a live region announces "Playing", "Paused" and
resume offers. Contrast is checked on the kit page with light and dark
backdrops.

## 7. Testing

- Unit: `pickTrailers`, `keyCrew`, `groupProviders`, resume-position rules,
  settings persistence (pure store), and on PGlite `similarMovies`,
  `collectionMovies` and the detail loader shape (quarantine holds: a custom or
  adult sibling never appears in Saga or Similar).
- The player state machine (play, pause, seek, rate, auto-hide) is tested with
  a fake source adapter, no browser.
- E2E: the detail page renders its header; tabs switch with keyboard and hash;
  "Play trailer" opens the dialog and injects exactly one iframe from
  `youtube-nocookie.com`, only after the click; Escape and Back close it and
  restore focus; where-to-watch shows FR providers with the attribution;
  signed-out actions redirect to login; no horizontal overflow at 320 px; axe
  clean.
- Screenshots at 390 px and 1440 px reviewed: header, each tab, player open,
  settings panel.

## 8. Delivery order

1. Data helpers and loader (`watchProviders`, key crew, trailers, similar,
   saga) with tests.
2. Kit: Tabs, Sheet, Dialog, Slider, Tooltip, PersonCard, TrailerFacade,
   ProviderLogo, StarRating.
3. Detail page: header, actions, tabs 1–5, reviews.
4. Player: state machine, YouTubeSource, shell, controls, settings panel,
   resume, CSP and safety-test changes.
5. E2E, screenshots, docs.
