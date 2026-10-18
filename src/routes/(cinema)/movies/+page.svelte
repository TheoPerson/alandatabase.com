<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import Button from '$lib/components/ui/button';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import FilterBar from '$lib/components/browse/filter-bar.svelte';
	import PosterGrid from '$lib/components/browse/poster-grid.svelte';
	import {
		addedAnnouncement,
		browseTarget,
		countLine,
		fold,
		type ShownFilms
	} from '$lib/components/browse/browse-state';
	import {
		BROWSE_PATH,
		browseHref,
		describeFilters,
		filterKey,
		hasActiveFilters
	} from '$lib/catalogue/browse';
	import type { PosterItem } from '$lib/catalogue/items';

	let { data } = $props();

	// How long a filter change may take before the old films give way to skeletons. A local read
	// answers faster, and swapping twice in a blink would flicker.
	const SKELETON_DELAY_MS = 120;
	const LOAD_MORE_PLACEHOLDERS = 6;

	const filters = $derived(data.filters);
	const key = $derived(filterKey(data.filters));
	const active = $derived(hasActiveFilters(data.filters));

	function incoming() {
		return { key: filterKey(data.filters), page: data.pagination.page, items: data.items };
	}

	// What is on screen: the page in the address, plus any pages "Load more" folded in.
	let shown = $state.raw<ShownFilms<PosterItem>>(untrack(() => fold(null, incoming()).shown));
	let announcement = $state('');
	let results = $state<HTMLElement>();
	// Set when the visitor used a paging link, so focus can be rescued if that link goes away.
	let paging = false;
	let focusIndex: number | null = null;

	$effect.pre(() => {
		const next = incoming();
		const failed = data.unavailable;
		const totalCount = data.pagination.totalCount;
		untrack(() => {
			// A failed "Load more" keeps the films already shown; the inline error offers a retry.
			if (failed && shown.items.length > 0 && shown.key === next.key) {
				paging = false;
				return;
			}
			const before = shown.items.length;
			const result = fold(shown, next);
			shown = result.shown;
			if (result.added > 0) {
				announcement = addedAnnouncement(result.added);
				if (paging) focusIndex = result.direction === 'prepend' ? 0 : before;
			}
			paging = false;
		});
	});

	// When "Load more" (or "Show earlier films") disappears with the last page, keyboard focus
	// would fall to the page; it moves to the first film that was just added instead.
	$effect(() => {
		void shown;
		if (focusIndex === null) return;
		const index = focusIndex;
		focusIndex = null;
		if (document.activeElement && document.activeElement !== document.body) return;
		results?.querySelectorAll<HTMLAnchorElement>('ul a.card')[index]?.focus();
	});

	const target = $derived(navigating.to ? browseTarget(data.filters, navigating.to.url) : null);
	const filtering = $derived(target !== null && !target.sameFilters);
	const loadingMore = $derived(target !== null && target.sameFilters && target.page > shown.page);

	let delayElapsed = $state(false);
	$effect(() => {
		if (!filtering) {
			delayElapsed = false;
			return;
		}
		const timer = setTimeout(() => (delayElapsed = true), SKELETON_DELAY_MS);
		return () => clearTimeout(timer);
	});
	const showSkeletons = $derived(filtering && delayElapsed);

	const genreName = $derived(data.genres.find((genre) => genre.id === data.filters.genreId)?.name);
	const summary = $derived(describeFilters(data.filters, genreName));
	const loadFailed = $derived(data.unavailable && shown.items.length > 0 && shown.key === key);
	const count = $derived.by(() => {
		if (loadFailed) return 'Some films could not be loaded';
		if (data.unavailable) return 'The catalogue is unavailable';
		return countLine({
			shownCount: shown.items.length,
			totalCount: data.pagination.totalCount,
			firstPage: shown.firstPage,
			pageSize: data.pagination.pageSize,
			summary,
			filtered: active
		});
	});
	const progress = $derived(
		countLine({
			shownCount: shown.items.length,
			totalCount: data.pagination.totalCount,
			firstPage: shown.firstPage,
			pageSize: data.pagination.pageSize,
			summary: ''
		})
	);
	const hasMore = $derived(shown.page < data.pagination.totalPages);
	// The empty state carries its own "Clear filters", so the header does not repeat it.
	const empty = $derived(!data.unavailable && shown.items.length === 0);
	const noindex = $derived(active || data.pagination.page > 1);

	function markPaging() {
		paging = true;
	}

	function focusFirstFilter() {
		// The clear link vanishes once the filters are gone; keep keyboard focus in the filter bar.
		queueMicrotask(() =>
			document.querySelector<HTMLAnchorElement>('nav[aria-label="Filter films"] a')?.focus()
		);
	}

	// Back from a film returns to the films that were on screen, not just the page in the address.
	// Back from a film restores every loaded film. SvelteKit applies the saved scroll position while
	// only the last page is rendered, so the position is re-applied once the full grid is back.
	type BrowseSnapshot = ShownFilms<PosterItem> & { scrollY?: number };
	export const snapshot = {
		capture: (): BrowseSnapshot => ({ ...shown, scrollY: window.scrollY }),
		restore: (value: BrowseSnapshot | null) => {
			const page = data.pagination.page;
			if (value && value.key === key && page >= value.firstPage && page <= value.page) {
				const { scrollY, ...films } = value;
				shown = films;
				if (typeof scrollY === 'number') {
					tick().then(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
				}
			}
		}
	};
</script>

<svelte:head>
	<title>Browse movies | Alan's Database</title>
	<meta
		name="description"
		content="Browse every film in the catalogue by genre, decade and rating, sorted by popularity, rating or release date."
	/>
	<link rel="canonical" href="https://alandatabase.com{BROWSE_PATH}" />
	{#if noindex}<meta name="robots" content="noindex, follow" />{/if}
	<meta property="og:title" content="Browse movies | Alan's Database" />
	<meta
		property="og:description"
		content="Browse every film in the catalogue by genre, decade and rating."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://alandatabase.com{BROWSE_PATH}" />
</svelte:head>

<div class="browse">
	<header class="header">
		<p class="eyebrow">Browse</p>
		<h1>Movies</h1>
		<div class="summary" data-sveltekit-noscroll data-sveltekit-keepfocus>
			<p class="count" aria-live="polite" aria-atomic="true">{count}</p>
			{#if active && !empty}
				<Button href={BROWSE_PATH} variant="ghost" onclick={focusFirstFilter}>Clear filters</Button>
			{/if}
		</div>
	</header>

	<FilterBar
		{filters}
		genres={data.genres}
		total={data.unavailable ? null : data.pagination.totalCount}
	/>

	<section
		bind:this={results}
		class="results"
		aria-labelledby="browse-results-heading"
		aria-busy={filtering || loadingMore}
	>
		<h2 class="sr-only" id="browse-results-heading">Results</h2>
		<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

		{#if showSkeletons}
			<PosterGrid items={[]} placeholders={data.pagination.pageSize} label="Loading films" />
		{:else if data.unavailable && !loadFailed}
			<div class="state">
				<ErrorState
					title="The catalogue is unavailable"
					description="The films could not be read just now. Your filters are kept, so trying again picks up where you were."
				>
					{#snippet action()}
						<!-- A full reload guarantees a fresh read, with or without JavaScript. -->
						<Button
							href={browseHref(filters, data.pagination.page)}
							variant="outline"
							data-sveltekit-reload
						>
							Try again
						</Button>
					{/snippet}
				</ErrorState>
			</div>
		{:else if shown.items.length === 0}
			<div class="state">
				<EmptyState
					title={active ? 'No films match these filters' : 'No films in the catalogue yet'}
					description={active
						? 'Try another genre, decade or rating, or start again from every film.'
						: 'Run the metadata sync (pnpm --dir worker ingest:popular) to fill the catalogue.'}
				>
					{#snippet action()}
						{#if active}
							<span data-sveltekit-noscroll data-sveltekit-keepfocus>
								<Button href={BROWSE_PATH} variant="outline" onclick={focusFirstFilter}
									>Clear filters</Button
								>
							</span>
						{/if}
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			{#if shown.firstPage > 1}
				<div class="paging earlier">
					<Button
						href={browseHref(filters, shown.firstPage - 1)}
						variant="outline"
						size="sm"
						onclick={markPaging}
						data-sveltekit-noscroll
						data-sveltekit-keepfocus
						data-sveltekit-replacestate
					>
						Show earlier films
					</Button>
				</div>
			{/if}

			<div class="films" class:dimmed={filtering}>
				<PosterGrid
					items={shown.items}
					placeholders={loadingMore ? LOAD_MORE_PLACEHOLDERS : 0}
					label="Films"
				/>
			</div>

			{#if loadFailed}
				<div class="state">
					<ErrorState
						title="More films could not be loaded"
						description="The catalogue did not answer. The films above are still here."
					>
						{#snippet action()}
							<Button variant="outline" onclick={() => invalidateAll()}>Try again</Button>
						{/snippet}
					</ErrorState>
				</div>
			{:else if hasMore}
				<div class="paging more">
					<Button
						href={browseHref(filters, shown.page + 1)}
						variant="outline"
						size="lg"
						loading={loadingMore}
						onclick={markPaging}
						data-sveltekit-noscroll
						data-sveltekit-keepfocus
						data-sveltekit-replacestate
					>
						{#if loadingMore}<span class="spinner" aria-hidden="true"></span>{/if}
						Load more
					</Button>
					<p class="progress" aria-hidden="true">{progress}</p>
				</div>
			{:else if data.pagination.totalPages > 1}
				<p class="end">That is every film for these filters.</p>
			{/if}
		{/if}
	</section>
</div>

<style>
	.header {
		max-width: var(--container-wide);
		margin-inline: auto;
		padding: var(--space-6) var(--page-gutter) var(--space-3);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		font-size: var(--type-headline);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		/* Reserved so the clear link appearing never moves the filters. */
		min-height: var(--touch-target);
		margin-top: var(--space-1);
	}
	.count {
		min-width: 0;
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	/* Landscape phones: title and count share one short row above the filters. */
	@media (max-height: 500px) and (orientation: landscape) {
		.header {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			padding-block: var(--space-2) 0;
		}
		.eyebrow {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		h1 {
			flex: none;
			font-size: var(--type-title);
		}
		.summary {
			flex: 1;
			min-width: 0;
			margin-top: 0;
		}
		.count {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
	.results {
		padding-block: var(--space-5) var(--space-7);
	}
	.state {
		max-width: var(--container-wide);
		margin-inline: auto;
		padding-inline: var(--page-gutter);
	}
	.films {
		transition: opacity var(--duration-base) var(--ease-out);
	}
	.dimmed {
		opacity: 0.55;
		pointer-events: none;
	}
	.paging {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		max-width: var(--container-wide);
		margin-inline: auto;
		padding-inline: var(--page-gutter);
	}
	.earlier {
		margin-bottom: var(--space-4);
	}
	.more {
		margin-top: var(--space-6);
	}
	.progress,
	.end {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.end {
		margin-top: var(--space-6);
		text-align: center;
	}
	.spinner {
		width: 1em;
		height: 1em;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
