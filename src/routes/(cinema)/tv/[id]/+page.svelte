<script lang="ts">
	import { untrack } from 'svelte';
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
	import { formatDate } from '$lib/format';
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import ShareIcon from 'lucide-svelte/icons/share-2';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import PlayIcon from 'lucide-svelte/icons/play';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import CircleCheckIcon from 'lucide-svelte/icons/circle-check';
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
		return [episode.runtime ? `${episode.runtime} min` : null, formatDate(episode.airDate)]
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
				<p class="eyebrow">Series</p>
				<h1 class="title">{show.title}</h1>
				<div class="rating-line">
					{#if show.rating !== null && show.ratingSource}
						<span
							class="score"
							aria-label={`${show.ratingSource} rating ${show.rating.toFixed(1)} out of 10`}
						>
							<span class="score-value">{show.rating.toFixed(1)}</span>
							<span class="score-source">{show.ratingSource}</span>
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
					<Button variant="secondary" onclick={share}>
						<ShareIcon size={18} aria-hidden="true" />
						Share
					</Button>
					{#if show.imdbId}
						<Button
							variant="ghost"
							href={`https://www.imdb.com/title/${show.imdbId}/`}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLinkIcon size={18} aria-hidden="true" />
							IMDb page
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="body">
		<section class="story" aria-labelledby="story-heading">
			<h2 id="story-heading">Story</h2>
			{#if show.tagline}<p class="tagline">{show.tagline}</p>{/if}
			<p>{show.overview ?? 'No synopsis yet.'}</p>
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
			</dl>
		</section>

		{#if data.seasons.length > 0}
			<section class="episodes" aria-labelledby="episodes-heading">
				<p class="eyebrow">
					{data.local ? 'Seasons · On this PC' : 'Seasons'}
				</p>
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
	</div>

	{#if data.similar.length}
		<Section title="More like this" eyebrow="Series" seeAllHref="/tv" seeAllLabel="All series">
			<Rail label="More like this">
				{#each data.similar as item (item.id)}
					<PosterCard {...item} />
				{/each}
			</Rail>
		</Section>
	{/if}

	<p class="back">
		<a href="/tv"><ArrowLeftIcon size={16} aria-hidden="true" /> Back to TV</a>
	</p>
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
	/* Lighter than a full black wash: the artwork stays readable, the text keeps AA contrast. */
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 4%, rgba(8, 9, 11, 0.72) 38%, transparent 78%),
			linear-gradient(to right, rgba(8, 9, 11, 0.6), transparent 60%);
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
		display: grid;
		gap: var(--space-3);
		min-width: 0;
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
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: 1.02;
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
		background: var(--brand-muted);
		border: 1px solid var(--brand-border);
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
		background: rgba(255, 255, 255, 0.06);
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
	.body {
		display: grid;
		gap: var(--space-8);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-7) var(--page-gutter) 0;
	}
	.story {
		max-width: var(--container-reading);
	}
	.story h2,
	.episodes h2 {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.story p {
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--text-lg);
		line-height: 1.7;
	}
	.story .tagline {
		color: var(--content-primary);
		font-style: italic;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-6);
		padding-top: var(--space-5);
		border-top: 1px solid var(--border-subtle);
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
	.episode {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr);
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-lg);
		color: inherit;
	}
	.episode.playable {
		-webkit-tap-highlight-color: transparent;
	}
	.episode.playable:hover {
		border-color: var(--border-subtle);
		background: var(--surface-raised);
	}
	.episode.playable:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	.episode.current {
		border-color: var(--brand-border);
		background: var(--brand-muted);
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
		-webkit-line-clamp: 2;
		line-clamp: 2;
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
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	.back {
		max-width: var(--container-wide);
		margin: var(--space-6) auto 0;
		padding-inline: var(--page-gutter);
	}
	.back a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-weight: 700;
	}
	.back a:hover {
		color: var(--brand-primary);
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
	}
	@media (prefers-reduced-motion: no-preference) {
		.episode.playable {
			transition:
				background-color var(--duration-fast) var(--ease-out),
				border-color var(--duration-fast) var(--ease-out);
		}
	}
</style>
