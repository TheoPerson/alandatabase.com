<script lang="ts">
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PosterGrid from '$lib/components/browse/poster-grid.svelte';
	import { LIBRARY_TABS, type LibraryTab } from '$lib/catalogue/library';
	import ListIcon from 'lucide-svelte/icons/list';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import CompassIcon from 'lucide-svelte/icons/compass';

	let { data } = $props();

	const name = $derived(data.user.displayName || data.user.username);
	const counts = $derived<Record<LibraryTab, number | null>>({
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
	const empty: Record<Exclude<LibraryTab, 'stats'>, { title: string; description: string }> = {
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
	const maxGenre = $derived(Math.max(1, ...data.stats.topGenres.map((genre) => genre.count)));
	const maxDecade = $derived(Math.max(1, ...data.stats.decades.map((decade) => decade.count)));
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

	<nav class="tabs" aria-label="Library sections" data-sveltekit-noscroll data-sveltekit-keepfocus>
		{#each LIBRARY_TABS as tab (tab.key)}
			<Chip href={`?tab=${tab.key}`} selected={data.tab === tab.key}>
				{tab.label}
				{#if counts[tab.key] !== null}<span class="count">{counts[tab.key]}</span>{/if}
			</Chip>
		{/each}
	</nav>

	<section class="panel" aria-label={LIBRARY_TABS.find((tab) => tab.key === data.tab)?.label}>
		{#if data.tab === 'stats'}
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
