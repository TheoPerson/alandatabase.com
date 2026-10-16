<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { browseHref, DEFAULT_SORT } from '$lib/catalogue/browse';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import PosterCard from '$lib/components/ui/poster-card';
	import SearchInput from '$lib/components/ui/search-input';
	import { ResultsGrid, ResultsSkeleton, SearchResults } from '$lib/components/ui/search-results';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';

	let { data } = $props();

	// Follows the loaded query (the header search and the palette navigate here too), and
	// lets the visitor type freely in between.
	let value = $derived(data.query);

	const searching = $derived(navigating.to?.url.pathname === '/search');
	// A search that answers within a blink should not flash a skeleton.
	let showPending = $state(false);
	$effect(() => {
		if (!searching) {
			showPending = false;
			return;
		}
		const timer = setTimeout(() => (showPending = true), 150);
		return () => clearTimeout(timer);
	});

	const resultCount = $derived(data.results.length);
	const status = $derived.by(() => {
		if (searching) return 'Searching…';
		if (!data.query) return 'Find a film or a series by its title.';
		if (data.searchError) return '';
		const films = `${resultCount} ${resultCount === 1 ? 'film' : 'films'}`;
		return data.series.length ? `${films} · ${data.series.length} series` : films;
	});
	const heading = $derived(data.query ? `Results for “${data.query}”` : 'Search');
	const pageTitle = $derived(
		data.query ? `Results for ${data.query} | Alan's Database` : "Search | Alan's Database"
	);

	function genreHref(genreId: number): string {
		return browseHref({ genreId, decade: null, minRating: null, sortBy: DEFAULT_SORT });
	}

	let retrying = $state(false);
	async function retry(event: MouseEvent) {
		// Re-runs the loader in place; the plain link (same address) covers a missing script.
		event.preventDefault();
		retrying = true;
		try {
			await invalidateAll();
		} finally {
			retrying = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content="Search the Alan's Database catalogue by film title." />
	<meta name="robots" content="noindex,follow" />
	<link rel="canonical" href="https://alandatabase.com/search" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="page">
	<header class="head">
		<h1 class="title">{heading}</h1>
		<p class="status" aria-live="polite" aria-atomic="true">{status}</p>

		<form
			class="main-search-form"
			action="/search"
			method="get"
			role="search"
			aria-label="Search films"
			data-sveltekit-keepfocus
		>
			<div class="field">
				<SearchInput
					name="q"
					label="Movie title"
					placeholder="Search films"
					maxlength={120}
					autofocus={!data.query}
					bind:value
				/>
			</div>
			<Button type="submit" size="lg">Search</Button>
		</form>
	</header>

	{#if data.query || showPending}
		<section class="results" aria-labelledby="results-heading" aria-busy={searching}>
			<h2 id="results-heading" class="sr-only">Search results</h2>
			{#if showPending}
				<ResultsSkeleton />
			{:else if data.searchError}
				<ErrorState
					title="Search is temporarily unavailable"
					description="The catalogue could not be searched just now. Nothing was changed, so you can safely try again."
				>
					{#snippet action()}
						<Button
							href={`${page.url.pathname}${page.url.search}`}
							variant="outline"
							loading={retrying}
							onclick={retry}>Try again</Button
						>
					{/snippet}
				</ErrorState>
			{:else if data.results.length === 0 && data.series.length === 0}
				<EmptyState
					title={`Nothing matches “${data.query}”`}
					description="Search covers film titles and the TV chart. Try a shorter or more general title, or browse."
				>
					{#snippet action()}
						<Button href="/movies" variant="outline">Browse movies</Button>
						<Button href="/tv" variant="ghost">Browse series</Button>
					{/snippet}
				</EmptyState>
			{:else}
				{#if data.results.length > 0}
					{#key data.query}
						<SearchResults items={data.results} limit={data.limit} />
					{/key}
				{/if}
				{#if data.series.length > 0}
					<section class="series" aria-labelledby="series-heading">
						<h2 id="series-heading">Series</h2>
						<ResultsGrid>
							{#each data.series as item (item.id)}
								<div class="cell">
									<PosterCard
										{...item}
										sizes="(min-width: 1024px) 200px, (min-width: 640px) 22vw, 46vw"
									/>
								</div>
							{/each}
						</ResultsGrid>
					</section>
				{/if}
			{/if}
		</section>
	{:else}
		{#if data.trending.length > 0}
			<Section title="Popular right now" eyebrow="Trending" seeAllHref="/movies">
				<div class="grid-pad">
					<ResultsGrid>
						{#each data.trending as item, index (item.id)}
							<div class="cell">
								<PosterCard
									{...item}
									eager={index < 6}
									sizes="(min-width: 1024px) 200px, (min-width: 640px) 22vw, 46vw"
								/>
							</div>
						{/each}
					</ResultsGrid>
				</div>
			</Section>
		{/if}

		{#if data.genres.length > 0}
			<Section title="Browse by genre" eyebrow="Discover">
				<div class="genres">
					{#each data.genres as genre (genre.id)}
						<Chip href={genreHref(genre.id)}>{genre.name}</Chip>
					{/each}
				</div>
			</Section>
		{/if}
	{/if}
</div>

<style>
	.series {
		margin-top: var(--space-7);
	}
	.series h2 {
		margin-bottom: var(--space-4);
		font-size: var(--type-title);
		font-weight: 800;
	}
	.page {
		max-width: var(--container-wide);
		margin-inline: auto;
		padding-bottom: var(--space-8);
	}
	.head {
		display: grid;
		/* A bare column would grow to the form's intrinsic width and push the page sideways. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding: var(--space-6) var(--page-gutter) var(--space-2);
	}
	.title {
		font-size: var(--type-headline);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.status {
		min-height: 1.5em;
		color: var(--content-secondary);
		font-size: var(--text-md);
	}
	.main-search-form {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		max-width: 44rem;
		margin-top: var(--space-3);
	}
	.field {
		flex: 1;
		min-width: 0;
	}
	.results,
	.grid-pad {
		padding: var(--space-5) var(--page-gutter) 0;
	}
	.grid-pad {
		padding-top: 0;
	}
	.cell {
		min-width: 0;
	}
	.genres {
		display: flex;
		gap: var(--space-2);
		/* Room for the focus ring, which a scrolling row would otherwise clip. */
		margin-block: -0.4rem;
		padding: 0.4rem var(--page-gutter);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.genres::-webkit-scrollbar {
		display: none;
	}
	@media (min-width: 768px) {
		.genres {
			flex-wrap: wrap;
			overflow: visible;
		}
	}
</style>
