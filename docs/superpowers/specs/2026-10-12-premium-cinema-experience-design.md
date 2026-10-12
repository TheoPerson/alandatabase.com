# Premium cinema experience — design spec

Date: 2026-10-12. Status: approved direction by the Product Lead ("Movix-like,
impress me on fluidity, UI/UX, responsive, and the UI kit"); details delegated
to the project lead. Branch: `TheoPerson/V5-Alan-s-Data-Base`.

## 1. Intent

Alan's Data Base is a personal cinema OS: a beautiful film/TV database, a
personal archive (watched, ratings, favourites, lists, stats), discovery
(trending, top rated, genres, the Picker), and on every title: trailer and
where to watch. This spec turns the current functional-but-plain UI into a
premium, Netflix/Movix-grade experience without changing what the product is.

Success is measured on four axes the Product Lead named:

1. **Fluidity** — navigation feels instant, motion runs at 60 fps, nothing
   flashes or shifts while images load.
2. **UI/UX** — cinematic hero, horizontal rails, rich detail pages, clear
   actions, delightful Picker, legible personal library.
3. **Responsive** — iPhone-first from 320 px to 1920 px: bottom tab bar on
   mobile, snap rails, sheets instead of modals, safe areas.
4. **UI kit** — one coherent design system (tokens + components) used by every
   page, visible on a `/kit` showcase page.

Out of scope: third-party streaming mirrors (never; see `AGENTS.md`), a player
for the owner's own files (separate spec later), social features, database-backed
TV (the committed Top-50 snapshot is restyled, not replaced), UI translation.

## 2. Identity to preserve

Deep black canvas (`#08090b`), emerald brand (`#34d399`), the ALAN DB radar
logo, Plus Jakarta Sans, Swiss-OLED restraint: content and typography first,
no glow soup. Keep the existing semantic tokens in `src/app.css` as the base and
extend them; legacy aliases stay for `/tools`.

## 3. Information architecture

| Route              | Role                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | **Home**: hero carousel + rails (Top 10, Trending, Top rated, Genres, TV, My watchlist when signed in). Replaces the marketing landing.                          |
| `/about`           | The current "A quieter way" landing page, moved. Linked from footer.                                                                                             |
| `/movies`          | **Browse**: filter bar (genre, decade, rating, sort) + grid with "Load more". The current `/movies/catalog` grid becomes this; `/movies/catalog` redirects here. |
| `/movies/[id]`     | **Movie detail** (section 5).                                                                                                                                    |
| `/tv`, `/tv/[id]`  | TV landing and detail on the same kit (snapshot data).                                                                                                           |
| `/search`          | Search results grid; the header search and ⌘K palette feed it.                                                                                                   |
| `/discover`        | Mood/genre discovery rails (restyled).                                                                                                                           |
| `/cinema/picker`   | Picker (restyled, logic unchanged).                                                                                                                              |
| `/my/*`, `/auth/*` | Library tabs and auth on the kit.                                                                                                                                |
| `/kit`             | Public, `noindex` styleguide: tokens, every component, every state.                                                                                              |

Hostname routing (`status.`, `api.`, `auth.`) and all `/api/*` are unchanged.
Catalogue-edit, admin, setup and tools pages keep their current markup (not a
goal of this spec) but inherit the tokens.

## 4. Navigation

- **Top bar (all sizes):** transparent over the hero, turns into a blurred
  solid bar after 24 px of scroll. Left: logo. Centre (≥ 1024 px): Home,
  Movies, TV, Discover, Picker. Right: search (expands inline; ⌘K/Ctrl+K opens
  the palette), "My library", sign in / avatar menu.
- **Bottom tab bar (< 1024 px):** Home, Movies, TV, Search, Library. 56 px +
  `env(safe-area-inset-bottom)`. Active tab in emerald. Hidden while a sheet is
  open. Replaces the hamburger menu.
- Current page is announced with `aria-current="page"`.

## 5. Screens

### Home

- **Hero carousel:** 5 featured titles (top rated with a backdrop). Full-bleed
  backdrop (`srcset` w780/w1280/original), layered left+bottom gradients, title
  (TMDB logo image when the worker stored one, else text), meta chips (rating,
  year, runtime, up to 3 genres), 2-line overview, actions: **Trailer**
  (primary), **Details**, **+ Watchlist** (signed in) . Auto-advances every 8 s
  with a progress indicator; pauses on hover/focus and under reduced motion;
  swipeable on touch; next backdrop preloaded. Height: `min(80dvh, 720px)` on
  desktop, `70dvh` on mobile with the text block at the bottom.
- **Rails** (section 6, `Rail`): Top 10 today (`RankedRail` with large rank
  numerals), Trending, Top rated, Genre chips row, TV Top 10 (snapshot),
  "My watchlist" and "Continue exploring" when signed in. Each rail has a
  title and a "See all" link.
- States: empty catalogue → `EmptyState` with the sync instructions; DB error →
  `ErrorState` with the status link (both exist).

### Movie detail

- Backdrop hero with gradient; on ≥ 768 px a poster card at left, text at
  right; on mobile the poster floats over the lower edge of the backdrop.
- Title, tagline, meta chips, genre chips.
- **Actions:** Trailer (primary, present only when a YouTube trailer exists),
  Watchlist, Favourite, Watched — toggles with optimistic UI and toast, signed
  out → login with `returnTo`. Share (Web Share API, fallback copy link).
- Sections, each a `Section`: Overview; **Cast** rail (rounded photos, name,
  character); **Crew** list highlighting Director, Writer, Cinematographer,
  Composer, Editor (below-the-line credit, from the discovery doc); **Videos**
  rail (trailer/teaser facades); **Where to watch** (section 7) for FR with
  "Data provided by JustWatch"; **Details** grid (release date, runtime,
  original language, status, budget/revenue formatted, TMDB/IMDb links);
  **More like this** rail (same primary genre, local, bounded); **Your review**
  (existing review form restyled).
- Trailer playback: `TrailerFacade` shows the YouTube thumbnail with a play
  button; only on click it inserts a `youtube-nocookie.com` embed. CSP
  `frame-src` gains exactly that origin; the player-safety test is updated to
  allow an iframe only inside `TrailerFacade.svelte` and only with a validated
  11-character YouTube key. No other iframe anywhere.

### Browse, Search, Discover, TV, Picker, Library, Auth

- Browse: sticky filter bar of `Chip`s, result count, `PosterCard` grid
  (`auto-fill, minmax(140px, 1fr)` on mobile → 180 px on desktop), "Load more"
  that appends and updates `?page=`. Skeleton grid while loading.
- Search: header input → `/search?q=`; palette (`⌘K`) shows instant results
  (debounced `/api/search`), keyboard navigation, recent searches
  (localStorage). Results page uses the same grid.
- Discover: rails by genre and decade, restyled.
- TV: landing hero + ranked rail + grid from the snapshot; detail reuses the
  detail layout with the fields the snapshot has. No fabricated data.
- Picker: presets as `Chip`s, result as a `BackdropCard` with poster, reason,
  signals and actions; on mobile the card fills the viewport and "Another"
  is a swipe or a big bottom button. Logic and API unchanged.
- Library: tabs Watchlist / Favourites / Watched / Lists / Stats. Stats are KPI
  tiles (count, hours, top genres, decades) with simple bars; charts follow the
  dataviz skill rules. Empty states carry a call to action.
- Auth: centred card over a blurred poster collage; same inputs/buttons.

## 6. UI kit

One convention: `src/lib/components/ui/<name>/` with `index.ts` exports
(shadcn-svelte layout already configured), bits-ui for focus/ARIA-heavy
primitives. Legacy single-file components (`Button.svelte`, `Badge.svelte`,
`Card.svelte`, `Input.svelte`, `Modal.svelte`) are migrated and deleted.

| Group      | Components                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitives | `Button` (primary/secondary/ghost/outline/danger; sm/md/lg/icon; loading; renders `<a>` with `href`), `IconButton`, `Chip` (selectable, removable), `Badge`, `Input`, `SearchInput`, `Switch`, `Tabs`, `Dialog`, `Sheet` (bottom on mobile, side on desktop), `Tooltip`, `Avatar`, `Skeleton`, `Toast`, `Progress`, `Kbd` |
| Media      | `PosterCard` (2:3, blur-up, hover overlay, rating badge, quick actions), `BackdropImage` (srcset, blur-up, gradient slots), `Rail`, `RankedRail`, `HeroCarousel`, `TrailerFacade`, `RatingBadge`, `MetaChips`, `PersonCard`                                                                                               |
| Layout     | `TopBar`, `BottomTabBar`, `Section` (title, eyebrow, "See all"), `Container`, `PageHeader`                                                                                                                                                                                                                                |
| States     | `EmptyState`, `ErrorState`, `LoadingState` (exist; restyled)                                                                                                                                                                                                                                                              |

Tokens (extend `src/app.css`): typography scale (`display`, `headline`,
`title`, `body`, `label`, with `clamp()`), elevation (`--elevation-0..3`),
motion (`--duration-fast/base/slow`, `--ease-out/spring`), z-index scale
(`--z-bar`, `--z-sheet`, `--z-toast`), safe-area variables, container widths.
Every component uses tokens only; pages use kit components and may add only
layout CSS.

`/kit` renders every component in every variant and state, plus a token sheet.

## 7. Data additions (additive, reversible)

- **Watch providers:** new table `movie_watch_providers` (`movie_id`,
  `region`, `kind` flatrate/rent/buy/free, `provider_id`, `provider_name`,
  `logo_path`, `display_priority`, `link`), migration `0005`, unique on
  (`movie_id`, `region`, `kind`, `provider_id`). The worker ingests TMDB
  `watch/providers` for `FR` (and `US`) through `append_to_response`. Reads
  are local only. UI shows the JustWatch attribution TMDB requires.
- **Title logos:** worker stores the best English/neutral logo path in
  `movies.metadata.logoPath` (no migration). Hero uses it when present.
- Local development data: the worker's `sync-popular` plus top-rated pages
  into the local database, using the owner's TMDB key from `.env`.

## 8. Fluidity and performance rules

- Images: TMDB size per breakpoint via `srcset`/`sizes`; `aspect-ratio`
  reserved everywhere (zero CLS); `loading="lazy"` except the first hero image
  (`fetchpriority="high"`); blur-up from a w92 placeholder; `decoding="async"`.
- Motion: transform/opacity only, 120–360 ms, `--ease-spring` for cards;
  `prefers-reduced-motion` disables auto-advance and hover lift (existing
  global rule kept).
- Rails: `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`,
  `content-visibility: auto` on below-the-fold sections, arrow buttons scroll
  by one viewport width, keyboard arrows move focus between cards.
- Navigation: keep `preload-data="hover"`, add `tap` on touch; progress bar
  stays; page-level mount transitions (fade 160 ms) instead of view
  transitions (removed in V3 for jank).
- Server: home and detail loads run their queries in parallel; every query
  bounded; anonymous public pages keep V3 cache policy.
- Budget: no new runtime dependency except what bits-ui already provides; icons
  stay per-icon imports.

## 9. Accessibility

WCAG 2.2 AA intent, kept by the existing axe E2E: visible focus (exists),
44 px touch targets, `aria-current`, rails as `role="region"` with labels and
keyboard operation, sheets trap focus and restore it, carousel is pausable and
announced, colour contrast ≥ 4.5:1 for text on gradients (verified in the kit
page with the darkest/lightest backdrops).

## 10. Testing and verification

- Unit (vitest): pure helpers — TMDB image URL/srcset builder, rail scroll
  math, formatters (runtime, money, dates), YouTube key validation, provider
  grouping. Server: watch-provider ingestion safety (worker test), detail
  loader shape, redirects (`/movies/catalog` → `/movies`).
- E2E (Playwright, existing suites updated): `/` is the cinema home;
  responsive widths include `/`, `/movies`, a detail page, `/cinema/picker`;
  axe on the same; keyboard: rails and bottom bar; trailer facade loads no
  iframe before click.
- Visual: screenshots at 390 px and 1440 px of home, detail, browse, picker,
  library reviewed by the project lead; `VISUAL_REGRESSION` baselines updated.
- Performance: a Playwright script records CLS and LCP on `/` and a detail
  page against the local preview; target CLS < 0.05, LCP image is the hero.

## 11. Delivery order (each slice visible and verified)

1. Real local data: migration `0005`, worker providers/logos, ingest.
2. Tokens, kit core, `/kit` page.
3. Home at `/`, landing → `/about`, top bar, bottom tab bar.
4. Movie detail.
5. Browse + Search (palette).
6. TV, Discover, Picker.
7. Library, Auth.
8. Performance, accessibility and visual pass; docs (`PROJECT.md`,
   `ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md`).
