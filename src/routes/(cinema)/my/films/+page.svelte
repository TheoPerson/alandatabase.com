<script lang="ts">
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PosterGrid from '$lib/components/browse/poster-grid.svelte';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import ContinueCard from '$lib/components/ui/continue-card';
	import { libraryTabsFor, type LibraryTab } from '$lib/catalogue/library';
	import { untrack } from 'svelte';
	import ListIcon from 'lucide-svelte/icons/list';
	import PlayIcon from 'lucide-svelte/icons/play';
	import HardDriveIcon from 'lucide-svelte/icons/hard-drive';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import CompassIcon from 'lucide-svelte/icons/compass';

	let { data } = $props();

	const name = $derived(data.user.displayName || data.user.username);
	const tabs = $derived(libraryTabsFor(data.owner));
	const counts = $derived<Record<LibraryTab, number | null>>({
		local: data.counts.local,
		watchlist: data.counts.watchlist,
		favorites: data.counts.favorites,
		watched: data.counts.watched,
		stats: null
	});
	const lists = $derived({
		watchlist: data.watchlist,
		favorites: data.favorites,
		watched: data.watched
	});
	const empty: Record<
		Exclude<LibraryTab, 'stats' | 'local'>,
		{ title: string; description: string }
	> = {
		watchlist: {
			title: 'Your watchlist is empty',
			description:
				'Add films from any film page with the Watchlist button; they will wait for you here.'
		},
		favorites: {
			title: 'No favourites yet',
			description: 'Mark the films you love as favourites from their page.'
		},
		watched: {
			title: 'Nothing watched yet',
			description: 'Use Mark watched on a film page to build your history and your stats.'
		}
	};
	// "On this PC" (owner only): the summary line and the Load more links.
	const local = $derived(data.local);
	const summaryLine = $derived.by(() => {
		const summary = data.local?.summary;
		if (!summary) return null;
		const count = (value: number, one: string, many: string) =>
			`${value.toLocaleString('en')} ${value === 1 ? one : many}`;
		return [
			count(summary.films, 'film', 'films'),
			count(summary.shows, 'series', 'series'),
			count(summary.episodes, 'episode', 'episodes')
		].join(' · ');
	});
	function moreHref(kind: 'films' | 'shows'): string {
		const films = (local?.filmPages ?? 1) + (kind === 'films' ? 1 : 0);
		const shows = (local?.showPages ?? 1) + (kind === 'shows' ? 1 : 0);
		return `?tab=local&films=${films}&shows=${shows}`;
	}
	function durationLabel(seconds: number | null): string | null {
		if (!seconds || seconds <= 0) return null;
		const minutes = Math.round(seconds / 60);
		return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
	}
	function qualityOf(resolution: string | null): string | null {
		return resolution === '2160p' ? '4K' : resolution;
	}

	// "Load more" keeps focus on itself; when it goes away with the last page, focus moves to
	// the first title it added instead of falling back to the page.
	let focusFrom: { grid: 'films' | 'shows'; index: number } | null = null;
	$effect(() => {
		const sizes = { films: data.local?.films.length ?? 0, shows: data.local?.shows.length ?? 0 };
		untrack(() => {
			const target = focusFrom;
			focusFrom = null;
			if (!target || target.index >= sizes[target.grid]) return;
			if (document.activeElement && document.activeElement !== document.body) return;
			document
				.querySelectorAll<HTMLAnchorElement>(`#local-${target.grid} li a`)
				[target.index]?.focus();
		});
	});

	const maxGenre = $derived(Math.max(1, ...data.stats.topGenres.map((genre) => genre.count)));
	const maxDecade = $derived(Math.max(1, ...data.stats.decades.map((decade) => decade.count)));
	// Mirrors the local grid: 140 px columns on phones, 180 px from desktop widths.
	const GRID_SIZES = '(min-width: 1024px) 200px, (min-width: 640px) 25vw, 45vw';

	const tiles = $derived([
		{ label: 'Films watched', value: data.stats.watchedCount.toLocaleString('en') },
		{ label: 'Hours watched', value: data.stats.hours.toLocaleString('en') },
		{ label: 'On the watchlist', value: data.counts.watchlist.toLocaleString('en') },
		{ label: 'Favourites', value: data.counts.favorites.toLocaleString('en') }
	]);
</script>

<svelte:head>
	<title>Library | Alan's Database</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="library">
	<header class="head">
		<div>
			<p class="eyebrow">Library</p>
			<h1>{name}'s library</h1>
			<p class="summary">
				{data.counts.watchlist} to watch · {data.counts.watched} watched · {data.counts.favorites}
				favourite{data.counts.favorites === 1 ? '' : 's'}
			</p>
		</div>
		<div class="links">
			<Button href="/my/lists" variant="secondary" size="sm">
				<ListIcon size={16} aria-hidden="true" />
				Lists
			</Button>
			<Button href="/my/settings" variant="ghost" size="sm">
				<SettingsIcon size={16} aria-hidden="true" />
				Settings
			</Button>
		</div>
	</header>

	{#if data.continueWatching.length > 0}
		<!-- Owner only: server progress, so it follows Alan from the phone to the PC. -->
		<section class="continue" aria-labelledby="continue-heading">
			<h2 id="continue-heading">Continue watching</h2>
			<Rail label="Continue watching">
				{#each data.continueWatching as item, index (item.fileId)}
					<ContinueCard {item} eager={index < 2} />
				{/each}
			</Rail>
		</section>
	{/if}

	<nav class="tabs" aria-label="Library sections" data-sveltekit-noscroll data-sveltekit-keepfocus>
		{#each tabs as tab (tab.key)}
			<Chip href={`?tab=${tab.key}`} selected={data.tab === tab.key}>
				{tab.label}
				{#if counts[tab.key] !== null}<span class="count">{counts[tab.key]}</span>{/if}
			</Chip>
		{/each}
	</nav>

	<section class="panel" aria-label={tabs.find((tab) => tab.key === data.tab)?.label}>
		{#if data.tab === 'local'}
			{#if data.localError || !local}
				<EmptyState
					title="The media library is offline"
					description="The PC that holds the films could not be read just now. Try again in a moment."
					compact
				/>
			{:else if local.films.length === 0 && local.shows.length === 0 && local.unmatched.length === 0}
				<EmptyState
					title="Nothing indexed on this PC yet"
					description="Run pnpm library:index on the PC that holds the films; they appear here once scanned."
					compact
				/>
			{:else}
				{#if summaryLine}
					<p class="local-summary">
						<HardDriveIcon size={16} aria-hidden="true" />
						{summaryLine}
					</p>
				{/if}

				{#if local.films.length > 0}
					<section class="local-block" aria-labelledby="local-films-heading">
						<h2 id="local-films-heading">
							Films <span class="count">{local.summary?.films ?? local.films.length}</span>
						</h2>
						<ul class="local-grid" id="local-films">
							{#each local.films as item, index (item.id)}
								<li>
									<PosterCard {...item} eager={index < 6} sizes={GRID_SIZES} />
									{#if item.quality}<span class="local-quality">{item.quality}</span>{/if}
								</li>
							{/each}
						</ul>
						{#if local.moreFilms}
							<a
								class="load-more"
								href={moreHref('films')}
								data-sveltekit-noscroll
								data-sveltekit-keepfocus
								onclick={() => (focusFrom = { grid: 'films', index: local.films.length })}
								>Load more films</a
							>
						{/if}
					</section>
				{/if}

				{#if local.shows.length > 0}
					<section class="local-block" aria-labelledby="local-shows-heading">
						<h2 id="local-shows-heading">
							Series <span class="count">{local.summary?.shows ?? local.shows.length}</span>
						</h2>
						<ul class="local-grid" id="local-shows">
							{#each local.shows as item, index (item.id)}
								<li>
									<PosterCard {...item} eager={index < 6} sizes={GRID_SIZES} />
									<span class="local-quality">
										{[
											item.episodeCount !== null
												? `${item.episodeCount} episode${item.episodeCount === 1 ? '' : 's'}`
												: null,
											item.quality
										]
											.filter(Boolean)
											.join(' · ')}
									</span>
								</li>
							{/each}
						</ul>
						{#if local.moreShows}
							<a
								class="load-more"
								href={moreHref('shows')}
								data-sveltekit-noscroll
								data-sveltekit-keepfocus
								onclick={() => (focusFrom = { grid: 'shows', index: local.shows.length })}
								>Load more series</a
							>
						{/if}
					</section>
				{/if}

				{#if local.unmatched.length > 0}
					<section class="local-block" aria-labelledby="local-unmatched-heading">
						<h2 id="local-unmatched-heading">
							Not identified <span class="count">{local.unmatched.length}</span>
						</h2>
						<p class="local-note">
							The scanner found no catalogue match for these files: recordings, events or names it
							could not read. They are named from the file and still play in Alan's HQP.
						</p>
						<ul class="unmatched">
							{#each local.unmatched as file (file.fileId)}
								<li>
									<a href={`/watch/${file.fileId}`} class="unmatched-row">
										<span class="unmatched-play" aria-hidden="true">
											<PlayIcon size={16} fill="currentColor" />
										</span>
										<span class="unmatched-title">
											{file.title}{file.year ? ` (${file.year})` : ''}
										</span>
										<span class="unmatched-meta">
											{[durationLabel(file.durationSeconds), qualityOf(file.resolution)]
												.filter(Boolean)
												.join(' · ')}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}
		{:else if data.tab === 'stats'}
			<ul class="tiles">
				{#each tiles as tile (tile.label)}
					<li class="tile">
						<span class="tile-label">{tile.label}</span>
						<span class="tile-value">{tile.value}</span>
					</li>
				{/each}
			</ul>

			{#if data.stats.watchedCount === 0}
				<EmptyState
					title="Stats appear as you watch"
					description="Mark films as watched and your genres and decades show up here."
					compact
				/>
			{:else}
				<div class="charts">
					<section aria-labelledby="genres-heading">
						<h2 id="genres-heading">Top genres</h2>
						<ol class="bars">
							{#each data.stats.topGenres as genre (genre.name)}
								<li>
									<span class="bar-label">{genre.name}</span>
									<span class="bar-value">{genre.count}</span>
									<span class="track" aria-hidden="true">
										<span class="fill" style:width={`${(genre.count / maxGenre) * 100}%`}></span>
									</span>
								</li>
							{/each}
						</ol>
					</section>
					<section aria-labelledby="decades-heading">
						<h2 id="decades-heading">Films by decade</h2>
						<ol class="bars">
							{#each data.stats.decades as decade (decade.decade)}
								<li>
									<span class="bar-label">{decade.decade}s</span>
									<span class="bar-value">{decade.count}</span>
									<span class="track" aria-hidden="true">
										<span class="fill" style:width={`${(decade.count / maxDecade) * 100}%`}></span>
									</span>
								</li>
							{/each}
						</ol>
					</section>
				</div>
			{/if}
		{:else if lists[data.tab].length > 0}
			<PosterGrid items={lists[data.tab]} label={`${data.counts[data.tab]} films`} />
		{:else}
			<EmptyState title={empty[data.tab].title} description={empty[data.tab].description}>
				{#snippet action()}
					<Button href="/movies" variant="outline">
						<CompassIcon size={18} aria-hidden="true" />
						Browse movies
					</Button>
				{/snippet}
			</EmptyState>
		{/if}
	</section>
</div>

<style>
	.library {
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-8);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		overflow-wrap: anywhere;
	}
	.summary {
		margin-top: var(--space-2);
		color: var(--content-secondary);
	}
	.links {
		display: flex;
		gap: var(--space-2);
	}
	.tabs {
		display: flex;
		gap: var(--space-2);
		margin: var(--space-6) calc(-1 * var(--page-gutter)) 0;
		padding: 0 var(--page-gutter) var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.count {
		min-width: 1.5rem;
		padding: 0 0.4rem;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		text-align: center;
	}
	.panel {
		margin-top: var(--space-5);
	}
	.continue {
		display: grid;
		gap: var(--space-3);
		margin: var(--space-6) calc(-1 * var(--page-gutter)) 0;
	}
	.continue h2 {
		padding-inline: var(--page-gutter);
		font-size: var(--type-title);
		font-weight: 800;
	}
	.local-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--content-secondary);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.local-summary :global(svg) {
		flex: none;
		color: var(--brand-primary);
	}
	.local-block {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
	.local-block h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--type-title);
		font-weight: 800;
	}
	.local-note {
		max-width: var(--container-reading);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.6;
	}
	.local-grid {
		--min-column: 140px;
		--gap: var(--space-3);
		display: grid;
		/* Two columns even at 320 px: the minimum never exceeds half the row. */
		grid-template-columns: repeat(
			auto-fill,
			minmax(min(var(--min-column), calc((100% - var(--gap)) / 2)), 1fr)
		);
		gap: var(--space-5) var(--gap);
		list-style: none;
	}
	.local-grid li {
		display: grid;
		align-content: start;
		gap: 0.2rem;
		min-width: 0;
	}
	.local-grid :global(.card) {
		--card-width: 100%;
	}
	.local-quality {
		overflow: hidden;
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.load-more {
		justify-self: center;
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		padding: 0 var(--space-6);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
		font-weight: 700;
	}
	.load-more:hover {
		border-color: var(--content-primary);
	}
	.unmatched {
		display: grid;
		gap: var(--space-2);
		list-style: none;
	}
	.unmatched-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.15rem var(--space-3);
		min-height: 3rem;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.unmatched-row:hover {
		border-color: var(--border-strong);
	}
	.unmatched-play {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-full);
		background: var(--content-primary);
		color: var(--content-inverse);
	}
	.unmatched-play :global(svg) {
		margin-left: 2px;
	}
	.unmatched-title {
		overflow: hidden;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unmatched-meta {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	@media (min-width: 768px) {
		.unmatched {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.local-grid {
			--min-column: 180px;
			--gap: var(--space-5);
		}
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
		list-style: none;
	}
	.tile {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.tile-label {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.tile-value {
		font-size: var(--type-headline);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}
	.charts {
		display: grid;
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.charts h2 {
		font-size: var(--type-title);
		font-weight: 800;
	}
	.bars {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
		list-style: none;
	}
	.bars li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem var(--space-3);
	}
	.bar-label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.bar-value {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.track {
		grid-column: 1 / -1;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--brand-muted);
	}
	.fill {
		display: block;
		height: 100%;
		min-width: 8px;
		border-radius: var(--radius-full);
		background: var(--brand-primary);
	}
	@media (min-width: 768px) {
		.tiles {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.charts {
			grid-template-columns: 1fr 1fr;
			gap: var(--space-7);
		}
	}
</style>
