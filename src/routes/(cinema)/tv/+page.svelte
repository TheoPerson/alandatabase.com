<script lang="ts">
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PosterGrid from '$lib/components/browse/poster-grid.svelte';
	import InfoIcon from 'lucide-svelte/icons/info';

	let { data } = $props();

	const genreHref = (genre: string | null) =>
		genre ? `/tv?genre=${encodeURIComponent(genre)}#all-series` : '/tv#all-series';
	const countLine = $derived(
		data.genre
			? `${data.shows.length} ${data.genre.toLowerCase()} series`
			: `All ${data.shows.length} series`
	);
</script>

<svelte:head>
	<title>TV series | Alan's Database</title>
	<meta
		name="description"
		content="The 50 best-rated television series of the IMDb Top TV chart: dramas, comedies, documentaries and animation."
	/>
	<link rel="canonical" href="https://alandatabase.com/tv" />
	{#if data.genre}<meta name="robots" content="noindex,follow" />{/if}
	<meta property="og:title" content="TV series | Alan's Database" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://alandatabase.com/tv" />
</svelte:head>

{#if data.featured.length > 0}
	<HeroCarousel items={data.featured} heading="TV series">
		{#snippet actions(item)}
			<Button href={item.href} size="lg">
				<InfoIcon size={20} aria-hidden="true" />
				Details
			</Button>
		{/snippet}
	</HeroCarousel>

	<Section title="Top 10 series" eyebrow="IMDb Top TV chart">
		<RankedRail label="Top 10 series" items={data.top10} />
	</Section>

	<Section title="All series" id="all-series">
		<nav
			class="genres"
			aria-label="Filter series by genre"
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
		>
			<Chip href={genreHref(null)} selected={data.genre === null}>All</Chip>
			{#each data.genres as genre (genre)}
				<Chip href={genreHref(genre)} selected={data.genre === genre}>{genre}</Chip>
			{/each}
		</nav>
		<p class="count" aria-live="polite">{countLine}</p>
		<div class="grid-wrap">
			<PosterGrid items={data.shows} label={countLine} eagerCount={0} />
		</div>
	</Section>
{:else}
	<div class="empty">
		<EmptyState
			title="No series yet"
			description="The TV chart is empty. Check back after the next catalogue update."
			compact
		/>
	</div>
{/if}

<style>
	.genres {
		display: flex;
		gap: var(--space-2);
		padding-inline: var(--page-gutter);
		padding-bottom: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.genres::-webkit-scrollbar {
		display: none;
	}
	.count {
		padding: var(--space-3) var(--page-gutter) var(--space-4);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.grid-wrap {
		padding-inline: var(--page-gutter);
	}
	.empty {
		padding: calc(var(--top-bar-height) + var(--space-8)) var(--page-gutter) var(--space-7);
	}
</style>
