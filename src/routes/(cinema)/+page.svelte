<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toast';
	import { watchlistLabel, watchlistToast } from '$lib/catalogue/watchlist-copy';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import InfoIcon from 'lucide-svelte/icons/info';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import CheckIcon from 'lucide-svelte/icons/check';

	let { data } = $props();

	const savedIds = $derived(new Set<string>(data.watchlistIds));
	let pending = $state<string | null>(null);
</script>

<svelte:head>
	<title>Alan's Database — Films, series and your personal cinema</title>
	<meta
		name="description"
		content="A premium personal cinema: browse films and series, track what you watch, and find what to watch tonight."
	/>
	<link rel="canonical" href="https://alandatabase.com/" />
	<meta property="og:title" content="Alan's Database" />
	<meta property="og:description" content="Films, series and your personal cinema." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://alandatabase.com/" />
</svelte:head>

{#if data.featured.length > 0}
	<HeroCarousel items={data.featured}>
		{#snippet actions(item)}
			{@const saved = savedIds.has(item.id)}
			<Button href={item.href} size="lg">
				<InfoIcon size={20} aria-hidden="true" />
				Details
			</Button>
			{#if data.user}
				<form
					method="POST"
					action="?/toggleWatchlist"
					use:enhance={() => {
						pending = item.id;
						return async ({ result, update }) => {
							await update({ reset: false });
							pending = null;
							addToast(
								watchlistToast(item.title, result),
								result.type === 'success' ? 'success' : 'error'
							);
						};
					}}
				>
					<input type="hidden" name="movieId" value={item.id} />
					<Button
						type="submit"
						variant={saved ? 'outline' : 'secondary'}
						size="lg"
						loading={pending === item.id}
						aria-pressed={saved}
					>
						{#if saved}
							<CheckIcon size={20} aria-hidden="true" />
						{:else}
							<PlusIcon size={20} aria-hidden="true" />
						{/if}
						{watchlistLabel(saved)}
					</Button>
				</form>
			{:else}
				<Button href="/auth/login?returnTo=%2F" variant="secondary" size="lg">
					<PlusIcon size={20} aria-hidden="true" />
					Watchlist
				</Button>
			{/if}
		{/snippet}
	</HeroCarousel>
{:else}
	<div class="hero-state">
		{#if data.error}
			<ErrorState
				title="The catalogue is unavailable"
				description="The database could not be reached. The public status page has the latest service information."
			>
				{#snippet action()}
					<a class="state-link" href="/status">Open system status</a>
				{/snippet}
			</ErrorState>
		{:else}
			<EmptyState
				title="No published movies yet"
				description="Run the metadata sync (pnpm --dir worker ingest:popular) to fill the catalogue."
				compact
			/>
		{/if}
	</div>
{/if}

{#if data.top10.length > 0}
	<Section title="Top 10 today" eyebrow="Trending now" seeAllHref="/movies">
		<RankedRail label="Top 10 today" items={data.top10} />
	</Section>
{/if}

{#if data.watchlist.length > 0}
	<Section title="Your watchlist" eyebrow="Keep going" seeAllHref="/my/films">
		<Rail label="Your watchlist">
			{#each data.watchlist as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.genres.length > 0}
	<Section title="Browse by genre" eyebrow="Discover">
		<div class="genres">
			{#each data.genres as genre (genre.id)}
				<Chip href={`/movies/catalog?genre=${genre.id}`}>{genre.name}</Chip>
			{/each}
		</div>
	</Section>
{/if}

{#if data.trending.length > 0}
	<Section title="Trending movies" seeAllHref="/movies/catalog">
		<Rail label="Trending movies">
			{#each data.trending as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.topRated.length > 0}
	<Section title="Top-rated cinema" seeAllHref="/movies/catalog?sort=rating">
		<Rail label="Top-rated cinema">
			{#each data.topRated as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.tv.length > 0}
	<Section title="Landmark series" eyebrow="Television" seeAllHref="/tv">
		<Rail label="Landmark series">
			{#each data.tv as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

<style>
	.hero-state {
		padding: calc(var(--top-bar-height) + var(--space-8)) var(--page-gutter) var(--space-7);
	}
	.state-link {
		color: var(--brand-primary);
		font-weight: 700;
	}
	.genres {
		display: flex;
		gap: var(--space-2);
		padding-inline: var(--page-gutter);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.genres::-webkit-scrollbar {
		display: none;
	}
</style>
