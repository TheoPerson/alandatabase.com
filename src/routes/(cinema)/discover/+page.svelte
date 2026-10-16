<script lang="ts">
	import Button from '$lib/components/ui/button';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import InfoIcon from 'lucide-svelte/icons/info';
	import CompassIcon from 'lucide-svelte/icons/compass';

	let { data } = $props();

	const empty = $derived(!data.pick && data.moods.length === 0 && data.decades.length === 0);
</script>

<svelte:head>
	<title>Discover | Alan's Database</title>
	<meta
		name="description"
		content="Find tonight's film by mood or by decade: a daily pick, mind-bending stories, comfort films, adrenaline and the best of every decade."
	/>
	<link rel="canonical" href="https://alandatabase.com/discover" />
	<meta property="og:title" content="Discover | Alan's Database" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://alandatabase.com/discover" />
</svelte:head>

{#if data.pick}
	<HeroCarousel items={[data.pick]} heading="Discover">
		{#snippet actions(item)}
			<Button href={item.href} size="lg">
				<InfoIcon size={20} aria-hidden="true" />
				Details
			</Button>
			<Button href="/movies" variant="secondary" size="lg">
				<CompassIcon size={20} aria-hidden="true" />
				Browse all
			</Button>
		{/snippet}
	</HeroCarousel>
{:else}
	<header class="page-head">
		<p class="eyebrow">Discover</p>
		<h1>Find tonight's film</h1>
	</header>
{/if}

{#if data.degraded}
	<div class="notice">
		<ErrorState
			title="Some rails could not load"
			description="Part of the catalogue did not answer. What is shown is accurate; reload to try the rest again."
		/>
	</div>
{/if}

{#each data.moods as rail (rail.key)}
	<Section title={rail.title} eyebrow={rail.subtitle} seeAllHref={rail.seeAllHref}>
		<Rail label={rail.title}>
			{#each rail.items as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/each}

{#each data.decades as rail (rail.decade)}
	<Section title={rail.title} eyebrow="Top rated" seeAllHref={rail.seeAllHref}>
		<Rail label={rail.title}>
			{#each rail.items as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/each}

{#if empty && !data.degraded}
	<div class="notice">
		<EmptyState
			title="Nothing to discover yet"
			description="The catalogue is empty. Films appear here after the next catalogue update."
			compact
		/>
	</div>
{/if}

<style>
	.page-head {
		padding: calc(var(--space-7)) var(--page-gutter) var(--space-2);
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
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
	}
	.notice {
		padding: var(--space-6) var(--page-gutter) 0;
	}
</style>
