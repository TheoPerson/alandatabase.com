# Alan's HQP (HighQualityPlayer): final design and architecture spec

Date: 2026-10-16. Author: hqp-design-judge (design director and lead architect).
Status: `approved` direction for the build, under the Product Lead's delegation of design
decisions to this workflow. Nothing here is `verified` on a real iPhone (see section 19).

Inputs reviewed: three proposals with their written specs, HTML prototypes and 74 screenshots
(designer-cinematic "Projection", designer-power "Console and Cinema", designer-mobile
"True-Black Stage"); the repository at HEAD 1a7fcc4 plus the uncommitted media library work; the
shared contract `src/lib/media/types.ts`; the existing trailer player (`src/lib/player/*`,
`src/lib/components/ui/player/*`), the `(cinema)` layout, `app.html`, `static/manifest.json` and
`static/sw.js` (navigation-only, so it never touches media requests).

---

## 0. Decision

### 0.1 Scores

| Criterion (weight)                              | Projection | Console and Cinema | True-Black Stage |
| ----------------------------------------------- | ---------- | ------------------ | ---------------- |
| Premium feel and polish (40%)                   | 9.2        | 8.3                | 8.4              |
| iPhone 18 Pro Max ergonomics, PPP and HDR (25%) | 8.6        | 8.8                | 8.9              |
| Clarity and accessibility (15%)                 | 8.3        | 9.0                | 8.8              |
| Buildability and performance on the phone (20%) | 8.5        | 8.0                | 8.8              |
| **Weighted**                                    | **8.78**   | 8.47               | 8.67             |

**Winner: designer-cinematic, "Projection".** It is the only direction that reads as cinema
first: OLED black everywhere except the picture, a few small Liquid Glass capsules, a white
cinema CTA, cinema-title typography, and signature moments (portrait scrub that turns the whole
picture into the preview, the credits shrink, the lens ripple) that no streaming app on iOS does
this cleanly. Its island treatment is the most rigorous visually (pure black 62 px band, glow
masked out of it, side inset that starts exactly where the island ends), and its CSS is the most
buildable (player-scoped tokens, `--hqp-spring`, glass that disappears from the compositor when
the chrome hides).

Why not the others as the base:

- Console and Cinema is the best at telling the truth (Signal pill, value-first chips, honest
  audio notes) and at rigour (automated island check), but its portrait "console" reads as a
  utility app, its emerald CTA fights the picture, and it adds weight (adaptive luma canvas
  sampler, sleep fades, many tabs) that costs battery over HDR.
- True-Black Stage is the cheapest to run (glass-free portrait) and the most honest about iOS
  limits, but its portrait top bar sits on the picture corners, its resume prompt blocks playback,
  its badges crowd the landscape title, and its spring overshoots 16%, which feels toy-like at
  120 Hz.

### 0.2 Grafts (best ideas kept from the other two)

From Console and Cinema:

1. **Signal chip**: a live truth chip, `● Original · 4K · HDR10` (emerald dot) or
   `● Converted · 1080p` (amber dot). Tapping it opens Playback info.
2. **Value-first labels**: the Audio and Subtitles capsule shows the current values
   (`FR 5.1 · CC FR`), not just a menu name.
3. **Island band invariant**, enforced by an automated test on every layout (section 3.3).
4. **Honest audio note** in the Tracks tab ("Passed through untouched" or "Converted for this
   browser: Chrome cannot decode E-AC-3").
5. **Chapter magnet** (snap within 6 px) and **origin tick** on the timeline.
6. **Playback tab**: speed, sleep timer (incl. end of episode), autoplay next. **Skip intro**
   capsule from chapter titles.
7. **Subtitle sync offset** (plus or minus 0.1 s steps) and **Copy diagnostics / Reload stream**
   in Playback info.
8. **Optimistic single tap** (no 260 ms wait before the chrome shows).

From True-Black Stage:

1. **Cancel by returning**: releasing a scrub within 8 px of the origin tick cancels the seek.
2. **Native `<track>` kept** in the video so subtitles survive Picture in Picture, AirPlay and
   native fullscreen; our own renderer is used otherwise.
3. **Caps gated by `mediaCapabilities.decodingInfo(...).powerEfficient`** for AV1 and HEVC
   Main 10 (no software decode on a phone).
4. **Pinch Fit/Fill remembered per aspect class** with a crop toast.
5. **Edge exclusion** (24 px) in Safari tab mode, none in Home Screen mode.
6. **Weak-link detection** feeding Auto quality, with a visible toast, never a silent downgrade.
7. **One-time "Add to Home Screen" hint** in Safari tab mode.
8. **13 Pro Max reference renders** as part of the visual check.

### 0.3 Cuts (deliberately not built in this version)

- **In-site mini-player** (swipe down docks the video above the tab bar): deferred. It needs the
  player hosted in the layout across navigations. Version 1 uses system Picture in Picture as the
  mini-player and swipe down closes. Section 13.6 keeps the door open.
- **Adaptive luma scrim** (drawing video frames into a canvas every 500 ms): cut. It costs GPU over
  HDR, is unreliable for HDR frames, and static eased scrims plus glass chips already hold
  contrast.
- **PGS burn-in on selection**: no server API exists. Image subtitles are listed, disabled, with
  the reason.
- **Volume and brightness gestures**: iOS ignores `video.volume`; no dead gestures.
- **Blocking resume prompt**: replaced by a non-blocking 6 s capsule.
- **Separate Speed and Style tabs**: merged (Playback tab; Style is a page inside Tracks).

---

## 1. Product goals

The owner (Alan) watches his own films and series, stored on his PC (`F:/MOVIES`, 370 files,
826 GB), on the site, mainly on his iPhone 18 Pro Max, through "Alan's HQP".

Goals, in priority order:

1. **The best picture the device can show** ("PPP": pixels per inch). The untouched original
   stream whenever the device decodes it (HEVC Main 10 HDR, AV1, H.264; E-AC-3 and AC-3 passed
   through on Apple devices), HDR kept on the XDR display, no needless downscale.
2. **The Dynamic Island disappears.** Pure black around the picture so the island merges into the
   OLED; chrome on 13 Pro Max-like insets (47 px reference); the picture never shrinks to avoid the
   island.
3. **Startup-grade 2026 polish**: Liquid Glass capsules, cinema typography, 120 Hz-friendly motion,
   instant response to every touch.
4. **Never lose your place**: resume from server progress on any device, next episode with
   countdown, continue watching rails on Home and the Library.
5. **Honesty**: the player always says whether you see the original or a converted stream, and
   why.

Non-goals: third-party sources, iframe players, downloads/offline copies, multi-user profiles,
casting other than AirPlay, editing the library from the player, any write under `F:/`.

Success: on the owner's iPhone in Home Screen mode, a 4K HDR10 HEVC episode opens from Home in
under 2 s on the local network, plays as Direct with HDR shown, the island is invisible in
portrait and lands on black or the picture in landscape, every control answers on the next frame,
and the next episode starts by itself.

---

## 2. Platform facts and assumptions

| Item                                                     | Value used by this spec                                                                                                              | Verified?                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| CSS viewport                                             | 440 x 956 portrait, 956 x 440 landscape, DPR 3 (~460 ppi)                                                                            | Assumed (17 Pro Max geometry) |
| Safe areas                                               | portrait top 62, bottom 34; landscape left/right 62, bottom 21                                                                       | Assumed                       |
| Dynamic Island                                           | 126 x 37, 11 px from the edge; portrait rect x 157..283, y 11..48; landscape rect x 11..48 (or 908..945), y 157..283                 | Assumed                       |
| Display corner radius                                    | about 62 pt                                                                                                                          | Assumed                       |
| Refresh                                                  | ProMotion up to 120 Hz; Safari may cap rAF at 60 Hz                                                                                  | Unverified                    |
| Decode                                                   | HEVC Main 10 HDR and AV1 in hardware                                                                                                 | Assumed (A17 Pro and later)   |
| HDR                                                      | HDR10, HLG, Dolby Vision on XDR; `(dynamic-range: high)` true                                                                        | Assumed                       |
| Fullscreen                                               | No element fullscreen on iPhone; only native video fullscreen (drops our UI)                                                         | Known                         |
| Immersion                                                | fixed full-viewport container + `playsinline` + Home Screen web app (standalone, black-translucent status bar, `viewport-fit=cover`) | Known                         |
| Volume, orientation lock, haptics, home indicator hiding | Not available to the web on iOS                                                                                                      | Known                         |
| Chrome 152 on this PC                                    | MSE: avc1, hvc1 Main and Main 10, av01 10-bit, AAC; not ac-3/ec-3                                                                    | Measured                      |

Everything iPhone-specific is checked here by Chrome emulation (440 x 956 and 956 x 440, DPR 3,
touch, iPhone user agent) plus the simulated insets of section 3.4. Section 19 lists what only the
real phone can prove.

---

## 3. Island-free geometry

### 3.1 Rules

1. The video ignores every safe-area inset. It is sized from the full viewport.
2. Portrait: the top band (status bar plus island, `env(safe-area-inset-top)`, 62 px) stays pure
   `#000`. No control, scrim, ambient glow or glass reaches into it above y = 48 except the top
   bar, which starts at y = 53 (below the island's bottom edge).
3. Landscape: a 16:9 picture fills the height (782 x 440, 87 px black pillars): the island sits on
   a pillar. A 2.39:1 picture fills the width (956 x 400): the island falls over the picture's
   edge. The picture is never shrunk for the island.
4. Chrome insets follow the 13 Pro Max reference (47 px), not the island's shape, and stay
   symmetric left/right.
5. No hit area may intersect the island rectangle (section 3.3).

### 3.2 Inset tokens (exact)

```css
--hqp-sa-t: env(safe-area-inset-top, 0px);
--hqp-sa-r: env(safe-area-inset-right, 0px);
--hqp-sa-b: env(safe-area-inset-bottom, 0px);
--hqp-sa-l: env(safe-area-inset-left, 0px);
--hqp-edge-top: min(var(--hqp-sa-t), 47px); /* portrait top bar at edge-top + 6 = 53 */
--hqp-edge-x: clamp(16px, max(var(--hqp-sa-l), var(--hqp-sa-r)) - 14px, 48px); /* 62 - 14 = 48 */
--hqp-edge-bottom: calc(max(var(--hqp-sa-b), 14px) + 4px); /* portrait 38, landscape 25 */
```

On large layouts (section 5.4) `--hqp-edge-x: 48px`, top bar at 24 px, bottom bar at 24 px.

### 3.3 Island band invariant (tested)

For the 440 x 956 portrait and 956 x 440 landscape layouts with simulated insets, in every state
(controls, sheet, info, scrub, up next, episodes, resume, error, lock): the bounding box of every
visible interactive element (`button`, `a`, `[role=slider]`, `[role=radio]`, `[role=tab]`,
`[role=switch]`) inside `.hqp` must not intersect the island rectangles of section 2. Visible means
not `visibility: hidden` and computed opacity above 0.01. Landscape is checked against both the
left and the right island positions.

### 3.4 Simulation hook

`hqp-tokens.css` contains a dev and test override that only applies when
`<html data-hqp-sim="iphone18">` is set (harmless in production):

```css
@media (orientation: portrait) {
	:where(html[data-hqp-sim='iphone18']) .hqp {
		--hqp-sa-t: 62px;
		--hqp-sa-r: 0px;
		--hqp-sa-b: 34px;
		--hqp-sa-l: 0px;
	}
}
@media (orientation: landscape) {
	:where(html[data-hqp-sim='iphone18']) .hqp {
		--hqp-sa-t: 0px;
		--hqp-sa-r: 62px;
		--hqp-sa-b: 21px;
		--hqp-sa-l: 62px;
	}
}
```

The demo harness (section 13.4) also draws the island, status bar and home indicator when
`?sim=iphone18`, and a 13 Pro Max reference with `?sim=iphone13` (47 px notch insets).

---

## 4. Picture quality (PPP and HDR)

### 4.1 Capability report (engine `caps.ts`)

Delivery choice:

- `native` HLS when the browser is Apple WebKit (`navigator.vendor` contains "Apple") and
  `video.canPlayType('application/vnd.apple.mpegurl') !== ''`, or when no MSE exists at all
  (`MediaSource` and `ManagedMediaSource` both absent) but native HLS does.
- `hls.js` (loaded with `import('hls.js/light')`, never on Apple devices) when MSE exists.
- Otherwise error `unsupported`.

Codec probes use `video.canPlayType('video/mp4; codecs="…"')` on the native path and
`MediaSource.isTypeSupported(...)` on the hls.js path ("maybe" or "probably" counts as yes):

| ClientCaps field | Probe string                                                                         | Extra gate                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `h264`           | `avc1.640033`                                                                        | none                                                                                           |
| `hevc`           | `hvc1.1.6.L153.B0`                                                                   | none                                                                                           |
| `hevcMain10`     | `hvc1.2.4.L153.B0`                                                                   | `decodingInfo` supported and `powerEfficient` (3840x2160, 20 Mb/s, 24 fps) when the API exists |
| `av1`            | `av01.0.12M.10`                                                                      | `decodingInfo` supported and `powerEfficient` (same config) when the API exists                |
| `nativeHls`      | delivery is `native`                                                                 |                                                                                                |
| `ac3`            | `audio/mp4; codecs="ac-3"`                                                           |                                                                                                |
| `eac3`           | `audio/mp4; codecs="ec-3"`                                                           |                                                                                                |
| `hdrDisplay`     | `matchMedia('(dynamic-range: high)')` or `matchMedia('(video-dynamic-range: high)')` | and (`hevcMain10` or `av1`)                                                                    |
| `multichannel`   | delivery is `native` and Apple vendor                                                |                                                                                                |
| `maxHeight`      | always `null` (quality levels cap height, not caps)                                  |                                                                                                |

The result is cached in `sessionStorage` key `hqp:caps:v1`. A decode failure (section 4.4)
writes an override to `hqp:caps-override:v1` (for example `{ "av1": false }`) that is merged into
every later report in that browser session.

### 4.2 Quality ladder

`QualityChoice = 'auto' | QualityLevel`. The Picture tab lists **Auto** (default), then the levels
of `PlaybackSession.qualities` in server order (normally `original`, `2160p`, `1080p`, `720p`,
`480p`). Labels: "Original" with tag `DIRECT` when `session.video.mode === 'copy'` for it, else tag
`GPU`; lower levels show an approximate bitrate (2160p about 20 Mb/s, 1080p about 8, 720p about 4,
480p about 1.5).

### 4.3 Auto quality (engine `abr.ts`, pure and tested)

The server offers one variant per session, so adaptation is client-driven by restarting the
session at the current position.

- Auto starts at `original`.
- **Step down one level** (next lower entry of `qualities`) when any of:
  1. one stall (status `buffering` not caused by a seek) lasts more than 4 s;
  2. two stalls longer than 1 s happen within 60 s;
  3. hls.js only: measured throughput below 1.1 x the stream bitrate while buffer ahead is under 8 s.
- **Step up one level** when all of: at least 180 s since the last switch; no stall for 120 s;
  buffer ahead at least 45 s (native) or throughput at least 1.6 x the target level's bitrate for
  60 s (hls.js); more than 5 minutes left in the item.
- At most one switch per 30 s. Never while paused, seeking or scrubbing.
- Every Auto step shows a toast: "Lower quality (1080p) for smooth playback" with action
  "Keep Original" (sets choice `original`), or "Back to Original".
- An explicit level choice never changes by itself. After two stalls longer than 4 s within 2
  minutes it only suggests: toast "Slow connection · Try 1080p" with that action.

### 4.4 Decode failure recovery

When the direct stream fails to decode (native `MEDIA_ERR_DECODE` or `MEDIA_ERR_SRC_NOT_SUPPORTED`,
or a second fatal hls.js media error after one `recoverMediaError()`), the engine disables the
offending codec in the caps override (`av1`, then `hevcMain10`, then `hevc`), restarts the session
at the same position once, and shows the toast "Converted stream: this device could not decode
AV1". A second failure becomes error `decode` with the action "Try 1080p (converted)".

### 4.5 HDR

- `hdrDisplay` true keeps HDR (the server copies HDR10/HLG, or transcodes to HEVC Main 10 HDR).
- The `<video>` element never gets `filter`, `opacity` below 1, `mix-blend-mode` or `backdrop-filter`
  behind it. Transforms are applied to the `.hqp-frame` wrapper only (credits shrink, sheet glide,
  Fit/Fill FLIP) and must be verified on the device (section 19); the reduced-motion variants
  never transform the frame and are the fallback if HDR drops under a transform.
- Where `@supports (dynamic-range-limit: no-limit)`: the video gets `no-limit` normally and
  `constrained` while the sheet, the info panel or the episodes drawer is open (UI white stays
  legible next to 1000-nit highlights).
- UI white stays at SDR reference white. Legibility over HDR highlights comes from scrims, the
  subtitle shadow stack and glass, never from brighter text. With an HDR stream on an HDR display,
  the root gets `data-hdr="on"` and `--hqp-scrim-k: 1.25` multiplies scrim alphas.
- Dolby Vision: profile 5 needs the server's tone-mapped or reshaped path; profiles 7 and 8 play
  their HDR10 base layer. Playback info states it (for example "Dolby Vision 8.1 · HDR10 base
  layer").

### 4.6 Crisp at DPR 3

All icons are vector (one SVG sprite); hairlines are one physical pixel (`--hqp-hairline`: 1 px,
0.5 px at 2dppx, 0.34 px at 3dppx); no raster UI assets; TMDB images requested at about 3x their
CSS width (stills `w780` for cards up to 260 px, `w1280` for backdrops, `w300` for the blurred
ambient glow only); trickplay tiles requested at 480 x 270.

---

## 5. Layouts

Breakpoints are viewport media queries (the player root is always the full viewport). The same
thresholds are mirrored in `layoutFor(width, height)` for logic:

| Layout                 | Media query                                                                                        | Example              |
| ---------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `phone-portrait`       | `(orientation: portrait) and (max-width: 599px)`                                                   | 440 x 956            |
| `phone-portrait-short` | the same `and (max-height: 759px)`                                                                 | 375 x 667, 320 x 693 |
| `phone-landscape`      | `(orientation: landscape) and (max-height: 499px)`                                                 | 956 x 440            |
| `large`                | `(orientation: portrait) and (min-width: 600px), (orientation: landscape) and (min-height: 500px)` | 1440 x 900, iPad     |

`phone-landscape-short` styling (section 5.3) uses `(orientation: landscape) and (max-height: 379px)`.

Pointer-specific behaviour (hover preview, cursor hide) uses `(hover: hover) and (pointer: fine)`.

### 5.1 iPhone portrait (440 x 956): "Projection"

Zones, top to bottom:

| Zone        | Geometry                                    | Content                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Band        | y 0..62                                     | Pure black; status bar only. Nothing of ours above y 48.                                                                                                                                                                                                                                                                                        |
| Top bar     | y 53..97, x 16..424                         | Left: Close (chevron down, 44 px regular-glass circle). Right: one glass group of 44 px buttons: AirPlay (only when a target exists), PiP, Info.                                                                                                                                                                                                |
| Ambient     | around the picture                          | The current still (`w300`), `filter: blur(60px) saturate(1.2)`, opacity 0.35, masked to transparent at the band edge (the ambient layer covers the root; `mask-image: linear-gradient(to bottom, transparent var(--hqp-sa-t), black calc(var(--hqp-sa-t) + 78px), black calc(100% - 120px), transparent)`). Static: never resampled from video. |
| Picture     | full width, centred at 43% of the height    | 16:9: y 287..535. Clamped so its top is at least 118 px (below the top bar plus 12).                                                                                                                                                                                                                                                            |
| Title block | 22 px under the picture                     | Eyebrow `STRANGER THINGS · S5 · E1` (films: year and runtime); title 22/27, at most 2 lines; badge row: Signal chip, `4K`, `HDR10`, `DD+ 5.1`.                                                                                                                                                                                                  |
| Transport   | play centre 210 px above the bottom         | back 10 (56 px), play/pause (76 px), forward 10 (56 px), 44 px gaps; regular glass.                                                                                                                                                                                                                                                             |
| Timeline    | 44 px hit area, 5 px track                  | full width minus 2 x 16 px                                                                                                                                                                                                                                                                                                                      |
| Times row   | under the track                             | elapsed · current chapter + "ends 22:11" · remaining (tabular)                                                                                                                                                                                                                                                                                  |
| Actions row | bottom at `edge-bottom` (38 px), 44 px tall | Audio and Subtitles (value-first), Speed (`1×`), Episodes (series) or Info (films), Next (series). Labels drop at 419 px wide or less; the speed value stays.                                                                                                                                                                                   |

There are no scrims over the picture in portrait (no text on it except subtitles). When the chrome
hides, everything fades except the picture, the ambient glow and the subtitles.

`phone-portrait-short` (under 760 px tall, including the 320 px width): the picture centre moves to
36%, the transport overlays the picture centre in clear glass (back 48, play 64, forward 48), the
title is one line, the badge row keeps only the Signal chip. At 320 px wide everything fits with no
horizontal overflow and 44 px targets.

### 5.2 iPhone landscape (956 x 440)

| Element      | Geometry                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Picture      | contained in 956 x 440 (Fit), or covering it (Fill); island on a pillar or over the picture                                                                                                                                          |
| Top bar      | top 12 px, sides `edge-x` (48). Left: Close; title block (eyebrow `STRANGER THINGS · SEASON 5 · EPISODE 1`, title 17/22, one line, max width 38% of the viewport). Right: Signal chip, then a glass group: AirPlay, PiP, Lock, Info. |
| Transport    | centred at 50% height: back 10 (56), play (76), forward 10 (56), 72 px gaps, over the radial centre scrim, clear glass                                                                                                               |
| Timeline row | bottom `edge-bottom + 50` (75 px): elapsed (56 px, tabular) · track · remaining (56 px); 44 px hit area                                                                                                                              |
| Actions row  | bottom `edge-bottom` (25 px): left: Audio and Subtitles, Speed; right: Episodes, Next (two-thumb split)                                                                                                                              |
| Subtitles    | lifted by `--hqp-sub-lift: 88px` while the chrome is visible (position Auto)                                                                                                                                                         |
| Scrims       | top 34% and bottom 46% eased, plus the radial centre scrim, all fading with the chrome                                                                                                                                               |

### 5.3 Phone landscape shorter than 380 px tall (693 x 320)

Transport 48/64/48 with 48 px gaps; the title block keeps the title only; actions drop labels
except the speed value; the sheet becomes full height (top 8, bottom 8).

### 5.4 Large (1440 x 900, desktop and iPad)

- Mouse move shows the chrome; 2.5 s idle hides it and the cursor (`cursor: none` on the root).
- Top left: title logo art when `artwork.logoPath` exists (48 px tall, `w500` SVG/PNG from TMDB,
  else the text title), eyebrow, title 26/32, badges with the Signal chip. Top right: AirPlay, PiP,
  Info group, then Close.
- Bottom (24 px from the edge): timeline row (elapsed, track, remaining) above a 44 px bar: play;
  a group (back 10, forward 10, mute, 84 px volume track); chapter and "ends at"; spacer; Audio
  and Subtitles, Speed, Episodes, Next episode; PiP; Fullscreen (only when
  `document.fullscreenEnabled`).
- Hovering the timeline shows the trickplay preview without seeking.
- Click on the picture toggles play; double-click toggles fullscreen; the wheel over the volume
  track changes the volume.
- Subtitle lift `112px`.

### 5.5 Frame geometry

- `.hqp-frame` is sized to the real display aspect (`videoWidth / videoHeight` at
  `loadedmetadata`; 16:9 before that): Fit = `width: min(100cqw, 100cqh * ar)`,
  `aspect-ratio: ar`, centred. Fill = the frame covers the viewport and the video uses
  `object-fit: cover`.
- The frame is `container-type: size` with `overflow: hidden`. Subtitles, the double-tap ripple,
  the peek line, the portrait trickplay overlay and the PiP/AirPlay message live inside it, so
  `cqh` is the picture height and nothing paints the black pillars.
- Fit/Fill changes run as a FLIP on the frame (scale from the contain size to the cover size,
  300 ms `--hqp-spring`), then the geometry swaps with no visible jump.
- Fill crop percent shown in the toast: `100 * (1 - min(ar, vr) / max(ar, vr))` rounded, where
  `vr` is the viewport aspect (16:9 on 956 x 440 crops 18%).
- The choice is remembered per aspect class: `standard` (ar <= 1.85), `wide` (<= 2.2),
  `scope` (> 2.2). Default Fit everywhere.

---

## 6. Interaction model

### 6.1 Touch gestures (on the picture area, never on a control)

One Pointer Events recognizer on the gesture layer (`touch-action: none`, `setPointerCapture`).

| Gesture                | Recognition                                       | Effect                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap                    | down-up under 250 ms and under 10 px              | Toggles the chrome immediately (optimistic).                                                                                                                                                                  |
| Double tap, side zones | second tap within 300 ms in the left or right 35% | Undoes the first tap's chrome toggle; seeks -10 s / +10 s. Each further tap within 600 ms of the previous adds 10 s (label "−20 s", "+30 s"). The engine seek commits 250 ms after the last tap.              |
| Double tap, centre 30% | as above                                          | Fit/Fill toggle in `phone-landscape` and fullscreen `large`; nothing in portrait.                                                                                                                             |
| Long press             | 400 ms, under 10 px                               | 2x while held (`holdRate(true)`); glass pill "2× ▸▸" at top centre (under the band in portrait). Release restores the rate. A pan during the hold turns into a scrub and releases 2x.                         |
| Horizontal pan         | moved over 12 px and abs(dx) > 1.5 abs(dy)        | Relative scrub: the picture width equals `min(25% of duration, 600 s)`. Fine scrub by vertical drift: abs(dy) >= 48 px gives half speed, >= 120 px quarter speed. Preview as section 6.3. Release seeks once. |
| Swipe down             | dy > 12 px first and dy > 1.5 abs(dx)             | The stage follows: `translate: 0 calc(dy * 0.6)` and `scale: 1 - dy / 2000`. Release with dy > 120 px or velocity > 0.5 px/ms closes the player; otherwise springs back.                                      |
| Swipe up               | dy < -60 px or velocity < -0.5 px/ms              | Opens Episodes (series) or Playback info (films).                                                                                                                                                             |
| Pinch                  | two pointers                                      | Live scale on the frame (clamped 0.9 to cover scale x 1.05); release above 1.08 = Fill, below 0.92 = Fit; toast "Fill · crops 18%". Not in portrait.                                                          |
| Locked (landscape)     | any touch                                         | Ignored except a tap, which shows the lock pill for 2 s; a 1 s long press on the pill unlocks.                                                                                                                |

Edge exclusion: in Safari tab mode on iOS (not standalone), gestures starting within 24 px of the
left or right screen edge are ignored (Safari's back swipe wins). No exclusion in Home Screen mode.

Feedback for side double tap: a lens-shaped ripple inside the picture on that side
(`rgb(255 255 255 / 0.13)` half-ellipse, never painting the pillars), three chevrons lighting in
sequence, the accumulated label, and a 3 px emerald peek line along the picture's bottom edge
showing the new position, all for 700 ms. The chrome stays hidden if it was hidden. The live region
says "Back 20 seconds, 40:52".

### 6.2 Timeline

- Track 5 px (radius 3) inside a 44 px hit area; buffered range `--hqp-buffered`, played range
  emerald; both are `scale: var(--p) 1` layers with `transform-origin: left`, never `width`.
- Chapters are 3 px transparent cuts: one `mask-image` linear gradient built from `Chapter[]`.
- Thumb 15 px white with `--hqp-thumb-shadow`, positioned with `translate: calc(var(--p) * 100cqw) 0`
  (the track row is an inline-size container).
- While playing with the chrome visible the played layer gets `transition: scale 250ms linear`
  so 4 Hz clock updates look continuous; the transition is removed during seeks and scrubs.
- Drag = absolute scrub. On grab: track `scale: 1 1.7`, thumb `scale: 1.45`, 180 ms. Fine scrub:
  finger at least 40 px above the track gives half speed, at least 100 px quarter speed; hint
  "Slide up for fine scrubbing" shown until first used (prefs.hints.fineScrub).
- Chapter magnet: snaps to a chapter start within 6 px. Origin tick: 2 px white tick at the
  pre-scrub position; release within 8 px of it cancels the seek.
- Keyboard (role slider): Left/Right 5 s, PageUp/PageDown 60 s, Home/End.
- `aria-valuetext`: "41 minutes 12 seconds of 1 hour 11 minutes, chapter Dans l'Upside Down".

### 6.3 Scrub preview

- Portrait: the whole frame shows the trickplay tile (crossfade 180 ms), the ambient glow
  crossfades to it (600 ms); under the picture: chapter (eyebrow), time 44 px tabular, delta
  "+14:52" in emerald. Title and transport fade out.
- Landscape and large: a 216 px (large 272 px) 16:9 tile with a hairline rim, centre clamped to
  the track edges (12 px from the screen edge), chapter name above, a glass time pill with the delta
  below; the picture dims to 55% (`--hqp-dim`).
- Trickplay `pending` or `unavailable`: time, chapter and delta only.

### 6.4 Keyboard (large layouts; also hardware keyboards on iPad)

The HQP shortcut table lives in `src/lib/player/hqp/shortcuts.ts` (the trailer table in
`src/lib/player/shortcuts.ts` is not changed). Ctrl, Meta and Alt combinations are ignored.

| Keys                 | Action                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Space, K             | Play / pause                                                                                       |
| J / L                | Back / forward 10 s                                                                                |
| Left / Right         | Back / forward 5 s                                                                                 |
| Shift + Left / Right | Previous / next chapter                                                                            |
| Up / Down            | Volume (no-op where volume is read-only)                                                           |
| M                    | Mute                                                                                               |
| F                    | Fullscreen (large only)                                                                            |
| C                    | Subtitles on/off (last used track)                                                                 |
| A                    | Next audio track                                                                                   |
| S                    | Open Audio and Subtitles                                                                           |
| I                    | Playback info                                                                                      |
| E                    | Episodes (series)                                                                                  |
| N                    | Next episode                                                                                       |
| P                    | Picture in Picture                                                                                 |
| 0..9                 | Jump to 0..90%                                                                                     |
| Home / End           | Start / end                                                                                        |
| , and .              | One frame back / forward while paused (1 / fps, default 1/24)                                      |
| < and >              | Slower / faster (SPEEDS)                                                                           |
| ?                    | Shortcut help                                                                                      |
| Esc                  | Close the top-most layer: help, sheet, info, episodes; then exit fullscreen; then close the player |

Any shortcut shows the chrome briefly except seeks while the chrome is hidden, which show only the
peek line and the ripple label.

### 6.5 Chrome visibility (UI `chrome.ts`, pure)

Show on tap, mouse move, key press, focus entering the chrome, and in every paused, buffering,
error, ended or opening state. Hide when all hold: playing, not buffering, no keyboard focus inside
the chrome (`:focus-visible`), no overlay open (sheet, info, episodes, help, up next, error), not
scrubbing, mouse not over a control, not locked-pill, idle at least `prefs.autoHideMs` (default
3000; large: 2500). Hidden chrome gets `visibility: hidden` after its fade so no glass stays
composited.

---

## 7. Control surfaces

### 7.1 Signal chip

A 32 px tall capsule (44 px hit area) inside the badge row (portrait) or the top bar (landscape,
large):

- `session.video.mode === 'copy'`: emerald dot + "Original" (+ " · 4K · HDR10" in landscape and
  large).
- `transcode`: amber dot (`--hqp-warn`) + "Converted" (+ " · 1080p").
- Opening / switching: a neutral dot with "Preparing".
- Tap opens Playback info. `aria-label`: "Stream: original, 4K, HDR10. Open playback info".

### 7.2 Settings sheet (one component, three tabs)

Tabs: **Audio & Subtitles** | **Picture** | **Playback** (each tab 44 px tall; fixed sheet height so
nothing jumps between tabs; tab bodies crossfade 120 ms).

Geometry:

- Portrait: floating sheet at 8 px from the sides and bottom, radius 34/34/54/54 (concentric with
  the display corners). The frame glides up so its top sits at the band edge (62 px); the sheet
  fills from 12 px under the frame to the bottom. Grabber 40 x 5; drag down closes (release
  velocity over 0.5 px/ms or more than 40% travel); rubber band 0.35 past the top.
- Landscape: right panel `min(560px, 60cqw)` wide, right `edge-x`, top 12 px, bottom
  `max(12px, var(--hqp-sa-b))`, radius 34. Subtitles move into the free left area.
- Large: 600 px panel, right `edge-x`, bottom 124 px, height `min(560px, 100cqh - 196px)`,
  origin bottom-right.

Audio & Subtitles tab (two radiogroups; two columns in landscape and large):

- Audio rows (48 px minimum): check, label 16/20 600 (language name, "French (Canada)" when the
  title says VFQ/Canada/Québec), detail 13/17 ("Dolby Digital Plus 5.1 · Original" when known),
  tags `DEFAULT`, `VO` (original language), `AD` (audio description).
- Honest note under Audio: "Passed through untouched" (audioMode `copy`) or "Converted to AAC
  for this browser: it cannot decode E-AC-3" (`transcode`).
- Subtitle rows: Off ("Forced lines still shown" when a forced track exists), then text tracks
  (tags `FORCED`, `AUTO` when chosen by the auto policy, `SDH`, `EXTERNAL`), then image tracks
  disabled with "Image subtitles · not supported here".
- Row "Subtitle style ›" opens the Style page: size S/M/L/XL (4.2 / 4.8 / 5.6 / 6.4 cqh of the
  picture, min 15 px, max 44 px), look Shadow / Outline / Box (box = `--hqp-sub-box`, radius 6),
  colour White / Yellow, position Auto (lifted above the chrome) / Low, sync offset stepper
  (plus or minus 0.1 s, range -10..10, reset), and a live sample line over the picture.
- Footnote: "Changing audio restarts the stream here (about 1 s). Subtitles switch instantly."
  Hidden on `phone-portrait-short`, where a toast says it after the switch.

Picture tab: Quality radiogroup (section 4.2) with the reason line of the active session; Frame
Fit / Fill (crop percent shown); HDR status row ("HDR shown on this display", "Tone-mapped to SDR",
"SDR source"); "Add to Home Screen for edge-to-edge" row only in iOS Safari tab mode.

Playback tab: Speed segmented row (SPEEDS 0.5..2, "Long-press the picture for 2×"); Sleep timer
Off / End of episode (or film) / 15 / 30 / 60 min; Autoplay next episode switch; Lite glass switch
(solid fills instead of blur).

### 7.3 Playback info (stats for nerds)

A non-modal thick-glass panel that stays open while the chrome hides and refreshes at 1 Hz only
while open. Placement: portrait between the picture and the timeline (the transport hides while
it is open); landscape top-right under the top bar (380 px wide, the transport shifts 120 px left);
large top-left under the title.

Rows: Stream (Direct / Converted + `session.video.reason`); Video (codec, profile, WxH, fps, bit
depth); HDR (kind, and "shown" / "tone-mapped"); Audio (language, codec, channels, copy or
converted); Subtitles (format and conversion, or Off); Delivery (HLS fMP4, segment length, native
or hls.js); Bitrate (measured, file); Network (throughput, or "—" when not measurable); Buffer
(seconds ahead with an emerald meter); Frames (dropped / total); Screen (CSS WxH @ DPR, device
pixels, refresh rate, dynamic range); Session (short id). Actions: Copy diagnostics (JSON to the
clipboard), Reload stream (restart the session at the current position). Values a contract does
not carry show "—".

### 7.4 Up next (series)

- Trigger: when a next item exists. At the start of the last chapter whose title matches
  `/cr[ée]dits|g[ée]n[ée]rique de fin|end credits|closing credits/i` and that starts at 85% of the
  duration or later; otherwise at `duration - max(45 s, 2% of duration)`; or at `ended`.
  `PlaybackSession.creditsStart` is used when it exists (section 17).
- Landscape: the frame springs to scale 0.6, radius 22, centred near the top (460 ms
  `--hqp-spring`); a thick-glass card at the bottom (`min(720px, 100cqw - 2 * edge-x)` wide): next
  still, eyebrow `NEXT · EPISODE 2` (emerald), 2-line title, meta "58 min · 4K · HDR10", a white
  "Play now" CTA with a 24 px countdown ring (10 s), and a glass "Credits" button that restores the
  frame and cancels. A blurred backdrop of the next still fades in behind (600 ms).
- Portrait: the picture keeps its size; the card replaces the title block and the transport; the
  timeline stays.
- Large: frame scale 0.7, radius 26, same card.
- The countdown pauses while the user touches the screen or scrubs, and resumes 2 s after.
  Autoplay off: no countdown, "Play next" button only.
- After 3 consecutive autoplays with no user input: "Still watching?" card (Continue / Stop) and no
  autoplay.

### 7.5 End card (films, and the last episode)

At `ended`: the picture dims to 40%; card "Finished" with the title, primary "Back to <title>"
(link to `titleHref`) and "Watch again"; progress is saved as completed.

### 7.6 Episodes drawer (series)

Same geometry as the sheet. Season segmented control (seasons present in the queue); rows with a
16:9 still (`w300`, 120 px wide, lazy, async decode) with a progress bar on it, "E2 · 58 min",
title, completed check; the current episode has an emerald rim and "Now playing". Choosing a row
calls `playIndex(i)`.

### 7.7 Resume capsule

When the engine resumed from saved progress: a glass capsule "Resumed at 41:12 · Start over" for
6 s, above the timeline (landscape, large) or under the title block (portrait). "Start over" calls
`startOver()`.

### 7.8 Skip intro

While `state.skipIntro` is set (an opening chapter: title matches
`/^(opening|intro|générique|generique|g[ée]n[ée]rique d'ouverture|previously|pr[ée]c[ée]demment|recap|r[ée]sum[ée])/i`,
starting before 25% of the duration and at most 4 min long): a white capsule "Skip intro" at the
bottom right above the actions row. Visible without the chrome for the first 8 s of the chapter,
then only with the chrome. Tap seeks to the chapter end.

### 7.9 Toasts and pills

Top centre under the top bar, regular glass, one at a time (queue), 1.6 s for confirmations,
4 s with an action. Pills: 2x hold, lock, offline ("Offline · 48 s buffered"), buffering ahead.

### 7.10 Lock (landscape)

Lock button in the top bar. Locked: the chrome hides, every gesture is ignored, a tap shows the
lock pill for 2 s, a 1 s long press on the pill unlocks (with a filling ring).

### 7.11 Shortcut help

`?` opens a thick-glass dialog listing `HQP_SHORTCUTS` (keys in `<kbd>`).

### 7.12 System integration

- **Picture in Picture**: `video.webkitSetPresentationMode('picture-in-picture')` on Apple when
  `webkitSupportsPresentationMode` is true, else `video.requestPictureInPicture()`. The video has
  `autopictureinpicture` so leaving the Home Screen app keeps playing in PiP. While PiP is active
  the frame shows "Playing in Picture in Picture" with a "Return" button.
- **AirPlay**: `video.webkitShowPlaybackTargetPicker()`; the button appears only after
  `webkitplaybacktargetavailabilitychanged` reports `available`; while
  `webkitCurrentPlaybackTargetIsWireless` the frame shows "Playing on AirPlay". Native HLS only.
- **Media Session**: metadata (title = item title; artist = show title or year; album = "Alan's
  HQP"; artwork = TMDB still/backdrop `w780` and `w1280`); handlers play, pause, seekbackward and
  seekforward (10 s), seekto, previoustrack (chapter start, or restart), nexttrack (next item, or
  null when none); `setPositionState` on `loadedmetadata`, `seeked`, `ratechange`, `play`, `pause`.
- **Screen Wake Lock**: requested on `playing`; released 5 min after a pause, on `ended`, and when
  the page is hidden; re-acquired on `visibilitychange` to visible while playing.
- **Native subtitles**: the engine adds a `<track kind="subtitles">` per text subtitle (WebVTT URL
  from the session), all `mode = 'hidden'` (our renderer reads cues); the shown track flips to
  `'showing'` while PiP, AirPlay or native fullscreen is active, back to `'hidden'` after.
- **Home Screen hint**: on iOS Safari tab mode (`!matchMedia('(display-mode: standalone)').matches`
  and `!navigator.standalone`), once (`prefs.hints.homeScreen`): toast "Add Alan DB to your Home
  Screen for edge-to-edge playback" with "How", which opens a 3-step mini sheet.

---

## 8. States

| State                                                | Trigger                                    | What the owner sees                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening                                              | `starting`, `loading`                      | Blurred still (`w1280`, `filter: blur(24px)`, dim 0.5) inside the frame, title, a hairline indeterminate line at the picture's bottom edge; no spinner before 400 ms; Signal chip "Preparing". |
| Autoplay blocked                                     | `play()` rejected (`autoplayBlocked`)      | The still, a 76 px white play button "Play", the title; one tap plays.                                                                                                                         |
| Playing                                              | `playing`                                  | Picture, subtitles; chrome per section 6.5.                                                                                                                                                    |
| Paused                                               | `paused`                                   | Chrome stays; play glyph.                                                                                                                                                                      |
| Buffering                                            | `buffering` for 500 ms or more             | A 2 px emerald arc turning inside the play capsule instead of the glyph; Signal chip adds "Buffering". No full-screen spinner.                                                                 |
| Switching                                            | `switching` (quality or audio)             | The picture fades to 0.6 over 120 ms, a toast "Switching to English…", back on `playing`; position kept.                                                                                       |
| Offline                                              | `online` false, or repeated network errors | Pill "Offline · 48 s buffered"; playback continues from the buffer; retries back off 2/4/8/16/30 s. After 60 s without recovery: error card.                                                   |
| Skip intro / resume / up next / still watching / end | sections 7.4 to 7.8                        |                                                                                                                                                                                                |
| PiP / AirPlay active                                 | section 7.12                               | Message in the frame; controls stay usable.                                                                                                                                                    |
| Locked                                               | section 7.10                               |                                                                                                                                                                                                |
| Error: unauthorized (401)                            |                                            | Card "Your session expired" · Sign in (`/auth/login?returnTo=/watch/<fileId>`).                                                                                                                |
| Error: forbidden or not found (403/404)              |                                            | "This file isn't available" · Back.                                                                                                                                                            |
| Error: gone (409)                                    |                                            | "This file has moved or is gone from the library" · Back.                                                                                                                                      |
| Error: library offline (503)                         |                                            | "The media library is offline" · "The PC that holds the films is not reachable, or streaming is turned off." · Retry.                                                                          |
| Error: decode                                        | section 4.4                                | "This device couldn't play this stream" · Try 1080p (converted) · Retry.                                                                                                                       |
| Error: network                                       |                                            | "Connection lost" · Retry.                                                                                                                                                                     |
| Error: unsupported                                   | no HLS path                                | "This browser can't play HLS video" · Back.                                                                                                                                                    |
| Error: bad request / unknown                         |                                            | Server message · Retry · Copy details.                                                                                                                                                         |

Error cards are thick glass, centred, with a rose icon tile (`--hqp-error`), the server's `{error}`
text when present, and keyboard focus moved to the primary action.

---

## 9. Visual language

### 9.1 Principles

- The picture is the only bright thing. Everything else is OLED black, a few glass capsules and
  white type.
- **Emerald (`--brand-primary`) is spent only on truth and progress**: played range, checks,
  selected tags (`AUTO`, `DIRECT`, `DEFAULT`), the Original dot and badge, "Direct" and "HDR shown"
  in Playback info, the scrub delta, the countdown ring, the peek line, the buffering arc, focus
  rings, switches on. Never on large fills. The primary CTA is white with black text.
- **Amber always means converted. Rose always means error.**

### 9.2 Token file: `src/lib/components/hqp/hqp-tokens.css` (created by ui, verbatim)

This file is the only place raw colours live for the HQP. It maps onto `src/app.css`.

```css
/* Alan's HQP tokens and materials. Imported once by HqpPlayer.svelte. */
:where(.hqp) {
	/* Ink */
	--hqp-black: rgb(0 0 0);
	--hqp-ink: var(--content-primary);
	--hqp-ink-2: rgb(245 247 250 / 0.74);
	--hqp-ink-3: rgb(245 247 250 / 0.52);
	--hqp-ink-on-light: rgb(6 8 10);
	--hqp-cta: rgb(245 247 250);

	/* Accents */
	--hqp-accent: var(--brand-primary);
	--hqp-accent-ink: var(--content-inverse);
	--hqp-accent-soft: rgb(52 211 153 / 0.16);
	--hqp-accent-rim: rgb(52 211 153 / 0.45);
	--hqp-warn: var(--color-warning);
	--hqp-warn-soft: rgb(251 191 36 / 0.16);
	--hqp-error: var(--color-error);
	--hqp-error-soft: rgb(251 113 133 / 0.16);

	/* Flat fills (inside glass, never glass on glass) */
	--hqp-fill-row: rgb(255 255 255 / 0.07);
	--hqp-fill-selected: rgb(255 255 255 / 0.12);
	--hqp-fill-press: rgb(255 255 255 / 0.16);

	/* Liquid Glass material */
	--hqp-glass-tint: rgb(20 22 27 / 0.4);
	--hqp-glass-tint-thick: rgb(14 16 20 / 0.62);
	--hqp-glass-tint-clear: rgb(255 255 255 / 0.06);
	--hqp-glass-sheen: rgb(255 255 255 / 0.11);
	--hqp-glass-sheen-end: rgb(255 255 255 / 0);
	--hqp-glass-sheen-clear: rgb(255 255 255 / 0.16);
	--hqp-glass-sheen-clear-end: rgb(255 255 255 / 0.04);
	--hqp-glass-rim: rgb(255 255 255 / 0.18);
	--hqp-glass-spec: rgb(255 255 255 / 0.42);
	--hqp-glass-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.55);
	--hqp-glass-shadow-thick: 0 24px 64px -20px rgb(0 0 0 / 0.6);
	--hqp-glass-filter: blur(22px) saturate(1.35) brightness(0.74);
	--hqp-glass-filter-thick: blur(34px) saturate(1.5) brightness(0.62);
	--hqp-glass-filter-clear: blur(14px) saturate(1.15) brightness(0.86);
	--hqp-glass-solid: rgb(14 16 20 / 0.86);
	--hqp-glyph-shadow: drop-shadow(0 1px 3px rgb(0 0 0 / 0.35));

	/* Scrims (eased stops, no OLED banding); --hqp-scrim-k boosts them over HDR */
	--hqp-scrim-k: 1;
	--hqp-scrim-a: rgb(0 0 0 / calc(0.72 * var(--hqp-scrim-k)));
	--hqp-scrim-b: rgb(0 0 0 / calc(0.46 * var(--hqp-scrim-k)));
	--hqp-scrim-c: rgb(0 0 0 / calc(0.2 * var(--hqp-scrim-k)));
	--hqp-scrim-d: rgb(0 0 0 / calc(0.06 * var(--hqp-scrim-k)));
	--hqp-scrim-0: rgb(0 0 0 / 0);
	--hqp-scrim-centre: rgb(0 0 0 / 0.3);
	--hqp-scrim-centre-mid: rgb(0 0 0 / 0.12);
	--hqp-dim: rgb(0 0 0 / 0.5);
	--hqp-ripple: rgb(255 255 255 / 0.13);

	/* Timeline */
	--hqp-track: rgb(255 255 255 / 0.24);
	--hqp-buffered: rgb(255 255 255 / 0.46);
	--hqp-played: var(--hqp-accent);
	--hqp-thumb: var(--hqp-ink);
	--hqp-thumb-shadow: 0 1px 6px rgb(0 0 0 / 0.5);

	/* Subtitles */
	--hqp-sub-white: rgb(245 247 250);
	--hqp-sub-yellow: rgb(255 226 92);
	--hqp-sub-shadow:
		0 0 2px rgb(0 0 0 / 0.9), 0 1px 3px rgb(0 0 0 / 0.75), 0 0 14px rgb(0 0 0 / 0.45);
	--hqp-sub-outline:
		-1px -1px 0 rgb(0 0 0 / 0.9), 1px -1px 0 rgb(0 0 0 / 0.9), -1px 1px 0 rgb(0 0 0 / 0.9),
		1px 1px 0 rgb(0 0 0 / 0.9), 0 0 8px rgb(0 0 0 / 0.5);
	--hqp-sub-box: rgb(0 0 0 / 0.6);
	--hqp-sub-lift: 0px;

	/* Hairline: exactly one physical pixel */
	--hqp-hairline: 1px;

	/* Type */
	--hqp-font: var(--font-sans);
	--hqp-caption-font: -apple-system, 'SF Pro Text', var(--font-sans);

	/* Radii (concentric with the ~62pt display corner) */
	--hqp-r-capsule: 999px;
	--hqp-r-tag: 6px;
	--hqp-r-tile: 14px;
	--hqp-r-card: 24px;
	--hqp-r-panel: 34px;
	--hqp-r-sheet-bottom: 54px;

	/* Motion */
	--hqp-ease-out: cubic-bezier(0.2, 0, 0, 1);
	--hqp-ease-in: cubic-bezier(0.4, 0, 1, 1);
	--hqp-spring: linear(
		0,
		0.063 2.3%,
		0.237 5%,
		0.512 8.7%,
		0.758 12.8%,
		0.897 16.6%,
		0.968 20.6%,
		1.006 25.3%,
		1.019 30.6%,
		1.012 39.4%,
		1.001 52%,
		1
	);
	--hqp-dur-press: 90ms;
	--hqp-dur-in: 180ms;
	--hqp-dur-out: 280ms;
	--hqp-dur-panel: 460ms;
	--hqp-dur-fade: 120ms;

	/* Stacking inside the player (the root is isolation: isolate) */
	--hqp-z-frame: 0;
	--hqp-z-subs: 1;
	--hqp-z-dim: 2;
	--hqp-z-scrim: 3;
	--hqp-z-transport: 4;
	--hqp-z-chrome: 5;
	--hqp-z-panel: 6;
	--hqp-z-toast: 7;
	--hqp-z-alert: 8;

	/* Safe areas and island-free edges (section 3) */
	--hqp-sa-t: env(safe-area-inset-top, 0px);
	--hqp-sa-r: env(safe-area-inset-right, 0px);
	--hqp-sa-b: env(safe-area-inset-bottom, 0px);
	--hqp-sa-l: env(safe-area-inset-left, 0px);
	--hqp-edge-top: min(var(--hqp-sa-t), 47px);
	--hqp-edge-x: clamp(16px, max(var(--hqp-sa-l), var(--hqp-sa-r)) - 14px, 48px);
	--hqp-edge-bottom: calc(max(var(--hqp-sa-b), 14px) + 4px);
}
@media (min-resolution: 2dppx) {
	:where(.hqp) {
		--hqp-hairline: 0.5px;
	}
}
@media (min-resolution: 3dppx) {
	:where(.hqp) {
		--hqp-hairline: 0.34px;
	}
}
@media (orientation: landscape) and (max-height: 499px) {
	:where(.hqp) {
		--hqp-sub-lift: 88px;
	}
}
/* "large": the exact complement of phone-portrait and phone-landscape */
@media (orientation: portrait) and (min-width: 600px),
	(orientation: landscape) and (min-height: 500px) {
	:where(.hqp) {
		--hqp-edge-x: 48px;
		--hqp-sub-lift: 112px;
	}
}
:where(.hqp[data-hdr='on']) {
	--hqp-scrim-k: 1.25;
}

/* Materials */
:where(.hqp) .hqp-glass {
	background:
		linear-gradient(180deg, var(--hqp-glass-sheen), var(--hqp-glass-sheen-end) 55%),
		var(--hqp-glass-tint);
	-webkit-backdrop-filter: var(--hqp-glass-filter);
	backdrop-filter: var(--hqp-glass-filter);
	box-shadow:
		inset 0 var(--hqp-hairline) 0 var(--hqp-glass-spec),
		inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim),
		var(--hqp-glass-shadow);
}
:where(.hqp) .hqp-glass--thick {
	background:
		linear-gradient(180deg, var(--hqp-glass-sheen), var(--hqp-glass-sheen-end) 40%),
		var(--hqp-glass-tint-thick);
	-webkit-backdrop-filter: var(--hqp-glass-filter-thick);
	backdrop-filter: var(--hqp-glass-filter-thick);
	box-shadow:
		inset 0 var(--hqp-hairline) 0 var(--hqp-glass-spec),
		inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim),
		var(--hqp-glass-shadow-thick);
}
:where(.hqp) .hqp-glass--clear {
	background:
		linear-gradient(180deg, var(--hqp-glass-sheen-clear), var(--hqp-glass-sheen-clear-end)),
		var(--hqp-glass-tint-clear);
	-webkit-backdrop-filter: var(--hqp-glass-filter-clear);
	backdrop-filter: var(--hqp-glass-filter-clear);
	box-shadow:
		inset 0 var(--hqp-hairline) 0 var(--hqp-glass-spec),
		inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
}
:where(.hqp) .hqp-glass--clear :is(svg) {
	filter: var(--hqp-glyph-shadow);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	:where(.hqp) :is(.hqp-glass, .hqp-glass--thick, .hqp-glass--clear) {
		background: var(--hqp-glass-solid);
	}
}
@media (prefers-reduced-transparency: reduce) {
	:where(.hqp) :is(.hqp-glass, .hqp-glass--thick, .hqp-glass--clear) {
		background: var(--hqp-glass-solid);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
}
:where(.hqp[data-lite-glass]) :is(.hqp-glass, .hqp-glass--thick, .hqp-glass--clear) {
	background: var(--hqp-glass-solid);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}

/* Test and demo only: simulated iPhone 18 Pro Max insets (section 3.4) */
@media (orientation: portrait) {
	:where(html[data-hqp-sim='iphone18']) .hqp {
		--hqp-sa-t: 62px;
		--hqp-sa-r: 0px;
		--hqp-sa-b: 34px;
		--hqp-sa-l: 0px;
	}
	:where(html[data-hqp-sim='iphone13']) .hqp {
		--hqp-sa-t: 47px;
		--hqp-sa-r: 0px;
		--hqp-sa-b: 34px;
		--hqp-sa-l: 0px;
	}
}
@media (orientation: landscape) {
	:where(html[data-hqp-sim='iphone18']) .hqp {
		--hqp-sa-t: 0px;
		--hqp-sa-r: 62px;
		--hqp-sa-b: 21px;
		--hqp-sa-l: 62px;
	}
	:where(html[data-hqp-sim='iphone13']) .hqp {
		--hqp-sa-t: 0px;
		--hqp-sa-r: 47px;
		--hqp-sa-b: 21px;
		--hqp-sa-l: 47px;
	}
}
```

Note: `--ease-spring` in `app.css` is a different overshooting curve; the HQP uses only
`--hqp-spring` (about 2% overshoot, close to a critically damped UIKit spring).

### 9.3 Glass usage rules (cost over moving 4K HDR video)

Every `backdrop-filter` region is re-blurred on every composited frame (24 to 60 fps video, up to
120 Hz while animating), at device resolution (9x the CSS pixels at DPR 3).

- Regular glass: capsules (top bar buttons and groups, actions, Signal chip, toasts, pills).
- Clear glass: the transport over the picture.
- Thick glass: sheet, info panel, up next card, episodes drawer, error card, help.
- At most 8 small glass surfaces (about 9% of the portrait screen) with the chrome visible; 0 when
  hidden (`visibility: hidden` after the fade); at most one thick surface at a time.
- Never animate blur radius or `backdrop-filter`; animate only the element's opacity and transform.
- Never stack glass on glass (rows inside panels use flat `--hqp-fill-*`).
- Expected cost under 1.5 ms GPU per frame on a current A-series chip: to measure on device with
  Safari Web Inspector timelines.

### 9.4 Scrims (landscape and large only)

```css
.hqp-scrim-top {
	top: 0;
	height: 34%;
	background: linear-gradient(
		180deg,
		var(--hqp-scrim-a),
		var(--hqp-scrim-b) 30%,
		var(--hqp-scrim-c) 62%,
		var(--hqp-scrim-d) 84%,
		var(--hqp-scrim-0)
	);
}
.hqp-scrim-bottom {
	bottom: 0;
	height: 46%;
	background: linear-gradient(
		0deg,
		var(--hqp-scrim-a),
		var(--hqp-scrim-b) 34%,
		var(--hqp-scrim-c) 64%,
		var(--hqp-scrim-d) 86%,
		var(--hqp-scrim-0)
	);
}
.hqp-scrim-centre {
	inset: 0;
	background: radial-gradient(
		closest-side,
		var(--hqp-scrim-centre),
		var(--hqp-scrim-centre-mid) 55%,
		var(--hqp-scrim-0)
	);
	width: 70cqh;
	height: 70cqh;
	margin: auto;
}
```

Large layouts use 26% (top) and 40% (bottom). Scrims fade with the chrome.

### 9.5 Type (Plus Jakarta Sans, the site font; `font-variant-numeric: tabular-nums` on every time)

At about 460 ppi and DPR 3, 1 CSS px is about 0.166 mm. Nothing below 10.5 px; nothing lighter
than 500 over video.

| Role                  | Size / line height, weight, tracking                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Eyebrow               | 12/16, 700, +0.08em, uppercase                                                                                                                                                             |
| Time, chapter         | 13/16, 600 (chapter in `--hqp-ink-2`)                                                                                                                                                      |
| Control label         | 15/20, 600 (14 in portrait)                                                                                                                                                                |
| Row label / detail    | 16/20 600 / 13/17 500 `--hqp-ink-3`                                                                                                                                                        |
| Tag, badge            | 10.5/12, 700, +0.04em                                                                                                                                                                      |
| Panel title           | 19/24, 700                                                                                                                                                                                 |
| Landscape title       | 17/22, 700, -0.01em                                                                                                                                                                        |
| Portrait title        | 22/27, 700, -0.01em                                                                                                                                                                        |
| Large title           | 26/32, 700, -0.015em                                                                                                                                                                       |
| Scrub time (portrait) | 44/48, 700, -0.02em                                                                                                                                                                        |
| Subtitles             | `clamp(15px, var(--hqp-sub-size, 4.8cqh), 44px)` of the picture height, weight 600, line height 1.22, `text-wrap: balance`, `--hqp-caption-font`; French typography: U+202F before ? ! : ; |

### 9.6 Icons

One inline SVG sprite (`<symbol>`s), viewBox 24, stroke 1.8, round caps and joins,
`currentColor`, rendered at 22 px (20 in capsules, 28 for skip, 32 for play):
chevron-down, close, play, pause, back-10 and forward-10 (arc, arrowhead and "10" as SVG text,
weight 800), airplay, pip, pip-exit, lock, unlock, info, subtitles, audio (waveform), speed (gauge),
episodes (stack), next (skip-next), volume, volume-mute, fullscreen, fullscreen-exit, check,
chevron-right, chevron-left, quality (sparkle), moon (sleep), alert, refresh, wifi-off. No icon
fonts, no PNGs, no `lucide-svelte` inside the HQP.

### 9.7 Touch targets and focus

Every control at least 44 x 44 (visible capsules may be 32 to 34 px with an `::after` hit
extension). Transport 56/76. CTA 48 tall. Sheet rows 48 minimum. Timeline hit 44.
`:focus-visible { outline: 2px solid var(--hqp-accent); outline-offset: 3px; }` following the
radius.

---

## 10. Motion

### 10.1 What animates (transform and opacity only)

| Element            | Animation                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome show        | opacity 0 to 1 and `translate` 6 px to 0 (top bar from above, bottom from below), 180 ms `--hqp-ease-out`                                                                         |
| Chrome hide        | 280 ms `--hqp-ease-in`, then `visibility: hidden` (transition delay 280 ms)                                                                                                       |
| Press              | `scale: 0.92` on buttons, 0.95 on capsules, 90 ms                                                                                                                                 |
| Timeline grab      | track `scale: 1 1.7`, thumb `scale: 1.45`, 180 ms                                                                                                                                 |
| Preview tile       | opacity and `scale` 0.96 to 1, 180 ms spring, origin bottom centre; follows the finger with `translate` (no transition)                                                           |
| Portrait scrub     | trickplay crossfade over the frame 180 ms; ambient crossfade 600 ms                                                                                                               |
| Sheet open         | frame `translate` to the band edge and sheet `translate` 100% to 0 on 460 ms `--hqp-spring`; drag follows the finger 1:1; release settles on the spring from the release velocity |
| Panel close        | 240 ms `--hqp-ease-in`, no spring                                                                                                                                                 |
| Info panel         | opacity and `translate` 8 px, 180 ms                                                                                                                                              |
| Credits shrink     | frame `scale` 1 to 0.6 / 0.7 and `translate`, radius 0 to 22/26, 460 ms spring; card `translate` 24 px in 320 ms, 80 ms after; next backdrop fades in 600 ms                      |
| Countdown ring     | `stroke-dashoffset` linear over 10 s on a 24 px SVG                                                                                                                               |
| Double-tap ripple  | lens opacity 0 to 1 in 120 ms, holds, out 300 ms; tap circle `scale` 0.6 to 1.2; chevrons light in sequence with a 90 ms stagger; peek line fades after 700 ms                    |
| 2x pill            | in 180 ms; chevrons pulse at 1 Hz                                                                                                                                                 |
| Fit/Fill           | FLIP `scale` on the frame, 300 ms spring; pinch follows live then settles                                                                                                         |
| Swipe-down dismiss | stage follows the finger; release closes (220 ms ease-in to translate 100%) or springs back                                                                                       |
| Switches           | knob `translate` on the spring, track colour 180 ms                                                                                                                               |
| Toasts             | opacity and `translate` 6 px, 180 ms in, 200 ms out                                                                                                                               |
| Buffering arc      | `rotate`, 900 ms linear, only while buffering                                                                                                                                     |

### 10.2 120 Hz rules

- Never animate width, height, top, left, padding, box-shadow, filter or backdrop-filter.
- Pointer moves are coalesced into one `requestAnimationFrame` write per frame of CSS custom
  properties (`--p`, `--sp`, `--dy`); rects are measured at `pointerdown` and on resize only; no
  layout reads after writes.
- Clock text updates at most 4 Hz with the chrome visible and 1 Hz when hidden, into fixed-width
  tabular spans with `contain: layout paint`.
- Zero JavaScript per frame while playing with the chrome hidden (no rAF loop; only subtitle
  `cuechange` and the 1 Hz clock).
- `will-change: transform` only on the element under a gesture or transition, removed at
  `pointerup` / `transitionend`.
- Passive listeners everywhere except the gesture layer and the timeline (`touch-action: none`).

### 10.3 Reduced motion (`prefers-reduced-motion: reduce`)

No translate or scale on the chrome, sheets or frame: opacity crossfades of 120 ms. Credits shrink
becomes a crossfade to the card over a dimmed full-size picture. The ripple is a static lens with
the label for 700 ms. The ambient glow does not crossfade. The countdown ring becomes the text
"Next in 10 s". The 2x pill does not pulse. The buffering arc becomes a static ring with
"Loading". The sheet appears without slide. Implemented per component (no global override).

---

## 11. Accessibility

- The player root is `<div class="hqp" role="region" aria-label="Alan's HQP: {title}">` inside the
  layout's existing `<main>` (no new `<main>`). Focus moves to the root (`tabindex="-1"`) on mount.
- Every control has an accessible name that includes its value ("Audio and subtitles: French 5.1,
  subtitles French forced"; "Speed 1x"; "Quality Auto, playing Original").
- Timeline: `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and the
  chapter-aware `aria-valuetext` of section 6.2.
- One polite live region announces seeks, track and quality changes, resume, the up next card
  (once, not every second), sleep timer and errors (errors use `role="alert"`).
- Sheet, episodes drawer, help and error card are dialogs with a focus trap, Esc to close, and focus
  restored to the opener. The info panel is a non-modal region.
- Auto-hide is suspended while keyboard focus is inside the chrome or any overlay is open.
- Our subtitle renderer is `aria-hidden="true"` (visual captions); native tracks carry `srclang`
  and labels.
- Reduced motion (section 10.3) and reduced transparency (solid fills) are honoured; "Lite glass"
  is available as a setting.
- Text on video always sits on a scrim or glass; `--hqp-ink-2` on the glass tint is at least 4.5:1.
- 44 px targets, visible 2 px emerald focus ring, no horizontal overflow at 320 px.

---

## 12. Performance budget

| Budget                               | Target                                                                                                                                                                          | How it is measured                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HQP JavaScript excluding hls.js      | at most 45 kB gzip (engine about 16, UI about 26, route about 3)                                                                                                                | Lead after `pnpm build`: gzip of the `/watch` route node and its chunks that come from `src/lib/player/hqp`, `src/lib/components/hqp` and the route, excluding `hls.js`                                     |
| HQP CSS                              | at most 12 kB gzip                                                                                                                                                              | same build check                                                                                                                                                                                            |
| hls.js                               | 0 kB on Apple devices; `hls.js/light` dynamic import elsewhere                                                                                                                  | network panel / e2e request log                                                                                                                                                                             |
| Controls INP                         | under 100 ms with 4x CPU throttle (target 50 ms on iPhone)                                                                                                                      | e2e: CDP `Emulation.setCPUThrottlingRate(4)`, `PerformanceObserver({ type: 'event', durationThreshold: 16 })` over tap play, toggle chrome, open sheet, select subtitle, select tab; max duration under 100 |
| Long tasks while playing             | none over 50 ms                                                                                                                                                                 | e2e: `longtask` observer for 20 s of playback (chrome hidden 10 s, visible 10 s)                                                                                                                            |
| Layout shift when the chrome appears | 0 (sum under 0.001)                                                                                                                                                             | e2e: `layout-shift` observer across 5 show/hide cycles                                                                                                                                                      |
| Tap to chrome                        | next frame (one attribute toggle, no layout read)                                                                                                                               | code review + INP test                                                                                                                                                                                      |
| Seek                                 | first frame within 600 ms of release for direct streams on the LAN                                                                                                              | e2e timing `seeking` to `seeked`/`playing` (informative)                                                                                                                                                    |
| Glass                                | at most 8 small surfaces visible, 0 hidden, one thick at a time                                                                                                                 | e2e DOM count of visible `.hqp-glass*`                                                                                                                                                                      |
| Memory                               | trickplay at most 3 decoded sheets (LRU, about 40 MB); hls.js `maxBufferLength 60`, `maxMaxBufferLength 120`, `backBufferLength 30`, `maxBufferSize 120e6`, `enableWorker true` | code review                                                                                                                                                                                                 |
| Battery                              | direct stream when decodable; no canvas or WebGL in the playback path; no timer faster than 1 Hz while playing hidden; progress every 10 s; wake lock only while playing        | code review                                                                                                                                                                                                 |
| Network                              | chapters fetched once per session; trickplay manifest on first scrub or hover; sheets on demand (current plus neighbours); no polling                                           | e2e request log                                                                                                                                                                                             |

---

## 13. Architecture

### 13.1 Overview

```
/movies/[id], /tv/[id], Home, /my/films       (integration: links only, no player code)
        │  <a href="/watch/<fileId>">
        ▼
/watch/[fileId] +page.server.ts                (integration: owner check, buildLaunchPayload)
        │  data.launch: HqpLaunchPayload, data.startAt
        ▼
/watch/[fileId] +page.svelte ── <HqpPlayer launch startAt onclose onitemchange />   (ui)
        │  createHqpEngine() ; engine.attach(video) ; engine.load(launch, { startAt })
        ▼
src/lib/player/hqp (engine, framework-agnostic)
   caps ─ api ─ transport(native | hls.js light) ─ abr ─ progress ─ upnext ─ subtitles
   ─ media-session ─ wake-lock ─ system(PiP, AirPlay, fullscreen) ─ metrics ─ sleep ─ prefs
        │  fetch
        ▼
/api/media/** (stream-server)          src/lib/server/media/repository.ts (library-data)
```

The player is a route, `/watch/[fileId]`: deep-linkable, reload-safe (resume from server
progress), Back closes it, it works as a Home Screen app, and leaving it destroys the session (no
leaked ffmpeg). Next episodes play in place and the URL follows with SvelteKit shallow
`replaceState`. The `(cinema)` layout renders in an immersive mode for this route (no top bar,
footer, tab bar or search palette).

### 13.2 Engine contract: `src/lib/player/hqp/types.ts` (created by engine, verbatim)

```ts
// Alan's HQP engine contract. Pure types: safe to import from server code.
// hls.js/light ships no .d.ts: the engine adds src/lib/player/hqp/hls-light.d.ts containing
//   declare module 'hls.js/light' { export { default } from 'hls.js'; export * from 'hls.js'; }
import type HlsDefault from 'hls.js';
import type {
	Chapter,
	ClientCaps,
	HdrKind,
	PlayableFile,
	PlaybackSession,
	ProgressEntry,
	QualityLevel,
	TrickplayManifest
} from '$lib/media/types';

/** Svelte-compatible store contract: subscribe calls run synchronously with the current value. */
export interface Readable<T> {
	subscribe(run: (value: T) => void): () => void;
}

export type HqpStatus =
	| 'idle'
	| 'starting' // fetching caps and creating the session
	| 'loading' // source attached, waiting for the first frame
	| 'playing'
	| 'paused'
	| 'buffering'
	| 'switching' // quality or audio restart in progress
	| 'ended'
	| 'error';

export type QualityChoice = 'auto' | QualityLevel;
export type FrameMode = 'fit' | 'fill';
/** Picture aspect classes for remembering Fit/Fill: <= 1.85, <= 2.2, > 2.2. */
export type AspectClass = 'standard' | 'wide' | 'scope';
export type SleepMode = 'off' | 'end-of-item' | 15 | 30 | 60;
export type Delivery = 'native' | 'hls.js';

export interface HqpArtwork {
	stillPath: string | null; // TMDB path, 16:9: the episode still, or the film backdrop
	backdropPath: string | null;
	posterPath: string | null;
	logoPath: string | null;
}

export interface HqpItem {
	fileId: string;
	kind: 'movie' | 'episode';
	title: string; // film title, or episode name ("Episode 3" when unnamed)
	showTitle: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	overview: string | null;
	year: number | null;
	runtimeMinutes: number | null;
	originalLanguage: string | null; // ISO 639-1 from TMDB ('en'); marks the VO audio track
	artwork: HqpArtwork;
	titleHref: string; // /movies/<id>, /tv/<tmdbId>?season=<n>, or /my/films?tab=local
	file: PlayableFile;
	progress: ProgressEntry | null; // saved progress when the page was loaded
}

export interface HqpLaunchPayload {
	queue: HqpItem[]; // film: [film]; series: every local episode of the show, (season, episode) order
	index: number; // the item to play
	returnHref: string; // where Close goes when there is no in-site history entry
}

export interface HqpLoadOptions {
	startAt?: number | 'resume'; // default 'resume'
	autoplay?: boolean; // default true
}

export type HqpErrorCode =
	| 'unauthorized' // 401
	| 'forbidden' // 403
	| 'not-found' // 404
	| 'gone' // 409: the file moved or was deleted
	| 'library-offline' // 503
	| 'bad-request' // 400
	| 'network'
	| 'decode'
	| 'unsupported' // no native HLS and no MSE
	| 'unknown';

export interface HqpError {
	code: HqpErrorCode;
	status: number | null;
	message: string; // the server's { error } text when present, else a plain sentence
	fallback: QualityLevel | null; // a converted level worth offering ("Try 1080p (converted)")
}

export interface HqpAudioOption {
	ordinal: number;
	label: string;
	language: string | null; // ISO 639-2
	title: string | null;
	channels: number | null;
	codec: string | null; // null until the contract carries it
	isOriginal: boolean; // language matches item.originalLanguage
	selected: boolean;
}

export interface HqpSubtitleOption {
	ordinal: number;
	label: string;
	language: string | null;
	title: string | null;
	forced: boolean;
	sdh: boolean; // title matches /sdh|\bcc\b|sourds|malentendants|hearing/i
	isText: boolean; // false = image subtitles (PGS): listed, never selectable
	url: string | null; // WebVTT URL from the session; null for image subtitles
}

export interface HqpSubtitleState {
	options: HqpSubtitleOption[];
	selected: number | null; // the user's (or policy's) full track; null = Off
	forced: number | null; // forced track rendered while selected is null
	offsetSeconds: number; // -10..10 in 0.1 steps
}

export interface HqpCueSpan {
	text: string;
	italic: boolean;
	bold: boolean;
}

export interface HqpCue {
	id: string;
	lines: HqpCueSpan[][];
}

export interface HqpUpNext {
	index: number;
	item: HqpItem;
	reason: 'credits' | 'end';
	countdownEndsAt: number | null; // epoch ms; null = no countdown running
}

export interface HqpToast {
	id: number;
	kind: 'info' | 'warning' | 'error';
	text: string;
	action: { label: string; run: () => void } | null;
	until: number; // epoch ms
}

export interface HqpState {
	status: HqpStatus;
	autoplayBlocked: boolean;
	queue: HqpItem[];
	index: number;
	item: HqpItem | null;
	session: PlaybackSession | null;
	delivery: Delivery | null;
	caps: ClientCaps | null;
	quality: { choice: QualityChoice; active: QualityLevel | null; available: QualityLevel[] };
	audio: { options: HqpAudioOption[]; mode: 'copy' | 'transcode' | null };
	subtitles: HqpSubtitleState;
	chapters: Chapter[];
	chapterIndex: number; // -1 without chapters
	skipIntro: { end: number } | null;
	trickplay: TrickplayManifest | null; // null until ensureTrickplay() resolved
	rate: number;
	held: boolean; // long-press 2x active
	volume: number;
	muted: boolean;
	frameMode: FrameMode; // for the current aspect class
	aspect: number | null; // videoWidth / videoHeight once known
	hdrShown: boolean; // HDR stream on an HDR display
	resume: { from: number; until: number } | null; // "Resumed at" notice, until = epoch ms
	upNext: HqpUpNext | null;
	stillWatching: boolean;
	sleep: { mode: SleepMode; endsAt: number | null };
	pip: boolean;
	airplay: { available: boolean; active: boolean };
	fullscreen: boolean;
	online: boolean;
	toasts: HqpToast[];
	error: HqpError | null;
	announcement: { id: number; text: string } | null; // polite live region
}

export interface HqpClock {
	position: number;
	duration: number;
	bufferedEnd: number; // end of the buffered range containing position (position when none)
	ranges: Array<[number, number]>;
}

export interface HqpMetrics {
	sessionId: string | null;
	delivery: Delivery | null;
	videoMode: 'copy' | 'transcode' | null;
	reason: string | null;
	codec: string | null;
	profile: string | null;
	width: number | null;
	height: number | null;
	frameRate: number | null;
	bitDepth: 8 | 10 | null;
	hdr: HdrKind;
	hdrShown: boolean;
	audio: {
		label: string | null;
		codec: string | null;
		channels: number | null;
		mode: 'copy' | 'transcode' | null;
	};
	subtitles: string | null; // "SRT → WebVTT · French forced", or null when off
	segmentSeconds: number | null;
	bitrate: { measured: number | null; file: number | null }; // bits per second
	throughput: number | null; // bits per second; null when not measurable (native HLS)
	bufferAhead: number; // seconds
	frames: { dropped: number; total: number } | null;
	screen: { width: number; height: number; dpr: number; refreshHz: number | null; hdr: boolean };
	quality: { choice: QualityChoice; active: QualityLevel | null };
}

export interface HqpSubtitleStyle {
	size: 's' | 'm' | 'l' | 'xl';
	background: 'shadow' | 'outline' | 'box';
	color: 'white' | 'yellow';
	position: 'auto' | 'low';
}

export interface HqpPrefs {
	version: 1;
	quality: QualityChoice; // default 'auto'
	volume: number; // 0..1, default 1
	muted: boolean;
	audioLanguage: string | null; // ISO 639-2; null = server default (French first)
	subtitleMode: 'auto' | 'on' | 'off'; // default 'auto'
	subtitleLanguage: string; // ISO 639-2, default 'fre'
	subtitleStyle: HqpSubtitleStyle; // default m, shadow, white, auto
	autoplayNext: boolean; // default true
	autoHideMs: 2000 | 3000 | 5000; // default 3000
	frameModes: Record<AspectClass, FrameMode>; // default all 'fit'
	liteGlass: boolean; // default false
	resume: boolean; // default true
	hints: { fineScrub: boolean; homeScreen: boolean }; // true once shown
}

export type HqpPrefsPatch = Partial<
	Omit<HqpPrefs, 'version' | 'subtitleStyle' | 'frameModes' | 'hints'>
> & {
	subtitleStyle?: Partial<HqpSubtitleStyle>;
	frameModes?: Partial<Record<AspectClass, FrameMode>>;
	hints?: Partial<HqpPrefs['hints']>;
};

/** Injectable browser probes for capability detection (tests pass fakes). */
export interface CapsProbe {
	vendor: string;
	canPlayType(type: string): string;
	mseIsTypeSupported: ((type: string) => boolean) | null; // MediaSource or ManagedMediaSource
	hlsJsSupported: boolean;
	matchMedia(query: string): boolean;
	decodingInfo:
		| ((
				config: MediaDecodingConfiguration
		  ) => Promise<{ supported: boolean; powerEfficient: boolean }>)
		| null;
}

export interface HqpEngineOptions {
	fetch?: typeof fetch;
	now?: () => number;
	storage?: Storage | null; // localStorage for prefs (guarded; null = memory only)
	sessionStorage?: Storage | null; // caps cache and overrides
	loadHls?: () => Promise<typeof HlsDefault>; // default: () => import('hls.js/light').then((m) => m.default)
	probe?: (video: HTMLVideoElement) => CapsProbe; // default: browser probe
	onItemChange?: (item: HqpItem, index: number) => void;
}

export type HqpShortcutAction =
	| 'toggle'
	| 'back10'
	| 'forward10'
	| 'back5'
	| 'forward5'
	| 'prevChapter'
	| 'nextChapter'
	| 'volumeUp'
	| 'volumeDown'
	| 'mute'
	| 'fullscreen'
	| 'subtitles'
	| 'audioNext'
	| 'tracks'
	| 'info'
	| 'episodes'
	| 'nextItem'
	| 'pip'
	| 'percent'
	| 'home'
	| 'end'
	| 'frameBack'
	| 'frameForward'
	| 'slower'
	| 'faster'
	| 'help'
	| 'escape';

export interface HqpShortcut {
	keys: string[];
	shift?: boolean;
	action: HqpShortcutAction;
	label: string;
	display: string;
}

export interface HqpEngine {
	readonly snapshot: Readable<HqpState>;
	readonly clock: Readable<HqpClock>;
	readonly cues: Readable<HqpCue[]>;
	readonly prefs: Readable<HqpPrefs>;
	attach(video: HTMLVideoElement): void;
	load(payload: HqpLaunchPayload, options?: HqpLoadOptions): Promise<void>;
	play(): Promise<void>;
	pause(): void;
	toggle(): void;
	seek(seconds: number): void;
	skip(deltaSeconds: number): void;
	seekChapter(direction: 1 | -1): void;
	stepFrame(direction: 1 | -1): void;
	startOver(): void;
	setRate(rate: number): void;
	holdRate(on: boolean): void;
	setVolume(level: number): void;
	setMuted(muted: boolean): void;
	setQuality(choice: QualityChoice): Promise<void>;
	setAudio(ordinal: number): Promise<void>;
	cycleAudio(): Promise<void>;
	setSubtitles(ordinal: number | null): void;
	toggleSubtitles(): void;
	setSubtitleOffset(seconds: number): void;
	setFrameMode(mode: FrameMode): void;
	playIndex(index: number): Promise<void>;
	next(): Promise<void>;
	cancelUpNext(): void;
	confirmStillWatching(): void;
	setSleep(mode: SleepMode): void;
	togglePip(): Promise<void>;
	showAirPlayPicker(): void;
	toggleFullscreen(target: HTMLElement): Promise<void>;
	setClockRate(hz: 1 | 4): void;
	noteInteraction(): void; // any user input: resets the autoplay counter, pauses the countdown 2 s
	retry(): Promise<void>;
	dismissToast(id: number): void;
	ensureTrickplay(): Promise<TrickplayManifest | null>;
	updatePrefs(patch: HqpPrefsPatch): void;
	metrics(): HqpMetrics;
	diagnostics(): string; // JSON: metrics, state summary, caps, last 20 events; never a file path
	destroy(): Promise<void>; // saves progress, deletes the session, releases everything
}
```

Module exports besides the types (all in `src/lib/player/hqp/`):

```ts
// index.ts
export * from './types';
export { createHqpEngine } from './engine';
export { HQP_SHORTCUTS, matchHqpShortcut, shouldHandleHqpShortcut } from './shortcuts';
export { DEFAULT_HQP_PREFS, normalizeHqpPrefs } from './prefs';

// engine.ts
export function createHqpEngine(options?: HqpEngineOptions): HqpEngine;
// caps.ts
export function browserCapsProbe(video: HTMLVideoElement): CapsProbe;
export function detectCaps(
	probe: CapsProbe,
	override?: Partial<ClientCaps>
): Promise<{ caps: ClientCaps; delivery: Delivery | null }>;
// abr.ts (pure)
export interface AbrInput {
	now: number;
	choice: QualityChoice;
	active: QualityLevel;
	available: QualityLevel[];
	lastSwitchAt: number;
	stalls: Array<{ start: number; end: number | null; seek: boolean }>;
	bufferAhead: number;
	throughput: number | null;
	bitrate: number | null;
	remaining: number;
	paused: boolean;
	seeking: boolean;
}
export type AbrDecision =
	| { action: 'none' }
	| { action: 'down' | 'up'; to: QualityLevel }
	| { action: 'suggest'; to: QualityLevel };
export function decideQuality(input: AbrInput): AbrDecision;
// progress.ts (pure scheduling + sender)
export const PROGRESS_INTERVAL_MS = 10_000;
export function shouldSaveProgress(input: {
	now: number;
	lastSavedAt: number;
	lastSavedPosition: number;
	position: number;
	reason: 'tick' | 'pause' | 'seek' | 'ended' | 'hide' | 'close' | 'item';
}): boolean;
export function resumePoint(
	progress: ProgressEntry | null,
	durationSeconds: number | null,
	prefsResume: boolean
): number | null;
// upnext.ts (pure)
export function creditsStart(
	chapters: Chapter[],
	duration: number,
	sessionCredits: number | null
): number;
export function openingChapter(chapters: Chapter[], duration: number): Chapter | null;
// subtitles.ts (pure + cue parsing)
export function chooseSubtitles(
	options: HqpSubtitleOption[],
	audioLanguage: string | null,
	prefs: Pick<HqpPrefs, 'subtitleMode' | 'subtitleLanguage'>
): { selected: number | null; forced: number | null };
export function cueToSpans(text: string): HqpCueSpan[][]; // <i>, <b> kept; every other tag dropped; never innerHTML
// shortcuts.ts
export const HQP_SHORTCUTS: HqpShortcut[];
export function matchHqpShortcut(
	event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>
): { action: HqpShortcutAction; percent?: number } | null;
export function shouldHandleHqpShortcut(
	event: Pick<KeyboardEvent, 'key' | 'target' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>
): boolean;
// prefs.ts
export const HQP_PREFS_KEY = 'hqp:prefs';
export const DEFAULT_HQP_PREFS: HqpPrefs;
export function normalizeHqpPrefs(input: unknown): HqpPrefs;
export function loadHqpPrefs(storage: Storage | null | undefined): HqpPrefs;
export function saveHqpPrefs(storage: Storage | null | undefined, prefs: HqpPrefs): void;
// store.ts
export function writable<T>(
	initial: T
): Readable<T> & { set(value: T): void; update(fn: (value: T) => T): void; get(): T };
// hls-light.d.ts (ambient, no runtime code)
declare module 'hls.js/light' {
	export { default } from 'hls.js';
	export * from 'hls.js';
}
// testing/fake-media.ts (tests only)
export function createFakeMedia(): HTMLVideoElement & {
	emit(type: string): void;
	setBuffered(ranges: Array<[number, number]>): void;
};
```

### 13.3 Engine behaviour

**Load sequence** (`load(payload, { startAt = 'resume', autoplay = true })`):

1. Status `starting`. Read prefs. `detectCaps` (cached).
2. Start position: a number from `startAt`, else `resumePoint(item.progress, duration, prefs.resume)`
   (resume when not completed, position at least 30 s, and at least 180 s remaining).
3. `POST /api/media/sessions` with `{ fileId, audio: ordinal of prefs.audioLanguage or null, caps,
quality: choice === 'auto' ? 'original' : choice }`. Map failures to `HqpError` (section 8).
4. Build audio and subtitle options by merging `session.audioTracks` / `session.subtitleTracks`
   with `item.file.audio` / `item.file.subtitles` by ordinal. Apply `chooseSubtitles`.
5. Attach the source: native (`video.src = playlistUrl`, set `currentTime` at `loadedmetadata`) or
   hls.js light (`startPosition`, buffer config of section 12). Add the `<track>` elements.
   Status `loading`.
6. Fetch chapters (`chaptersUrl`) in parallel; compute `skipIntro` and the up next trigger.
7. On `canplay`: `play()` when autoplay; a rejected play sets `autoplayBlocked` and status `paused`.
   Set the resume notice when resumed. Media Session metadata. Wake lock on `playing`.

**Switching** (`setQuality`, `setAudio`, decode recovery, Reload): status `switching`, keep the
position and paused state, `POST` a new session, attach it at the position, then `DELETE` the old
session (`keepalive`). On failure: restore the previous choice, toast the error.

**Item change** (`next`, `playIndex`, countdown end): save progress for the leaving item (completed
when at least 92% or within the last 3 minutes), `DELETE` its session, reset chapters, trickplay,
cues and up next, keep audio language, subtitle policy and quality choice, `load` the new item at
its resume point, call `onItemChange(item, index)`. Autoplay counter +1 for countdown-triggered
changes; any `noteInteraction()` resets it; at 3 the up next card shows "Still watching?".

**Progress**: `PUT /api/media/progress` every 10 s while playing, and on pause, seek end (debounced
1 s), `ended`, `visibilitychange` to hidden, `pagehide` (`fetch` with `keepalive: true`), item
change and `destroy`. Skip a save when the position moved less than 2 s since the last save
(except pause/ended/close). Never more than one PUT per 5 s per file. A failed PUT is retried once
when back online.

**Clock**: emits on `timeupdate` throttled to the clock rate (4 Hz or 1 Hz), and immediately on
`seeking`, `seeked`, `durationchange`, `progress`. Chapter index updated by binary search on each
emit.

**Subtitles**: cues come from the hidden native tracks' `cuechange` (immediate, no polling) and are
emitted on `cues` after `cueToSpans`. The offset shifts `VTTCue.startTime` / `endTime` in place by
the delta. Image tracks are never fetched (the API answers 415).

**Up next and sleep**: computed on clock emits (1 Hz is enough). Sleep "end of item" pauses at
`ended` instead of advancing; timed modes pause when `endsAt` passes (desktop fades volume over the
last 10 s; iOS just pauses) and toast "Sleep timer paused playback".

**Online/offline**: `online`/`offline` events plus fetch failures; hls.js fatal network errors retry
with 2/4/8/16/30 s backoff; native `stalled`/`error` on network triggers a source reload at the
position with the same backoff.

**Destroy**: save progress (`keepalive`), `DELETE` the session (`keepalive`), detach hls.js, remove
tracks, clear `src` and call `video.load()`, release the wake lock, clear Media Session handlers,
remove every listener and timer.

**Metrics**: `getVideoPlaybackQuality()`, buffered ranges, session fields, hls.js `FRAG_LOADED`
stats (measured bitrate = bytes x 8 / fragment duration; throughput = bytes x 8 / load time), and a
refresh-rate estimate from 30 rAF samples taken only when `metrics()` is first called after the
info panel opens.

**Never**: no file path anywhere on the client, no polling, no `innerHTML`, no secrets in logs or
diagnostics.

### 13.4 UI: component tree (`src/lib/components/hqp/`)

```
hqp-tokens.css                       tokens and materials (section 9.2, verbatim)
index.ts                             export { default as HqpPlayer } from './HqpPlayer.svelte'
HqpPlayer.svelte                     root; props below; creates the engine; context; key handling
context.ts                           setHqpContext/getHqpContext: { engine, ui }
ui-state.svelte.ts                   class HqpUi ($state runes): chrome, overlay, sheet tab/page,
                                     locked, scrub, ripple, preview, layout, reduced motion/transparency
parts/Icons.svelte                   the SVG sprite (rendered once, hidden)
parts/Icon.svelte                    { name: HqpIconName; size?: number }
parts/Frame.svelte                   the <video playsinline webkit-playsinline x-webkit-airplay="allow"
                                     autopictureinpicture preload="auto" poster>, Fit/Fill, FLIP,
                                     portrait trickplay overlay, PiP/AirPlay message, opening veil
parts/Ambient.svelte                 portrait glow from the still (w300), band-masked
parts/Subtitles.svelte               renders engine.cues inside the frame (the frame is a size
                                     container, so cqh = picture height), styles, lift; aria-hidden
parts/Scrims.svelte                  top, bottom, centre; landscape and large only
parts/GestureLayer.svelte            pointer handlers -> logic/gestures.ts -> engine/ui actions
parts/TopBar.svelte                  Close, title block (landscape/large), SignalChip, output group
parts/SignalChip.svelte
parts/TitleBlock.svelte              portrait eyebrow/title/badges; large logo art
parts/Transport.svelte               back 10, play/pause (buffering arc), forward 10
parts/Timeline.svelte                slider, chapters mask, buffered/played layers, thumb, origin tick
parts/ScrubPreview.svelte            tile + time pill (landscape/large) or portrait readout
parts/TimeRow.svelte                 elapsed · chapter · ends at · remaining
parts/ActionRow.svelte               Audio & Subtitles (value-first), Speed, Episodes/Info, Next
parts/DesktopBar.svelte              large bottom bar incl. volume
parts/SeekRipple.svelte              lens, chevrons, label, peek line
parts/HoldPill.svelte                "2× ▸▸"
parts/ResumeCapsule.svelte
parts/SkipIntro.svelte
parts/Toasts.svelte
parts/Sheet.svelte                   dialog shell, tabs, drag-to-dismiss
parts/TracksTab.svelte               audio + subtitles radiogroups, honest note, Style link
parts/StylePage.svelte               size, look, colour, position, sync offset, sample
parts/PictureTab.svelte              quality, Fit/Fill, HDR row, Home Screen row
parts/PlaybackTab.svelte             speed, sleep, autoplay next, lite glass
parts/InfoPanel.svelte               1 Hz metrics, copy diagnostics, reload
parts/UpNext.svelte                  credits shrink orchestration + card + countdown ring
parts/StillWatching.svelte
parts/EndCard.svelte
parts/EpisodesDrawer.svelte
parts/LockOverlay.svelte
parts/ErrorCard.svelte
parts/ShortcutHelp.svelte
parts/LiveRegion.svelte
logic/layout.ts      (+ layout.test.ts)
logic/gestures.ts    (+ gestures.test.ts)
logic/scrub.ts       (+ scrub.test.ts)
logic/trickplay.ts   (+ trickplay.test.ts)
logic/chrome.ts      (+ chrome.test.ts)
logic/format.ts      (+ format.test.ts)
demo/fake-engine.ts  a scripted HqpEngine for the dev harness (no network, no media)
demo/fixtures.ts     Stranger Things S5 sample queue, chapters, trickplay, metrics
```

`HqpPlayer.svelte` props:

```ts
interface HqpPlayerProps {
	launch: HqpLaunchPayload;
	startAt?: number | 'resume'; // default 'resume'
	onclose: () => void; // the route navigates back
	onitemchange?: (item: HqpItem, index: number) => void; // the route updates the URL
	engine?: HqpEngine; // injection for the demo harness; default createHqpEngine({ onItemChange })
}
```

Rules for the root: `position: fixed; inset: 0; background: var(--hqp-black); isolation: isolate;
container-type: size; container-name: hqp; overflow: hidden; overscroll-behavior: none;`
`data-hdr`, `data-chrome="on|off"`, `data-layout`, `data-lite-glass` attributes. While mounted it
sets `overflow: hidden` on `<html>` and restores it on destroy. The engine is created in
`onMount`/`$effect` only (SSR renders the opening state: black, still, title). All artwork URLs
come from `tmdbImageUrl(path, size)` in `$lib/tmdb/images`. Times use `formatTime`/`spokenTime`
from `$lib/player/format-time`.

UI logic modules (pure TypeScript, tested in the node environment):

```ts
// logic/layout.ts
export type HqpLayout = 'phone-portrait' | 'phone-portrait-short' | 'phone-landscape' | 'large';
export interface Size {
	width: number;
	height: number;
}
export interface Insets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}
export function layoutFor(width: number, height: number): HqpLayout;
export function chromeEdges(
	layout: HqpLayout,
	safe: Insets
): { top: number; x: number; bottom: number }; // mirrors the CSS tokens
export function frameRect(layout: HqpLayout, viewport: Size, aspect: number, mode: FrameMode): Rect;
export function fillCrop(viewport: Size, aspect: number): { scale: number; cropPercent: number };
export function aspectClass(aspect: number): AspectClass;
export function islandRects(viewport: Size): Rect[]; // section 2; [] for large layouts
export function intersects(a: Rect, b: Rect): boolean;

// logic/gestures.ts
export interface PointerSample {
	id: number;
	x: number;
	y: number;
	t: number;
	type: 'touch' | 'mouse' | 'pen';
}
export interface GestureConfig {
	viewport: Size;
	frame: Rect;
	layout: HqpLayout;
	duration: number;
	position: number;
	locked: boolean;
	edgeExclusion: number;
	chromeVisible: boolean;
}
export type GestureAction =
	| { type: 'toggleChrome' }
	| { type: 'revertChrome' }
	| { type: 'seekTap'; side: 'back' | 'forward'; total: number }
	| { type: 'seekCommit'; total: number }
	| { type: 'frameToggle' }
	| { type: 'hold'; on: boolean }
	| { type: 'scrubStart'; origin: number }
	| { type: 'scrubMove'; target: number; rate: 1 | 0.5 | 0.25 }
	| { type: 'scrubEnd'; target: number; cancelled: boolean }
	| { type: 'drag'; dy: number }
	| { type: 'dismiss' }
	| { type: 'dragCancel' }
	| { type: 'swipeUp' }
	| { type: 'pinch'; scale: number }
	| { type: 'pinchEnd'; mode: FrameMode | null }
	| { type: 'lockedTap' };
export interface TimerApi {
	set(fn: () => void, ms: number): number;
	clear(id: number): void;
}
export function createGestureRecognizer(
	config: () => GestureConfig,
	emit: (action: GestureAction) => void,
	timers?: TimerApi
): {
	down(p: PointerSample): void;
	move(p: PointerSample): void;
	up(p: PointerSample): void;
	cancel(p: PointerSample): void;
	dispose(): void;
};

// logic/scrub.ts
export function relativeScrubTarget(
	origin: number,
	dx: number,
	frameWidth: number,
	duration: number,
	rate: 1 | 0.5 | 0.25
): number;
export function panFineRate(dy: number): 1 | 0.5 | 0.25; // abs(dy) >= 48 -> 0.5, >= 120 -> 0.25
export function trackFineRate(heightAboveTrack: number): 1 | 0.5 | 0.25; // >= 40 -> 0.5, >= 100 -> 0.25
export function absoluteScrubTarget(
	x: number,
	track: { left: number; width: number },
	duration: number
): number;
export function magnet(
	target: number,
	chapters: Chapter[],
	pxPerSecond: number,
	thresholdPx?: number
): number; // 6
export function isCancel(
	target: number,
	origin: number,
	pxPerSecond: number,
	thresholdPx?: number
): boolean; // 8

// logic/trickplay.ts
export interface TrickplayTile {
	url: string;
	x: number;
	y: number;
	tileWidth: number;
	tileHeight: number;
	sheetWidth: number;
	sheetHeight: number;
}
export function tileAt(manifest: TrickplayManifest, seconds: number): TrickplayTile | null; // null unless status 'ready'
export function sheetsAround(manifest: TrickplayManifest, seconds: number): string[]; // current +- 1

// logic/chrome.ts
export interface ChromeInput {
	playing: boolean;
	buffering: boolean;
	focusWithin: boolean;
	overlayOpen: boolean;
	scrubbing: boolean;
	pointerOverControls: boolean;
	idleMs: number;
	delayMs: number;
}
export function shouldHideChrome(input: ChromeInput): boolean;

// logic/format.ts
export function languageName(code: string | null): string; // fre/fra -> French, eng -> English, ...; null -> 'Unknown'
export function channelLabel(channels: number | null): string | null; // 1 Mono, 2 Stereo, 6 5.1, 8 7.1
export function codecLabel(codec: string | null, short?: boolean): string | null; // eac3 -> Dolby Digital Plus / DD+
export function resolutionBadge(resolution: PlayableFile['resolution']): string | null; // 2160p -> 4K
export function hdrBadge(kind: HdrKind): string | null; // hdr10 -> HDR10, hlg -> HLG, dolby-vision -> Dolby Vision
export function endsAt(now: Date, remainingSeconds: number, rate: number): string; // 24-hour "22:11"
export function deltaLabel(seconds: number): string; // "+14:52" / "−3:10" (U+2212)
export function audioValue(option: HqpAudioOption | undefined): string; // "FR 5.1"
export function subtitleValue(state: HqpSubtitleState): string; // "CC FR", "CC FR forced", "Off"
export function sliderText(position: number, duration: number, chapter: Chapter | null): string;
```

### 13.5 Dev harness (ui-owned): `src/routes/demo/hqp/`

`+page.ts` throws `error(404)` unless `dev` (from `$app/environment`). `+page.svelte` renders
`HqpPlayer` with `demo/fake-engine.ts` and fixtures. Query parameters:
`?state=controls|hidden|sheet|style|picture|playback|info|scrub|seek|hold|upnext|still|end|episodes|resume|skip|opening|blocked|buffering|switching|offline|locked|help|error-503|error-409|error-decode`,
`&kind=episode|movie`, `&aspect=1.78|2.39|1.33`, `&mode=fit|fill`, `&signal=direct|converted`,
`&sim=iphone18|iphone13|none` (sets `data-hqp-sim` and draws the simulated island, status bar,
home indicator and corners in a debug overlay layer that ignores pointer events). It is the
reference for screenshots and for the layout e2e tests; it never reaches production.

### 13.6 Integration surface

**Route `src/routes/(cinema)/watch/[fileId]/+page.server.ts`**

```ts
export const load = (async ({ params, locals, url, setHeaders }) => {
	// 1. not signed in -> redirect 302 to /auth/login?returnTo=/watch/<fileId>
	// 2. signed in but not isOwnerUser(locals.user) -> error(404)   (fail closed, no existence leak)
	// 3. fileId not a UUID -> error(404)
	// 4. const launch = await buildLaunchPayload(locals.user.id, params.fileId); null -> error(404)
	// 5. setHeaders({ 'cache-control': 'private, no-store' })
	return { launch, startAt: parseStartAt(url.searchParams.get('t')) };
}) satisfies PageServerLoad;
```

The load is read-only (no session start, no ffmpeg): safe for hover preload.

**`src/routes/(cinema)/watch/[fileId]/+page.svelte`**: renders
`<HqpPlayer launch={data.launch} startAt={data.startAt} onclose={close} onitemchange={changed} />`.
`close()` calls `history.back()` when the page was reached by an in-site navigation (tracked with
`afterNavigate(({ from }) => ...)`), else `goto(data.launch.returnHref, { replaceState: true })`.
`changed(item)` calls `replaceState('/watch/' + item.fileId, {})` from `$app/navigation`. Head:
`<title>{item.title} · Alan's HQP</title>`; on mount it sets the existing `theme-color` meta to
`black` and restores it on destroy.

**`src/lib/server/hqp/launch.ts`**

```ts
export async function buildLaunchPayload(
	userId: string,
	fileId: string
): Promise<HqpLaunchPayload | null>;
export function parseStartAt(value: string | null): number | 'resume'; // integer seconds 0..86400, else 'resume'
export interface ContinueCardItem {
	fileId: string;
	href: string;
	title: string;
	eyebrow: string;
	stillPath: string | null;
	progress: number;
	remainingLabel: string;
	ariaLabel: string;
}
export function toContinueCardItem(row: ContinueWatchingRow): ContinueCardItem; // row type from repository.listContinueWatching
```

- Film file: queue `[film]`; `title` movie title, `year`, `overview`, `runtimeMinutes`,
  `originalLanguage`, artwork (`stillPath` = backdrop), `titleHref` `/movies/<id>`, `file` from
  `getPlayableForMovie(movieId)` matching `fileId`.
- Episode file: the show (via `tv_episodes.show_id`, read-only Drizzle query in this module), every
  local episode of the show ordered by (season, episode) with one file each (the requested file for
  its own slot, else the best of `getPlayableForEpisodes`), `index` of the requested file;
  `titleHref` `/tv/<tmdbId>?season=<n>`.
- Unmatched file: kind `movie`, title from the parsed name, null artwork, `titleHref`
  `/my/films?tab=local`.
- Progress for every queue item: `getProgress(userId, fileIds)`.
- `returnHref` = `titleHref` of the requested item.
- No file path in the payload. Adult/custom movies follow the same visibility policy as their
  title pages for the owner.

**`src/routes/(cinema)/+layout.svelte`**: when `page.route.id === '/(cinema)/watch/[fileId]'`,
render only `<main id="main-content" class="immersive" tabindex="-1">{@render children?.()}</main>`
(no skip link, top bar, footer, tab bar, toast container, search palette; no bottom padding).
Everything else is unchanged.

**Film page `/movies/[id]`** (owner only, server-side `isOwnerUser`): load adds
`local: { files: PlayableFile[]; progress: ProgressEntry | null } | null` (null and no query for
non-owners). UI: primary "Play" (or "Resume · 41 min left" with a thin emerald progress bar and a
secondary "Start over" linking `?t=0`), a quality line ("4K · HDR10 · Dolby Digital Plus 5.1 ·
French, English" from the best file), and a "Versions" menu when more than one file. Links go to
`/watch/<fileId>`. Optional: an `onNavigate` view transition (shared name `hqp-frame` on the hero
image and the player frame), reduced motion = no transition.

**Series page `/tv/[id]`**: load falls back to `getTvShowByTmdbId` when the IMDb snapshot does not
have the show; for the owner adds `local: { seasons: Array<{ seasonNumber: number; episodes:
LocalEpisodeRow[] }>; resume: { fileId: string; label: string } | null } | null` where
`LocalEpisodeRow = { fileId: string; episodeNumber: number; title: string; stillPath: string | null;
runtimeMinutes: number | null; progress: number; completed: boolean }`. UI: an "On this PC" section
(season segmented control, episode rows linking `/watch/<fileId>`) and a primary "Play S5 E1" /
"Resume S5 E2 · 12 min left" button (most recently updated unfinished episode, else the first not
completed).

**Library `/my/films`**: owner-only tab `local` ("On this PC") added to `LIBRARY_TABS` (hidden for
non-owners): summary line from `getLibrarySummary()`, films and shows grids (`PosterItem`s from
`listLocalMovies` / `listLocalShows`, 48 per page with "Load more"), unmatched files list linking
`/watch/<fileId>`; and a "Continue watching" rail at the top of the page for the owner.

**Home**: owner-only "Continue watching" rail (first rail after the hero) from
`listContinueWatching(userId, 12)`, never queried for other users; hidden when empty.

**`src/lib/components/ui/continue-card/`**: a kit card (16:9 still `w780`, progress bar using
`scale`, eyebrow, title, "41 min left"), whole card is one link to `/watch/<fileId>`, accessible
name "Resume Stranger Things, season 5 episode 1, Chapitre un, 41 minutes left".

**Home Screen web app**:

- `static/manifest.json`: `id "/"`, `name "Alan's Data Base"`, `short_name "Alan DB"`,
  `start_url "/"`, `scope "/"`, `display "standalone"`, `orientation "any"`, `background_color` and
  `theme_color` the site canvas, icons `icons/icon-192.png` (192), `icons/icon-512.png` (512),
  `icons/icon-maskable-512.png` (512, `purpose "maskable"`).
- `src/app.html` additions: `<meta name="mobile-web-app-capable" content="yes" />`,
  `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
  `<meta name="apple-mobile-web-app-title" content="Alan DB" />`,
  `<link rel="apple-touch-icon" sizes="180x180" href="%sveltekit.assets%/icons/apple-touch-icon.png" />`
  (replacing the 64 px favicon reference). `viewport-fit=cover` is already present.
- Icons rendered from `static/favicon.svg` with a one-off Playwright script (scratchpad), on a
  black background with a 12% safe margin for the maskable one.
- Check every page at 440 x 956 with the 62 px top inset: the top bar already pads with
  `--safe-top`; nothing may sit under the status bar.

**Deferred: in-site mini-player.** If wanted later: move `HqpPlayer` into a layout-level host with a
`mode: 'full' | 'mini'`, keep the same `<video>` node, dock 16:9 above the tab bar. The engine
contract does not change.

---

## 14. Ownership (no overlapping files)

| Builder            | Owns (creates or edits)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine             | `src/lib/player/hqp/**` (all modules, `testing/fake-media.ts`, every `*.test.ts` there)                                                                                                                                                                                                                                                                                                                                                                                                |
| ui                 | `src/lib/components/hqp/**` (incl. `hqp-tokens.css`, parts, logic and tests, demo fake engine and fixtures); `src/routes/demo/hqp/**` (dev-only harness)                                                                                                                                                                                                                                                                                                                               |
| integration        | `src/routes/(cinema)/watch/**`; `src/lib/server/hqp/**`; `src/routes/(cinema)/+layout.svelte`; `src/routes/(cinema)/+page.server.ts` and `+page.svelte`; `src/routes/(cinema)/movies/[id]/+page.server.ts`, `+page.svelte` and their tests; `src/routes/(cinema)/tv/[id]/**`; `src/routes/(cinema)/my/films/**`; `src/lib/catalogue/library.ts` and its test; `src/lib/components/ui/continue-card/**`; `static/manifest.json`; `static/icons/**`; `src/app.html`; `tests/hqp*.e2e.ts` |
| lead (coordinator) | this spec; `src/lib/media/types.ts` (shared contract); `CHANGELOG.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT.md`; commits                                                                                                                                                                                                                                                                                                                                                          |
| not ours           | `src/lib/server/media/**` and `src/routes/api/media/**` (stream-server; `repository.ts` is library-data's); schema, migrations, `worker/**` (library-data)                                                                                                                                                                                                                                                                                                                             |

Dependencies: ui and integration import engine types from `$lib/player/hqp/types` and must not
wait: the engine builder creates `types.ts` verbatim from section 13.2 as its first step. ui
builds against `demo/fake-engine.ts`. integration mocks `$lib/server/media/repository` in unit
tests until library-data delivers it. Each builder puts its CHANGELOG lines in its handoff.

---

## 15. Contracts the builders follow verbatim

The `engine_contract`, `ui_contract` and `integration_contract` texts returned with this spec are
the condensed, binding versions of sections 3 to 14. Where they and this file differ, this file
wins.

---

## 16. Test plan

### 16.1 Engine (vitest, node environment, fake media element and fake fetch)

- `caps.test.ts`: Apple native (eac3/ac3/multichannel true, delivery native); Chrome MSE (hls.js,
  ac3/eac3 false, multichannel false); no MSE and no HLS (unsupported); AV1 supported but not
  power efficient (av1 false); `hdrDisplay` needs the media query and a 10-bit codec; overrides
  merge; cache read/write guarded.
- `api.test.ts`: request bodies; 201 parsing; 400/401/403/404/409/503 to `HqpError` codes with
  the server message; network failure; `DELETE` and `PUT` use `keepalive`.
- `transport.test.ts`: native sets `src` and seeks at `loadedmetadata`; hls.js light is imported
  only on the hls.js path, gets the buffer config and `startPosition`; fatal network backoff
  2/4/8/16/30; fatal media: one `recoverMediaError()`, then decode.
- `abr.test.ts`: every rule of section 4.3 including cooldowns, explicit choice never switches,
  suggestion toast condition.
- `progress.test.ts`: 10 s cadence, pause/seek/hide/close saves, 2 s delta rule, 5 s cap,
  `resumePoint` edge cases (completed, under 30 s, last 180 s, prefs off).
- `upnext.test.ts`: credits regex and 85% rule, time fallback `max(45 s, 2%)`, session
  `creditsStart` wins, opening chapter detection.
- `subtitles.test.ts`: `chooseSubtitles` table (audio French: forced auto; audio English: full
  French; off: forced kept; on: full; image never chosen); `cueToSpans` keeps `<i>`/`<b>` only.
- `engine.test.ts`: load posts caps and preferred audio, attaches, resumes and sets the notice;
  autoplay rejection; `setAudio` restarts at the position and deletes the old session; `next()`
  saves completed progress, deletes the session, calls `onItemChange`; 3 autoplays give still
  watching; decode failure recovers once with the override; `destroy()` saves and deletes; no
  timers left (fake timers).
- `media-session.test.ts`, `wake-lock.test.ts` (5 min release), `sleep.test.ts`,
  `prefs.test.ts` (normalize garbage to defaults), `shortcuts.test.ts` (every key, modifiers
  ignored, typing targets ignored), `store.test.ts`.

### 16.2 UI (vitest for logic; browser checks on the demo harness)

- `layout.test.ts`: breakpoints; edges for 440 x 956 (53/16/38), 956 x 440 (12 top, 48, 25),
  1440 x 900; frame rects for 16:9, 2.39, 4:3 in Fit and Fill; crop 18% for 16:9 on 956 x 440;
  aspect classes; island rects; no portrait top bar rect intersects the island.
- `gestures.test.ts`: tap vs double tap timing; accumulation and commit 250 ms after the last tap;
  revertChrome on double tap; centre double tap; long press then pan; relative scrub; swipe down
  dismiss by distance and by velocity; swipe up; pinch thresholds; edge exclusion; locked tap.
- `scrub.test.ts`, `trickplay.test.ts` (tile maths across sheets, pending returns null),
  `chrome.test.ts`, `format.test.ts`.
- Browser (ui builder, own dev port, Chrome through Playwright, reduced motion for stills): every
  harness state at 440 x 956 and 956 x 440 (DPR 3, touch, iPhone UA, `sim=iphone18`), 428 x 926
  with `sim=iphone13`, 1440 x 900, 320 x 693 and 693 x 320; no horizontal overflow; all targets at
  least 44 px; island invariant; screenshots saved in the scratchpad.

### 16.3 Integration (vitest + Playwright e2e)

- Unit: `launch.test.ts` (film, episode queue order and index, unmatched, progress merge, no path
  in the payload, non-UUID), `watch` `page.server.test.ts` (anonymous redirect, non-owner 404,
  owner payload, cache header, `t` parsing), film/series/home/library loaders (owner gets local
  data; non-owner gets null and the repository is never called), `library.test.ts` (local tab
  hidden for non-owners).
- `tests/hqp.e2e.ts` (dev server with `MEDIA_LIBRARY_ROOTS`, owner storage state; skipped with a
  clear message when `/api/media/sessions` answers 503): film page shows Play for the owner;
  `/watch/<id>` plays (currentTime advances, Signal chip shows Original or Converted);
  chrome toggles; sheet opens; subtitles selection renders cues; quality switch keeps the position;
  seek; progress saved (`GET /api/media/progress`); Home and Library show Continue watching; an
  episode near its end shows Up next and the URL changes to the next file; Close returns to the
  title page; anonymous gets the login redirect; no request to `hls.js` on an iPhone UA.
- `tests/hqp-layout.e2e.ts` (demo harness; no media needed): island invariant in all states and
  both landscape sides; 44 px targets; no horizontal overflow at 320; reduced motion; focus ring
  visible; Esc order.
- `tests/hqp-perf.e2e.ts`: INP under 100 ms at 4x CPU throttle; no long task over 50 ms during
  20 s of playback; layout shift 0 across 5 chrome cycles; glass surface count.

### 16.4 Manual on the owner's iPhone (cannot be automated here)

Home Screen launch (standalone, black-translucent); portrait band black and the island invisible;
landscape 16:9 island on the pillar and 2.39 island over the picture; 4K HDR10 HEVC Direct with
"HDR shown"; AV1 Direct; Dolby Vision 8 file; E-AC-3 5.1 passed through; glass over bright HDR
highlights; credits shrink and sheet glide keep HDR; PiP from the button and by leaving the app;
AirPlay; lock screen controls; wake lock; resume across iPhone and PC; 120 Hz feel; Safari tab mode
with the Home Screen hint.

---

## 17. Requests to other owners (optional contract additions; nothing here blocks the build)

The engine and UI must work without these and show "—" or omit the detail when absent. The lead
decides whether to add the optional fields to `src/lib/media/types.ts`.

stream-server:

1. `PlaybackSession.video` optional `profile`, `bitDepth`, `frameRate`, `hdrKind`, `width`.
2. `PlaybackSession.audioTracks[]` optional `codec`, `channels`, `isDefault`.
3. `PlaybackSession.subtitleTracks[]` optional `forced`, `source`.
4. `PlaybackSession.creditsStart?: number | null`.
5. Apple HLS hygiene: fMP4, `hvc1` sample entry, `#EXT-X-INDEPENDENT-SEGMENTS`,
   `#EXT-X-PLAYLIST-TYPE:VOD`, `#EXT-X-ENDLIST`, an init segment identical across ffmpeg restarts
   (no edit list, `use_editlist=0`), and `CODECS` plus `VIDEO-RANGE=PQ|HLG` if a master playlist is
   emitted (AirPlay and HDR signalling).
6. Trickplay tiles 480 x 270, 10 s interval, 5 x 5 JPEG sheets (q about 60), `pending` while
   generating.
7. Session idle TTL of at least 10 minutes while paused; `DELETE` honoured immediately.
8. First segment after a seek within 600 ms for copy sessions on the LAN.

library-data:

1. `PlayableFile.audio[]` optional `codec`; `PlayableFile.subtitles[]` optional `codec`, `source`.
2. `listContinueWatching` rows carry `stillPath`/`backdropPath`, `showTmdbId` or `movieId` for
   links, and `runtimeMinutes`.
3. Unmatched files listed with their parsed title so they stay playable.

---

## 18. Acceptance criteria

1. `/watch/<fileId>` redirects anonymous users to sign in, answers 404 to signed-in non-owners and
   for unknown or malformed ids, and sends `cache-control: private, no-store`.
2. No page, payload, API response or diagnostic sent to a client contains a library file path.
3. Non-owners see no Play button, no local section, no continue watching rail, and their page
   loads never call the media repository.
4. In Chrome 152 the owner can play a library file: playback starts, the Signal chip shows
   Original (video copy) or Converted with the server's reason, and E-AC-3 audio is converted to
   AAC with the honest note.
5. On an iPhone user agent with native HLS, hls.js is never requested and caps report
   `nativeHls`, `eac3`, `ac3`, `multichannel` true (verified by the engine unit tests with an Apple
   probe).
6. Auto quality starts at Original, steps down after the stall rules and shows the toast; an
   explicit level never changes by itself.
7. Audio and quality switches keep the position (within 1 s) and delete the old session; subtitle
   switches are instant and need no new session.
8. Resume starts at the saved position when not completed and shows "Resumed at … · Start over"
   for 6 s; "Start over" and `?t=0` start at 0.
9. Progress is saved every 10 s while playing and on pause, seek, hide, close and item change;
   completed is set at 92% or in the last 3 minutes.
10. Series: Up next appears at the credits chapter or at `duration - max(45 s, 2%)`, counts down
    10 s, plays the next local episode in place, and the URL becomes `/watch/<nextFileId>`; after 3
    autoplays without input it asks "Still watching?".
11. Home (owner) and `/my/films` show Continue watching with progress; `/my/films` has the On
    this PC tab with films, shows and unmatched files.
12. The island invariant (section 3.3) holds in every harness state at 440 x 956 and 956 x 440
    (both island sides) with `sim=iphone18`.
13. Portrait: the top 62 px band is pure black (no glow, scrim or glass above y 48); the picture
    is full width; the top bar starts at y 53.
14. Landscape: a 16:9 picture is 782 x 440 in Fit (never smaller); Fill covers the viewport and
    shows the crop toast; the choice is remembered per aspect class.
15. Every interactive element is at least 44 x 44 CSS px; no horizontal overflow at 320 px wide in
    either orientation.
16. All gestures of section 6.1 work as specified in the gesture unit tests; the timeline supports
    fine scrub, chapter magnet and cancel-by-return.
17. Keyboard: every shortcut of section 6.4 works on the large layout; Esc closes layers in order;
    focus is visible and trapped in dialogs.
18. Screen reader: the timeline announces position, duration and chapter; seeks and track changes
    are announced politely; errors as alerts.
19. Reduced motion removes translate/scale animations (crossfades only); reduced transparency and
    Lite glass replace blur with solid fills.
20. Hidden chrome leaves zero visible glass surfaces and no rAF loop; with the chrome visible there
    are at most 8 small glass surfaces and one thick one.
21. Controls INP under 100 ms with 4x CPU throttle; no long task over 50 ms during 20 s of
    playback; zero layout shift when the chrome shows or hides.
22. HQP JavaScript excluding hls.js at most 45 kB gzip and CSS at most 12 kB gzip, measured by the
    lead on a production build.
23. Every error of section 8 renders its card with the right action; 503 offers Retry; decode
    recovers once automatically before showing the card.
24. PiP, AirPlay (button only when available), Media Session handlers and the wake lock are wired
    (unit-tested; device-checked later).
25. Subtitles render from WebVTT with the chosen style and offset; native tracks switch to
    `showing` during PiP/AirPlay/native fullscreen.
26. The manifest and Apple meta tags of section 13.6 are present; icons 180, 192, 512 and maskable
    512 exist; no site page puts content under the status bar at a 62 px top inset.
27. `pnpm check` has 0 errors in the builders' files; `pnpm lint` passes on them; all new unit
    tests pass; the e2e suites pass or are skipped with an explicit reason (media library offline).
28. Nothing is written under `F:/`; every ffmpeg and dev server started by a builder is stopped.

---

## 19. Risks, untested items and rollback

Untested on a real iPhone (Chrome emulation only): real safe-area values and island position;
standalone launch and status bar style; backdrop-filter cost and look over HDR (EDR) video in
Safari 26; whether HDR survives transforms on the frame wrapper (fallback: the reduced-motion
crossfade variants); `dynamic-range-limit` support in Safari 26; AV1 and E-AC-3 direct play through
native HLS fMP4; PiP via `webkitSetPresentationMode`, AirPlay events, lock screen artwork; Screen
Wake Lock in standalone; rAF cadence (120 Hz not proven; visuals rely on compositor transforms and
degrade gracefully); autoplay after the navigation (handled by the blocked state); tap/double-tap
feel (optimistic tap may flash the chrome for one frame before a double tap; accepted, as YouTube
does).

Media risks: Dolby Vision profile 5 needs the server's reshape/tone-map path; PGS subtitles are
not available; DTS and FLAC are always converted; trickplay over 449 hours is generated lazily
(`pending` shows time and chapter only); chapters are missing in many MKVs (the timeline is one
segment, credits detection falls back to time).

Rollback: everything is additive. Remove the `/watch` route and the links, revert the layout's
immersive branch, the manifest and `app.html`; no schema or data change is made by the HQP
builders.
