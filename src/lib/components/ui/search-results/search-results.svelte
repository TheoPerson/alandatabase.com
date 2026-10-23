<script lang="ts">
	import { flip } from 'svelte/animate';
	import type { PosterItem } from '$lib/catalogue/items';
	import Chip from '../chip';
	import PosterCard from '../poster-card';
	import ResultsGrid from './results-grid.svelte';
	import { SEARCH_SORT_OPTIONS, sortResults, type SearchSort } from './sort-results';

	interface Props {
		items: PosterItem[];
		// The most the server returns for one search; reaching it means there may be more.
		limit: number;
	}

	let { items, limit }: Props = $props();

	let sort = $state<SearchSort>('relevance');
	const sorted = $derived(sortResults(items, sort));
	const sortLabel = $derived(SEARCH_SORT_OPTIONS.find((option) => option.value === sort)?.label);
	const truncated = $derived(items.length >= limit);

	// Cards glide to their new place when the order changes, unless the visitor asked for calm.
	function glide(): number {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
	}
</script>

{#if items.length > 1}
	<div class="toolbar" role="group" aria-label="Sort results">
		{#each SEARCH_SORT_OPTIONS as option (option.value)}
			<Chip selected={sort === option.value} onclick={() => (sort = option.value)}>
				{option.label}
			</Chip>
		{/each}
	</div>
	<p class="sr-only" aria-live="polite">Sorted by {sortLabel}</p>
{/if}

<ResultsGrid>
	{#each sorted as item, index (item.id)}
		<div class="cell" animate:flip={{ duration: glide }}>
			<PosterCard
				{...item}
				eager={index < 6}
				sizes="(min-width: 1024px) 200px, (min-width: 640px) 20vw, 31vw"
			/>
		</div>
	{/each}
</ResultsGrid>

{#if truncated}
	<p class="note">
		Showing the first {limit} films. Try a more specific title to narrow the results.
	</p>
{/if}

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-5);
	}
	.cell {
		min-width: 0;
	}
	.note {
		margin-top: var(--space-6);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		text-align: center;
	}
</style>
