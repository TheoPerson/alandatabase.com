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

## 9. Design brief (final)

Base: **Lights Down**, with grafts from Pocket Cinema (thumb-zone geometry, honest disabled rows, 320 px folding) and Command Deck (shortcut table, ResumeBar, versioned prefs hygiene). Dropped: sticky ActionBar and page-scope letter shortcuts (chrome budget, invisible on touch), stage tap/double-tap gestures (impossible over a cross-origin iframe), animated stage width, Backspace-as-back.

### 1. Visual direction

The detail page is a darkened auditorium: the backdrop is the only bright thing, type and chrome sit in its shadow, and the player is the screen with a quiet apron of controls underneath it, never on top of it. Every existing kit piece (BackdropImage, PosterCard, MetaChips, Chip, Rail, Section, Button, EmptyState) is reused unchanged except for two additive props; new pieces are bits-ui 2.18 on `app.css` tokens, scoped CSS like `button.svelte`, no new runtime dependency. One primary button per page, three durations, opacity and transform only, and nothing moves that the user did not cause.

### 2. Layout per breakpoint

Header = HeroCarousel recipe frozen on one film: BackdropImage pulled under the TopBar (`margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)))`), the two Home scrims, content in `--container-wide` with `--page-gutter`. BackdropImage gains `animate={false}` and `priority="low"`; the poster is the single LCP candidate (SSR `<img>`, `fetchpriority="high"`, never opacity 0). Panel ids are `panel-<tab>` so a `#cast` hash never triggers native anchor scroll.

- **320** (gutter 16, content 288): backdrop `min(56dvh, 400px)`; poster 96×144 overlapping the scrim by 48 px; h1/logo `clamp(2rem, 9vw, 2.75rem)`, 3 lines max, `overflow-wrap: anywhere`; one MetaChips row; genre chips in a scrolling row with edge fade; Play trailer full width 48 px; toggles as 44 px icon-plus-caption buttons in a 5-up grid (`--text-xs` captions); synopsis clipped after 2 lines as scroll cue. Tab list scrolls (edge fades, `scrollIntoView({ inline: 'nearest', block: 'nearest' })`). PersonCard 104 px; provider tiles 44 px, five per row.
- **390**: backdrop `min(60dvh, 460px)`; poster 112×168; Play and the toggle grid land inside the first 812 px screen. Player portrait: 56 px strip + 219 px stage + 72 px apron = 347 px, so a medium settings sheet never covers the stage.
- **768**: header grid `clamp(160px, 22vw, 220px) 1fr`, gap `--space-6`, both bottom-aligned; backdrop `min(60dvh, 520px)`; actions one row with labels, wrapping below 900 px; five tab triggers fit without scrolling; Overview 1.2fr/1fr (synopsis + key crew left, Where to watch card right); Videos two columns; PersonCard 128 px; crew two-column dl.
- **1024**: BottomTabBar gone; backdrop `min(80dvh, 720px)`; rail arrows appear; Overview 7/5 grid, `--space-8` gutter.
- **1440**: poster 280 px, logo up to 8 rem, text column under 60 % width for 4.5:1 on the scrim; tab list 48 px with `--space-6` between triggers and a `--border-subtle` hairline; PersonCard 148 px; Videos three columns.

### 3. Actions bar and states

One row under the meta line, `gap: var(--space-2)`, `role="group"` not toolbar. **Play trailer** is the only `variant="primary"`, rendered when `pickTrailers` returns ≥1; with a qualifying `player:pos:<key>` it reads "Resume · 1:18 left" over a 3 px ResumeBar whose height is reserved on SSR so hydration never shifts. Slot kept by a "No trailer yet" chip when empty. Watchlist / Favourite / Watched are `variant="secondary"` toggles with `aria-pressed`, state labels ("In watchlist", "Favourited", "Watched"), filled icons, `loading` while pending, optimistic flip, toast worded from the server result (`watchlist-copy.ts` pattern). They post `'true'|'false'` to a `logInteraction` action on `/movies/[id]` that calls a shared server helper extracted from `movies/catalog/[id]` (one validator, two routes). **Rate** opens a Sheet with StarRating: bits-ui RatingGroup, five 44 px stars with `allowHalf` = ten positions, posting 0.5–5.0 so `_parseInteractionUpdate` is untouched, label "4.5 / 5", Clear button. **Share**: `navigator.share`, else clipboard + toast. Signed out, every toggle is `<Button href="/auth/login?returnTo=%2Fmovies%2F<id>">` with the same label; no silent no-ops.

### 4. Tabs

bits-ui `Tabs.Root`, automatic activation, loop, panels pre-rendered (bits-ui keeps inactive content mounted hidden, so SSR text is present). Order: Overview, Cast & crew, Videos, Details, Saga & similar (hidden when both lists are empty). Selected = weight 600 + 2 px brand underline moved by transform; unselected `--content-secondary`, never caps. Hash is source of truth: read on mount, written with `replaceState` from `$app/navigation` passing `page.state` through; never `pushState`. Panels share `min-height: 240px`, swap instantly; on change the tablist is kept in view so a short panel never snaps scroll. Overview: synopsis, `keyCrew` dl (degrades to ingested roles), Where to watch, collection banner. Details: `formatDate`, runtime, original title/language, status, `formatMoney`, TMDB/IMDb `rel="noopener"`, keyword Chips to `/search?q=`. Empty panels: `EmptyState compact`. Review form follows in a Section when signed in.

### 5. Where to watch

Section "Where to watch", eyebrow = region, FR/US Chips with `aria-pressed`, default FR, remembered in `localStorage` under `ui:region` in try/catch. Rows arrive grouped from the loader (`watchProviders: true`, `Promise.allSettled`, `logServerError` on failure → empty state, never an error box): Stream, Free (free + ads deduped by providerId), Rent, Buy. ProviderLogo: 44 px tile, `--surface-raised` + 1 px `--border-subtle`, `tmdbImageUrl(logoPath, 'w92')` with width/height, `alt={providerName}`, initials fallback, Tooltip on hover-capable only, link to the region's JustWatch URL `rel="noopener"`. Footer: "Data by JustWatch" and "See all options on TMDB". `min-height: 120px`; region switch survives the empty state ("Not streaming in France right now."); nothing animates on switch.

### 6. Player stage, controls, auto-hide, keyboard

Full-screen kit Dialog (`trapFocus`, `preventScroll`, `onCloseAutoFocus` on Content), `--z-sheet`, canvas `#000`, opened via `pushState` with `page.state.player = { key }`; Back, swipe-back and Escape (fullscreen first) close it; `data-player-open` on `<html>` hides the BottomTabBar. Column: top strip 56 px + `--safe-top` (Close, "Trailer" eyebrow, title), stage `aspect-ratio: 16/9; width: min(100%, calc((100dvh - strip - apron) * 16 / 9))`, apron 72 px (64 + `--safe-bottom` on phones). Nothing of ours ever sits over the stage.

YouTubeSource: `isYouTubeKey` gate; `iframe_api` injected once behind a cached promise; `YT.Player` creates the element on `youtube-nocookie.com` with `controls=0`, `disablekb=1`, `playsinline=1`, `rel=0`, `iv_load_policy=3`, `origin`, `enablejsapi=1`, unique title. The facade thumbnail drops on `onReady`/CUED (not PLAYING) so a blocked autoplay on iOS leaves a tappable player; `onAutoplayBlocked` is inferred from state staying CUED after `playVideo()` and flips the apron to a Play label. Preconnect on `pointerdown` of Play and when it enters the viewport. Errors 100/101/150 render PlaybackUnavailable with "Watch on YouTube". Fullscreen requests the stage wrapper, shown only when `document.fullscreenEnabled`; PiP is disabled with the reason "Not available for YouTube trailers".

Apron, Tab order: Play/Pause, −10, +10, seek Slider (4 px track, buffered layer `--surface-interactive`, played `--brand-primary`, 16 px thumb, `aria-valuetext` in spoken time, ±5 s / PageUp-Down ±30 s / Home / End, `seekTo(t,false)` per frame, `seekTo(t,true)` on release, max hidden until `getDuration() > 0`), `role="timer"` clock, Mute + fixed 96 px volume Slider under `(hover: hover)`, CC (`aria-pressed`, best-effort `loadModule('captions')`, fallback reload with `cc_load_policy=1`), Speed, Settings, Fullscreen. All kit `size="icon"` 44 px. Skips accumulate into one "+20 s" pill (1.5 s reset) at the apron edge. Auto-hide is a pure reducer (`tested with a fake source`): active only in fullscreen while PLAYING after 3 s; never while paused, buffering, `:focus-within`, sheet open, pill visible, or on touch (tap the apron region to toggle). Hidden = timer-driven `opacity: 0` + `visibility: hidden` + `inert`, never `transitionend`. Keyboard handler on the dialog root only (Space/K, J/L, arrows, M, F, C, `<`/`>`, `?`); on `window` blur with the iframe focused, focus returns to the stage wrapper (`tabindex=-1`). One `role="status"` region from mount: Playing, Paused, Speed 1.5×, Captions on, Resumed at 1:12.

### 7. Settings panel

PlayerSettings in a Sheet: below 768 px a bottom sheet (`max-height: min(85svh, 100% - env(safe-area-inset-top))`, 24 px top radius, 48 px grabber `<button aria-label="Resize sheet">` cycling medium 50 % → large → close, swipe-down, backdrop tap, Escape, visible Close, `overscroll-behavior: contain`, iOS `position: fixed` scroll lock); from 768 px a right panel `clamp(320px, 36vw, 440px)` that overlays the dialog's right edge and re-lays out the stage once, never animated. Non-modal via `interactOutsideBehavior="ignore"`, labelled "Player settings", stays open while previewing. Four vertical Tabs (manual activation), rows 44 px, radios in fieldsets, `role="switch"` rows, unavailable rows disabled with a one-line reason:

- **Video**: Quality radio — Auto (disabled, "Set by YouTube"); Format radio — Fit (default), Fill / 16:9 / 4:3 / Zoom disabled ("Not available for YouTube trailers"); OLED switch, default off.
- **Audio**: Volume Slider (default 100); Boost Slider disabled ("Needs a local file").
- **Subtitles**: Captions switch (default follows YouTube preference); Size radio Small / Medium (default) / Large → `fontSize` −1 / 0 / 2; Style and Position rows disabled.
- **Playback**: Speed segmented radios from `getAvailablePlaybackRates()`, default 1×, re-applied after every load; Resume switch (default on); Forget this position; Forget all positions (count, capped 50); Keyboard shortcuts switch (default on); Auto-hide delay 2 / 3 (default) / 5 s.

All under one versioned `player:prefs` key, default-merged in try/catch, applied before the source mounts; `player:pos:*` entries expire after 90 days on read.

### 8. Motion rules

`--duration-fast` 120 ms hover/pressed; `--duration-base` 200 ms tab underline, toggles, tooltips, facade→stage crossfade; `--duration-slow` 360 ms dialog fade (+0.98→1 stage scale) and sheet translate; all `--ease-out`; `--ease-spring` only on the toggle icon pop and skip pill, on user action. Only `opacity` and `transform` animate. Never animates: header on load, backdrop (blur-up aside), poster, tab panel swaps, region switch, stage or panel width, height/top/filter, anything inside the iframe, toasts (`--z-toast`, overlay only, reserved for page actions). Under reduced motion: fades only, no scale, no smooth scroll; every state change is timer-driven. INP: Play handler mutates UI, then `await scheduler.yield()` (setTimeout fallback) before injecting the API; polling 250 ms only while PLAYING; resume writes every 5 s and on pause, `visibilitychange` hidden, `pagehide`, close; no `unload`; `pageshow` persisted re-creates the player.

### 9. Loading, empty, error, signed-out

Server render needs no skeleton; client navigation shows a Skeleton matching poster/text/chip geometry only if any loader promise is streamed. Stage shows the thumbnail; spinner after 2 s. Empty tabs, Where to watch and Videos use `EmptyState compact`. Provider or similar query failure omits the block and logs. Player errors never leave a black stage. 404/500 pages unchanged. Signed out: toggles become login links; the review form is absent; trailer, resume and Where to watch work fully.

### 10. Accessibility checklist

- One h1 (visually hidden behind the logo, `alt=""`), h2 Sections, h3 inside panels.
- APG Tabs: `aria-selected`, `aria-controls`, `aria-labelledby`, arrows wrap, Home/End, `tabindex="0"` on panels without focusables.
- Every control a native button with a state-bearing name; `aria-pressed` on toggles; icon-only buttons carry visible captions on touch.
- Dialog `aria-modal`, labelled "Trailer: {title}", focus trapped and returned; page behind `inert`.
- Sliders: `aria-valuemin/max/now/valuetext`; buffered range visual only.
- Single-key shortcuts scoped to the dialog root, ignored in inputs, switchable off (2.1.4).
- One `role="status"` region from mount; clock is `role="timer"`; `role="alert"` once for errors.
- Controls never hide under `:focus-within`; `:focus-visible` 2 px brand outline, 3:1.
- Targets ≥44 px with 8 px spacing; grabber 48 px; 3:1 on tracks and accents; 4.5:1 text on scrims.
- Unique iframe title; decorative images `alt=""`; reduced motion honoured in CSS and timers.
- `/kit` shows every component on light and dark backdrops, fullscreen demo closed by default; axe and 320 px overflow e2e cover them; detail e2e `test.skip`s without data.

### 11. Kit components (prop sketches)

- `Tabs { value, onValueChange, items: {value,label,disabled?}[], orientation?, activation? }`
- `Dialog { open, onOpenChange, variant: 'center'|'fullscreen', label }` — fullscreen sets `data-player-open`.
- `Sheet { open, onOpenChange, side: 'bottom'|'right', detent: 'medium'|'large', label }`
- `Slider { value, min, max, step, orientation?, buffered?, valueText(v), onValueChange, onValueCommit }`
- `Tooltip { label, delay=300 }` — suppressed on coarse pointers.
- `PersonCard { id, name, profilePath, subtitle, width }`
- `TrailerFacade { videoKey, name, type, resume?, onplay }`
- `ProviderLogo { providerName, logoPath, href }`
- `StarRating { value, onchange, name }` — RatingGroup, allowHalf.
- `ResumeBar { position, duration }` — `role="progressbar"`, time-left text.
- `PlayerShell { source: PlayerSource, title, videoKey, prefs }`; `PlayerSettings { prefs, capabilities }`
- `YouTubeSource` implements `PlayerSource` + `capabilities(): { fullscreen, pip, captions, rates }`.
- `shortcuts.ts` table feeding both the key handler and `ShortcutHelp`.
- `BackdropImage` gains `animate`, `priority`; `PosterCard` gains a link-less `frame` branch.
- Pure helpers: `pickTrailers`, `keyCrew`, `groupProviders`, `resumeRules`, `playerPrefs`, `formatTime`, `autoHideReducer`.

### 12. Non-goals

No overlays on the embed, no fill/zoom for YouTube, no sticky action bar, no page-level letter shortcuts, no stage gestures, no thumbnail scrubbing, no server-side trailer progress, no FileSource code, no global CSP rewrite (the `frame-src` allowlist in `response-policy.ts`, its test and ARCHITECTURE.md change together; `script-src` is a separate approved item), no rating schema change, no Continue-watching row, no TV detail, no mirrors.

Decisions needing Product Lead acknowledgement before slice 4: controls below the stage (spec §4 wording), fill/zoom disabled for YouTube, auto-resume with chip instead of a gate, eight settings sections grouped into four tabs.

Product Lead rulings (delegated to the project lead, 2026-10-12): controls sit below the stage; Fill/Zoom are disabled for YouTube; auto-resume uses the chip, not a gate; settings are grouped into four tabs.
