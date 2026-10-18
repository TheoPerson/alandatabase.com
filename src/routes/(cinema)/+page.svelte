<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toast';
	import { watchlistLabel, watchlistToast } from '$lib/catalogue/watchlist-copy';
	import { DEFAULT_SORT, browseHref, type BrowseFilters } from '$lib/catalogue/browse';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import ContinueCard from '$lib/components/ui/continue-card';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import InfoIcon from 'lucide-svelte/icons/info';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import CheckIcon from 'lucide-svelte/icons/check';
	import { tmdbImageUrl } from '$lib/tmdb/images';

	let { data } = $props();
	// Social previews use the first featured backdrop when there is one.
	const socialImage = $derived(tmdbImageUrl(data.featured[0]?.backdropPath, 'w1280'));

	const savedIds = $derived(new Set<string>(data.watchlistIds));
	let pending = $state<string | null>(null);

	// Every "see all" and genre chip lands on Browse with the filters it names.
	const everyFilm: BrowseFilters = {
		genreId: null,
		decade: null,
		minRating: null,
		sortBy: DEFAULT_SORT
	};
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
	{#if socialImage}<meta property="og:image" content={socialImage} />{/if}
	<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

{#if data.featured.length > 0}
	<HeroCarousel items={data.featured} heading="Alan's Database: films and series">
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

<!-- Owner only: the loader never reads the library for anyone else, so this stays empty. -->
{#if data.continueWatching.length > 0}
	<Section title="Continue watching" eyebrow="On this PC" seeAllHref="/my/films?tab=local">
		<Rail label="Continue watching">
			{#each data.continueWatching as item, index (item.fileId)}
				<ContinueCard {item} eager={index < 2} />
			{/each}
		</Rail>
	</Section>
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
				<Chip href={browseHref({ ...everyFilm, genreId: genre.id })}>{genre.name}</Chip>
			{/each}
		</div>
	</Section>
{/if}

{#if data.trending.length > 0}
	<Section title="Trending movies" seeAllHref={browseHref(everyFilm)}>
		<Rail label="Trending movies">
			{#each data.trending as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>
{/if}

{#if data.topRated.length > 0}
	<Section title="Top-rated cinema" seeAllHref={browseHref({ ...everyFilm, sortBy: 'rating' })}>
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
