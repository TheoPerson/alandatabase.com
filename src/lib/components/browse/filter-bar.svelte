<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import Chip from '$lib/components/ui/chip';
	import { browseHref, type BrowseFilters } from '$lib/catalogue/browse';
	import { filterGroups } from './filter-groups';
	import FilterSheet from './filter-sheet.svelte';
	import FilterStrip from './filter-strip.svelte';
	import { nextReveal, type RevealState } from './scroll-reveal';

	interface Props {
		filters: BrowseFilters;
		genres: ReadonlyArray<{ id: number; name: string }>;
		/** Films the current filters match, for the sheet's "Show N films"; null when unknown. */
		total?: number | null;
	}

	let { filters, genres, total = null }: Props = $props();

	// Phones (and phones held sideways) get a Filters button and sheet instead of the long Sort,
	// Decade and Rating strip. The server cannot know the screen, so it renders the strip: phones
	// without JavaScript keep it.
	const compact = new MediaQuery(
		'(max-width: 767.98px), (max-height: 500px) and (orientation: landscape) and (pointer: coarse)',
		false
	);
	const groups = $derived(filterGroups(filters));

	let bar = $state<HTMLElement>();
	let reveal = $state<RevealState>({ hidden: false, anchorY: 0 });

	// The bar tucks away while the visitor reads down the grid and returns on the first scroll up.
	// It stays sticky either way, so nothing below it moves.
	$effect(() => {
		const element = bar;
		if (!element) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			// The bar may tuck away only once the results it sits above have reached it.
			const results = element.nextElementSibling;
			const tuckAfter = results
				? results.getBoundingClientRect().top + window.scrollY - element.offsetHeight
				: Number.POSITIVE_INFINITY;
			reveal = nextReveal(reveal, window.scrollY, Math.max(tuckAfter, 0));
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	});

	// Keyboard focus entering the bar always brings it back into view.
	function show() {
		if (reveal.hidden) reveal = { hidden: false, anchorY: window.scrollY };
	}
</script>

<!--
	Every chip is a real link, so filtering works without JavaScript, can be shared and survives a
	reload. The noscroll and keepfocus hints (read from this ancestor) stop a filter change from
	jumping the page or dropping keyboard focus.
-->
<nav
	bind:this={bar}
	class="filter-bar"
	class:tucked={reveal.hidden}
	aria-label="Filter films"
	data-sveltekit-noscroll
	data-sveltekit-keepfocus
	onfocusin={show}
>
	<div class="inner" class:compact={compact.current}>
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
		{#if compact.current}
			<FilterSheet {filters} {total} />
		{:else}
			<FilterStrip>
				{#each groups as group, index (group.key)}
					{#if index > 0}<span class="divider" aria-hidden="true"></span>{/if}
					<div class="group" role="group" aria-labelledby="browse-{group.key}-label">
						<span class="label" id="browse-{group.key}-label">{group.label}</span>
						{#each group.options as option (option.href)}
							<Chip href={option.href} selected={option.selected}>{option.label}</Chip>
						{/each}
					</div>
				{/each}
			</FilterStrip>
		{/if}
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
		transition:
			transform var(--duration-slow) var(--ease-out),
			opacity var(--duration-base) var(--ease-out);
	}
	/* Slides up under the top bar; still in the tab order, and focus brings it back. */
	.tucked {
		transform: translateY(calc(-100% - 1px));
		opacity: 0;
		pointer-events: none;
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
	@media (max-height: 700px) {
		.inner {
			padding-block: 0;
		}
	}
	/* Landscape phones: one row. The genre strip scrolls on the left, Filters sits on the right,
	   and before hydration the two strips share the row, so nothing moves when it swaps. */
	@media (max-height: 500px) and (orientation: landscape) and (pointer: coarse) {
		.inner {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.inner.compact {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
	.divider {
		align-self: stretch;
		width: 1px;
		margin-inline: var(--space-2);
		background: var(--border-subtle);
	}
</style>
