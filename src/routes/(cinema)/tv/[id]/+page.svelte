<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import BackdropImage from '$lib/components/ui/backdrop-image';
	import Button from '$lib/components/ui/button';
	import MetaChips from '$lib/components/ui/meta-chips';
	import PosterCard from '$lib/components/ui/poster-card';
	import Rail from '$lib/components/ui/rail';
	import Section from '$lib/components/ui/section';
	import Tabs from '$lib/components/ui/tabs';
	import { addToast } from '$lib/stores/toast';
	import { formatDate, formatRuntime } from '$lib/format';
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import ShareIcon from 'lucide-svelte/icons/share-2';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import PlayIcon from 'lucide-svelte/icons/play';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import CircleCheckIcon from 'lucide-svelte/icons/circle-check';
	import BookmarkIcon from 'lucide-svelte/icons/bookmark';
	import BookmarkCheckIcon from 'lucide-svelte/icons/bookmark-check';
	import HeartIcon from 'lucide-svelte/icons/heart';
	import type { SeriesEpisode, SeriesSeason } from './+page.server';

	let { data } = $props();
	const show = $derived(data.show);

	type LocalRow = NonNullable<typeof data.local>['seasons'][number]['episodes'][number];

	const meta = $derived([
		show.years,
		show.seasons ? `${show.seasons} season${show.seasons === 1 ? '' : 's'}` : null,
		show.rank ? `#${show.rank} on the IMDb Top TV chart` : null
	]);
	const canonicalUrl = $derived(`https://alandatabase.com/tv/${show.tmdbId}`);
	const socialImage = $derived(tmdbImageUrl(show.backdropPath, 'w1280'));
	const description = $derived(
		(show.overview || `Explore ${show.title} on Alan's Database.`).slice(0, 155)
	);
	const firstAired = $derived(formatDate(show.firstAirDate) ?? show.firstYear);
	// One season on the page: name it in the eyebrow instead of a one-tab selector.
	const seasonEyebrow = $derived.by(() => {
		const only = data.seasons.length === 1 ? data.seasons[0] : null;
		const name = only
			? only.seasonNumber === 0
				? 'Specials'
				: `Season ${only.seasonNumber}`
			: 'Seasons';
		return data.local ? `On this PC · ${name}` : name;
	});

	// The owner's local copies, by "season:episode" (Alan's HQP). Empty for everyone else.
	const localByEpisode = $derived(
		new Map<string, LocalRow>(
			(data.local?.seasons ?? []).flatMap((season) =>
				season.episodes.map((row) => [`${season.seasonNumber}:${row.episodeNumber}`, row] as const)
			)
		)
	);
	const seasonItems = $derived(
		data.seasons.map((season) => ({
			value: `season-${season.seasonNumber}`,
			label: season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`
		}))
	);

	// The season in the address (?season=), else the one Resume plays, else the first.
	function initialSeason(): string {
		const asked = page.url.searchParams.get('season');
		if (asked !== null && data.seasons.some((season) => String(season.seasonNumber) === asked)) {
			return `season-${asked}`;
		}
		const resume = data.local?.resume?.fileId;
		const resumeSeason = data.local?.seasons.find((season) =>
			season.episodes.some((row) => row.fileId === resume)
		);
		if (resumeSeason) return `season-${resumeSeason.seasonNumber}`;
		return data.seasons[0] ? `season-${data.seasons[0].seasonNumber}` : '';
	}

	let season = $state(untrack(initialSeason));
	let seasonShowId = untrack(() => data.show.tmdbId);
	$effect.pre(() => {
		const id = data.show.tmdbId;
		if (id === seasonShowId) return;
		seasonShowId = id;
		season = untrack(initialSeason);
	});

	function selectSeason(value: string) {
		season = value;
		const url = new URL(page.url);
		url.searchParams.set('season', value.replace('season-', ''));
		replaceState(url, page.state);
	}

	function seasonByValue(value: string): SeriesSeason | undefined {
		return data.seasons.find((entry) => `season-${entry.seasonNumber}` === value);
	}

	function episodeCode(episode: SeriesEpisode): string {
		return episode.seasonNumber === 0
			? `Special · E${episode.episodeNumber}`
			: `S${episode.seasonNumber} · E${episode.episodeNumber}`;
	}

	function episodeTitle(episode: SeriesEpisode): string {
		return episode.name ?? `Episode ${episode.episodeNumber}`;
	}

	function episodeFacts(episode: SeriesEpisode): string {
		return [formatRuntime(episode.runtime), formatDate(episode.airDate)]
			.filter(Boolean)
			.join(' · ');
	}

	function playLabel(episode: SeriesEpisode, row: LocalRow): string {
		const verb = row.completed ? 'Play again' : row.remainingLabel ? 'Resume' : 'Play';
		const where =
			episode.seasonNumber === 0
				? `special ${episode.episodeNumber}`
				: `season ${episode.seasonNumber} episode ${episode.episodeNumber}`;
		return [`${verb} ${where}`, episodeTitle(episode), row.remainingLabel]
			.filter(Boolean)
			.join(', ');
	}

	function stillSet(path: string | null) {
		const small = tmdbImageUrl(path, 'w300');
		const large = tmdbImageUrl(path, 'w780');
		if (!small || !large) return null;
		return { src: small, srcset: `${small} 300w, ${large} 780w` };
	}

	type ToggleType = 'watchlist' | 'favorite';
	type Interaction = NonNullable<typeof data.interaction>;
	const EMPTY_INTERACTION: Interaction = { watchlist: false, favorite: false };
	const TOGGLES = ['watchlist', 'favorite'] as const;

	let pending = $state<ToggleType | null>(null);
	let interaction = $state<Interaction | null>(null);
	// The server state is the truth; optimistic flips are reverted when the save fails.
	$effect(() => {
		interaction = data.interaction;
	});
	const loginHref = $derived(`/auth/login?returnTo=${encodeURIComponent(`/tv/${show.tmdbId}`)}`);

	function toggleLabel(type: ToggleType, on: boolean): string {
		if (type === 'watchlist') return on ? 'In watchlist' : 'Watchlist';
		return on ? 'Favourited' : 'Favourite';
	}

	// Toast copy comes from the saved state the server returned, never from the click.
	function toggleToast(type: ToggleType, saved: Interaction): string {
		if (type === 'watchlist') {
			return saved.watchlist
				? `${show.title} added to your watchlist`
				: `${show.title} removed from your watchlist`;
		}
		return saved.favorite
			? `${show.title} added to favourites`
			: `${show.title} removed from favourites`;
	}

	function submitToggle(type: ToggleType) {
		return () => {
			const previous = interaction;
			const base = interaction ?? EMPTY_INTERACTION;
			pending = type;
			interaction = { ...base, [type]: !base[type] };
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: unknown };
				update: (options?: { reset?: boolean }) => Promise<void>;
			}) => {
				pending = null;
				const saved = (result.data as { interaction?: Interaction } | undefined)?.interaction;
				if (result.type === 'success' && saved) {
					interaction = saved;
					addToast(toggleToast(type, saved), 'success');
					await update({ reset: false });
				} else {
					interaction = previous;
					addToast('That could not be saved. Please try again.', 'error');
				}
			};
		};
	}

	async function share() {
		const url = window.location.href;
		try {
			if (navigator.share) {
				await navigator.share({ title: show.title, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			addToast('Link copied', 'success');
		} catch (err) {
			// Closing the share sheet is not an error worth reporting.
			if ((err as Error)?.name !== 'AbortError') addToast('Could not share this series', 'error');
		}
	}
</script>

<svelte:head>
	<title>{show.title}{show.firstYear ? ` (${show.firstYear})` : ''} | Alan's Database</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={`${show.title} | Alan's Database`} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="video.tv_show" />
	<meta property="og:url" content={canonicalUrl} />
	{#if socialImage}<meta property="og:image" content={socialImage} />{/if}
	<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

{#snippet episodeBody(episode: SeriesEpisode, row: LocalRow | undefined)}
	{@const still = stillSet(episode.stillPath)}
	<span class="still">
		{#if still}
			<img
				src={still.src}
				srcset={still.srcset}
				sizes="(min-width: 768px) 13rem, 8.5rem"
				alt=""
				width="300"
				height="169"
				loading="lazy"
				decoding="async"
			/>
		{/if}
		{#if row}
			<span class="still-play" aria-hidden="true">
				<PlayIcon size={16} fill="currentColor" />
			</span>
			{#if row.progress > 0}
				<span class="still-track" aria-hidden="true">
					<span style:transform={`scaleX(${row.progress})`}></span>
				</span>
			{/if}
		{/if}
	</span>
	<span class="episode-text">
		<span class="episode-code">{episodeCode(episode)}</span>
		<span class="episode-title">{episodeTitle(episode)}</span>
		{#if episodeFacts(episode)}<span class="episode-facts">{episodeFacts(episode)}</span>{/if}
		{#if row}
			<span class="episode-local">
				{#if row.completed}
					<CircleCheckIcon size={14} aria-hidden="true" />
					Watched
				{:else if row.remainingLabel}
					{row.remainingLabel}
				{:else if row.fileId === data.local?.resume?.fileId}
					Up next{row.resolution === '2160p' ? ' · 4K' : ''}
				{:else}
					On this PC{row.resolution === '2160p' ? ' · 4K' : ''}
				{/if}
			</span>
		{/if}
	</span>
	{#if episode.overview}<span class="episode-overview">{episode.overview}</span>{/if}
{/snippet}

{#snippet episodeList(entry: SeriesSeason | undefined)}
	{#if entry}
		<ol class="episode-list">
			{#each entry.episodes as episode (episode.episodeNumber)}
				{@const row = localByEpisode.get(`${episode.seasonNumber}:${episode.episodeNumber}`)}
				<li>
					{#if row}
						<a
							class="episode playable"
							class:current={row.fileId === data.local?.resume?.fileId}
							href={row.href}
							aria-label={playLabel(episode, row)}
						>
							{@render episodeBody(episode, row)}
						</a>
					{:else}
						<div class="episode">
							{@render episodeBody(episode, undefined)}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
{/snippet}

<article class="detail">
	<header class="header">
		<BackdropImage path={show.backdropPath} eager animate={false} priority="low" sizes="100vw" />
		<div class="scrim" aria-hidden="true"></div>
		<div class="header-content">
			<div class="poster">
				<PosterCard
					id={`tv-${show.tmdbId}`}
					title={show.title}
					posterPath={show.posterPath}
					eager
					sizes="(min-width: 768px) 240px, 120px"
				/>
			</div>
			<div class="text">
				<p class="eyebrow-pill">Series</p>
				<h1 class="title">{show.title}</h1>
				<div class="rating-line">
					{#if show.rating !== null && show.ratingSource}
						<span class="score">
							<span class="sr-only"
								>{show.ratingSource} rating {show.rating.toFixed(1)} out of 10</span
							>
							<span class="score-value" aria-hidden="true">{show.rating.toFixed(1)}</span>
							<span class="score-source" aria-hidden="true">{show.ratingSource}</span>
						</span>
					{/if}
					<MetaChips items={meta} />
				</div>
				{#if show.genres.length}
					<ul class="genres" aria-label="Genres">
						{#each show.genres as genre (genre)}
							<li>{genre}</li>
						{/each}
					</ul>
				{/if}
				{#if data.local?.play}
					{@const play = data.local.play}
					<!-- The owner's own episodes: they play in Alan's HQP. Nobody else gets this data. -->
					<div class="local" role="group" aria-label="On this PC">
						<Button href={play.href} size="lg" class="local-play">
							<PlayIcon size={20} fill="currentColor" aria-hidden="true" />
							<span>{play.label}</span>
							{#if play.progress > 0}
								<span class="local-progress" aria-hidden="true">
									<span style:transform={`scaleX(${play.progress})`}></span>
								</span>
							{/if}
						</Button>
						{#if play.startOverHref}
							<Button href={play.startOverHref} variant="secondary" class="local-more">
								<RotateCcwIcon size={18} aria-hidden="true" />
								<span>Start over</span>
							</Button>
						{/if}
					</div>
					<p class="local-note">
						<span class="local-dot" aria-hidden="true"></span>
						{data.local.episodeCount} episode{data.local.episodeCount === 1 ? '' : 's'} on this PC
					</p>
				{/if}
				<div class="actions">
					{#each TOGGLES as type (type)}
						{@const on = Boolean(interaction?.[type])}
						{#if data.signedIn}
							<form method="POST" action="?/logInteraction" use:enhance={submitToggle(type)}>
								<input type="hidden" name="type" value={type} />
								<input type="hidden" name="value" value={String(!on)} />
								<Button
									type="submit"
									variant="secondary"
									aria-pressed={on}
									loading={pending === type}
								>
									{#if type === 'watchlist'}
										{#if on}<BookmarkCheckIcon size={18} aria-hidden="true" />{:else}<BookmarkIcon
												size={18}
												aria-hidden="true"
											/>{/if}
									{:else}
										<HeartIcon size={18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
									{/if}
									<span>{toggleLabel(type, on)}</span>
								</Button>
							</form>
						{:else}
							<Button href={loginHref} variant="secondary">
								{#if type === 'watchlist'}<BookmarkIcon
										size={18}
										aria-hidden="true"
									/>{:else}<HeartIcon size={18} aria-hidden="true" />{/if}
								<span>{toggleLabel(type, false)}</span>
							</Button>
						{/if}
					{/each}
					<Button variant="secondary" class="share" onclick={share}>
						<ShareIcon size={18} aria-hidden="true" />
						<span class="share-label">Share</span>
					</Button>
				</div>
			</div>
		</div>
	</header>

	<div class="body">
		<div class="overview">
			<section class="story" aria-labelledby="story-heading">
				<h2 id="story-heading">Synopsis</h2>
				{#if show.tagline}<p class="tagline">{show.tagline}</p>{/if}
				<p>{show.overview ?? 'No synopsis yet.'}</p>
			</section>
			<aside class="facts-card" aria-labelledby="facts-heading">
				<h2 id="facts-heading">Details</h2>
				<dl class="facts">
					{#if firstAired}
						<div>
							<dt>First aired</dt>
							<dd>{firstAired}</dd>
						</div>
					{/if}
					{#if show.seasons}
						<div>
							<dt>Seasons</dt>
							<dd>{show.seasons}</dd>
						</div>
					{/if}
					{#if show.episodes}
						<div>
							<dt>Episodes</dt>
							<dd>{show.episodes}</dd>
						</div>
					{/if}
					{#if show.status}
						<div>
							<dt>Status</dt>
							<dd>{show.status}</dd>
						</div>
					{/if}
					{#if show.rating !== null && show.ratingSource}
						<div>
							<dt>{show.ratingSource} rating</dt>
							<dd>{show.rating.toFixed(1)} / 10</dd>
						</div>
					{/if}
					{#if show.rank}
						<div>
							<dt>Chart rank</dt>
							<dd>#{show.rank} of 50</dd>
						</div>
					{/if}
					{#if show.imdbId}
						<div>
							<dt>Links</dt>
							<dd>
								<a
									class="ext"
									href={`https://www.imdb.com/title/${show.imdbId}/`}
									target="_blank"
									rel="noopener noreferrer"
									>IMDb <ExternalLinkIcon size={12} aria-hidden="true" /></a
								>
							</dd>
						</div>
					{/if}
				</dl>
			</aside>
		</div>

		{#if data.seasons.length > 0}
			<section class="episodes" aria-labelledby="episodes-heading">
				<p class="eyebrow">{seasonEyebrow}</p>
				<h2 id="episodes-heading">Episodes</h2>
				{#if data.seasons.length > 1}
					<Tabs
						bind:value={season}
						items={seasonItems}
						label="Seasons"
						onValueChange={selectSeason}
					>
						{#snippet children(value)}
							{@render episodeList(seasonByValue(value))}
						{/snippet}
					</Tabs>
				{:else}
					{@render episodeList(data.seasons[0])}
				{/if}
			</section>
		{/if}

		{#if data.similar.length}
			<!-- Same rail recipe as the film page: the first card lines up with the page content. -->
			<div class="bleed">
				<Section title="More like this" eyebrow="Series" seeAllHref="/tv" seeAllLabel="All series">
					<Rail label="More like this">
						{#each data.similar as item (item.id)}
							<PosterCard {...item} />
						{/each}
					</Rail>
				</Section>
			</div>
		{/if}
	</div>
</article>

<style>
	.detail {
		padding-bottom: var(--space-8);
	}
	/* The header runs under the translucent top bar, like the film page. */
	.header {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: min(62dvh, 480px);
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
		overflow: hidden;
		background: var(--surface-canvas);
	}
	.header :global(.backdrop) {
		position: absolute;
		inset: 0;
	}
	/* The film hero's scrim: bottom-weighted, so every hero text keeps AA over bright skies. */
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to top,
				var(--surface-canvas) 0%,
				color-mix(in srgb, var(--surface-canvas) 92%, transparent) 36%,
				color-mix(in srgb, var(--surface-canvas) 72%, transparent) 56%,
				color-mix(in srgb, var(--surface-canvas) 24%, transparent) 76%,
				transparent 92%
			),
			linear-gradient(
				to right,
				color-mix(in srgb, var(--surface-canvas) 88%, transparent) 0%,
				color-mix(in srgb, var(--surface-canvas) 35%, transparent) 55%,
				transparent 100%
			);
	}
	.header-content {
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-5);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-7)) var(--page-gutter)
			var(--space-6);
	}
	.poster {
		width: 120px;
	}
	.text {
		position: relative;
		isolation: isolate;
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		min-width: 0;
	}
	.text > * {
		max-width: 100%;
	}
	.text::before {
		content: '';
		position: absolute;
		inset: -1.5rem -2.5rem -1rem;
		z-index: -1;
		background: radial-gradient(
			closest-side,
			color-mix(in srgb, var(--surface-canvas) 66%, transparent),
			transparent
		);
		pointer-events: none;
	}
	.rating-line,
	.local-note {
		text-shadow: 0 1px 2px color-mix(in srgb, var(--surface-canvas) 85%, transparent);
	}
	/* The kind of title, on its own surface so the emerald never sits on raw artwork. */
	.eyebrow-pill {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--surface-canvas) 90%, transparent);
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--type-display);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
	}
	.rating-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.score {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--surface-canvas) 70%, var(--brand-active) 12%);
		border: 1px solid var(--brand-border);
		text-shadow: none;
	}
	.score-value {
		color: var(--content-primary);
		font-size: var(--text-md);
		font-weight: 800;
	}
	.score-source {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
	}
	.genres li {
		padding: 0.35rem 0.85rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--surface-canvas) 72%, transparent);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* ── On this PC (owner only) ──────────────────────────────────────── */
	.local {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	/* White like a cinema "Play": the emerald is kept for the watched part. */
	.local :global(.local-play) {
		--btn-bg: var(--content-primary);
		--btn-fg: var(--content-inverse);
		position: relative;
		flex: 1 1 100%;
		overflow: hidden;
		min-height: 3.25rem;
		font-variant-numeric: tabular-nums;
	}
	.local :global(.local-play:hover) {
		--btn-bg: var(--accent-titanium);
	}
	.local :global(.local-more) {
		flex: 1 1 auto;
	}
	.local-progress {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 3px;
		background: var(--brand-muted);
	}
	.local-progress span {
		display: block;
		height: 100%;
		background: var(--brand-active);
		transform-origin: left;
	}
	.local-note {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.local-dot {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-full);
		background: var(--brand-primary);
		box-shadow: var(--shadow-glow-emerald);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	/* Phones: Watchlist, Favourite and Share stay on one row; Share keeps its name for readers. */
	@media (max-width: 479px) {
		.actions :global(.share) {
			width: var(--touch-target);
			padding-inline: 0;
		}
		.share-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
	.body {
		display: grid;
		/* minmax(0, 1fr): the rail scrolls inside the column instead of widening it. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-8);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-7) var(--page-gutter) 0;
	}
	/* Synopsis and a details card: two columns from 1024 px, like the film overview. */
	.overview {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	.story h2,
	.episodes h2,
	.facts-card h2 {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.story p {
		max-inline-size: 62ch;
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: var(--leading-body);
	}
	.facts-card {
		padding: var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.ext {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: var(--touch-target);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.ext:hover {
		color: var(--brand-primary);
	}
	.bleed {
		margin-inline: calc(-1 * var(--page-gutter));
	}
	.bleed :global(.section) {
		margin-block: 0;
	}
	.story .tagline {
		color: var(--content-primary);
		font-style: italic;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.facts dt {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.facts dd {
		margin-top: 0.3rem;
		font-weight: 700;
	}

	/* ── Episodes ─────────────────────────────────────────────────────── */
	.episodes {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.episodes h2 {
		margin-bottom: var(--space-3);
	}
	.episode-list {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
		list-style: none;
	}
	/* Every row on the same padded tonal surface; Up next only changes the border colour. */
	.episode {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr);
		align-items: start;
		gap: var(--space-3);
		height: 100%;
		padding: var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: inherit;
	}
	.episode.playable {
		-webkit-tap-highlight-color: transparent;
	}
	.episode.playable:hover {
		border-color: var(--border-strong);
		background: var(--surface-overlay);
	}
	.episode.playable:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	.episode.current {
		border-color: var(--brand-border);
	}
	.still {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.still img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.still-play {
		position: absolute;
		left: 0.4rem;
		bottom: 0.55rem;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-full);
		background: var(--content-primary);
		color: var(--content-inverse);
		box-shadow: var(--elevation-2);
	}
	.still-play :global(svg) {
		margin-left: 2px;
	}
	.still-track {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 3px;
		background: rgba(255, 255, 255, 0.22);
	}
	.still-track span {
		display: block;
		height: 100%;
		background: var(--brand-primary);
		transform-origin: left;
	}
	.episode-text {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		padding-top: 0.1rem;
	}
	.episode-code {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		font-variant-numeric: tabular-nums;
	}
	.episode-title {
		display: -webkit-box;
		overflow: hidden;
		font-weight: 800;
		line-height: 1.25;
		overflow-wrap: anywhere;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}
	.episode-facts {
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.episode-local {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.episode-overview {
		grid-column: 1 / -1;
		display: -webkit-box;
		overflow: hidden;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.55;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	@media (min-width: 560px) {
		.local :global(.local-play) {
			flex: 0 0 auto;
			min-width: 14rem;
		}
		.local :global(.local-more) {
			flex: 0 0 auto;
		}
	}
	@media (min-width: 768px) {
		.header {
			min-height: min(70dvh, 620px);
		}
		.header-content {
			grid-template-columns: clamp(180px, 20vw, 240px) 1fr;
			align-items: end;
			gap: var(--space-7);
			padding-bottom: var(--space-7);
		}
		.poster {
			width: auto;
		}
		.episode {
			grid-template-columns: 13rem minmax(0, 1fr);
			gap: var(--space-2) var(--space-4);
			padding: var(--space-3);
		}
		.episode .still {
			grid-row: span 2;
		}
		.episode-overview {
			grid-column: 2;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}
	@media (min-width: 1024px) {
		.episode-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.overview {
			grid-template-columns: 7fr 5fr;
			gap: var(--space-8);
		}
		.story p {
			font-size: var(--text-lg);
			line-height: 1.7;
		}
	}
	/* Phone landscape: the film page's compact hero, so Play and Share sit above the tab bar. */
	@media (orientation: landscape) and (max-height: 500px) {
		.header {
			min-height: 0;
		}
		.header-content {
			grid-template-columns: 140px minmax(0, 1fr);
			align-items: end;
			gap: var(--space-5);
			padding-top: calc(var(--top-bar-height) + var(--safe-top) + var(--space-4));
			padding-bottom: var(--space-4);
		}
		.poster {
			width: 140px;
		}
		.text {
			gap: var(--space-2);
		}
		.title {
			font-size: 2rem;
		}
		.genres {
			display: none;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.episode.playable {
			transition:
				background-color var(--duration-fast) var(--ease-out),
				border-color var(--duration-fast) var(--ease-out);
		}
	}
</style>
