<script lang="ts">
	import Chip from '$lib/components/ui/chip';
	import {
		DECADES,
		MIN_RATINGS,
		SORT_OPTIONS,
		browseHref,
		type BrowseFilters
	} from '$lib/catalogue/browse';
	import FilterStrip from './filter-strip.svelte';

	interface Props {
		filters: BrowseFilters;
		genres: ReadonlyArray<{ id: number; name: string }>;
	}

	let { filters, genres }: Props = $props();
</script>

<!--
	Every chip is a real link, so filtering works without JavaScript, can be shared and survives a
	reload. The noscroll and keepfocus hints (read from this ancestor) stop a filter change from
	jumping the page or dropping keyboard focus.
-->
<nav class="filter-bar" aria-label="Filter films" data-sveltekit-noscroll data-sveltekit-keepfocus>
	<div class="inner">
		{#if genres.length > 0}
			<FilterStrip selectedKey={String(filters.genreId)} keepSelectedInView>
				<div class="group" role="group" aria-label="Genre">
					<Chip
						href={browseHref({ ...filters, genreId: null })}
						selected={filters.genreId === null}
					>
						All
					</Chip>
					{#each genres as genre (genre.id)}
						<Chip
							href={browseHref({ ...filters, genreId: genre.id })}
							selected={filters.genreId === genre.id}
						>
							{genre.name}
						</Chip>
					{/each}
				</div>
			</FilterStrip>
		{/if}
		<FilterStrip>
			<div class="group" role="group" aria-labelledby="browse-sort-label">
				<span class="label" id="browse-sort-label">Sort</span>
				{#each SORT_OPTIONS as option (option.value)}
					<Chip
						href={browseHref({ ...filters, sortBy: option.value })}
						selected={filters.sortBy === option.value}
					>
						{option.label}
					</Chip>
				{/each}
			</div>
			<span class="divider" aria-hidden="true"></span>
			<div class="group" role="group" aria-labelledby="browse-decade-label">
				<span class="label" id="browse-decade-label">Decade</span>
				<Chip href={browseHref({ ...filters, decade: null })} selected={filters.decade === null}>
					Any
				</Chip>
				{#each DECADES as decade (decade)}
					<Chip href={browseHref({ ...filters, decade })} selected={filters.decade === decade}>
						{decade}s
					</Chip>
				{/each}
			</div>
			<span class="divider" aria-hidden="true"></span>
			<div class="group" role="group" aria-labelledby="browse-rating-label">
				<span class="label" id="browse-rating-label">Rating</span>
				<Chip
					href={browseHref({ ...filters, minRating: null })}
					selected={filters.minRating === null}
				>
					Any
				</Chip>
				{#each MIN_RATINGS as rating (rating)}
					<Chip
						href={browseHref({ ...filters, minRating: rating })}
						selected={filters.minRating === rating}
					>
						{rating}+
					</Chip>
				{/each}
			</div>
		</FilterStrip>
	</div>
</nav>

<style>
	.filter-bar {
		position: sticky;
		top: calc(var(--top-bar-height) + var(--safe-top));
		z-index: calc(var(--z-bar) - 1);
		background: color-mix(in srgb, var(--surface-canvas) 84%, transparent);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		box-shadow: 0 1px 0 var(--border-subtle);
	}
	.inner {
		display: grid;
		/* minmax(0, ...) lets each strip scroll inside itself instead of widening the bar. */
		grid-template-columns: minmax(0, 1fr);
		max-width: var(--container-wide);
		margin-inline: auto;
		padding-block: 2px;
	}
	.group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.group > :global(*) {
		flex: 0 0 auto;
	}
	.label {
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.divider {
		align-self: stretch;
		width: 1px;
		margin-inline: var(--space-2);
		background: var(--border-subtle);
	}
</style>
