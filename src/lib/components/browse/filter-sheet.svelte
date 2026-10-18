<script lang="ts">
	import SlidersIcon from 'lucide-svelte/icons/sliders-horizontal';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Sheet from '$lib/components/ui/sheet';
	import type { BrowseFilters } from '$lib/catalogue/browse';
	import {
		activeFilterCount,
		filterGroups,
		filterSummary,
		resetFiltersHref,
		showResultsLabel
	} from './filter-groups';

	// The phone version of the Sort, Decade and Rating strip: one compact row whose Filters
	// button opens a bottom sheet with the same link chips the desktop strip shows.
	interface Props {
		filters: BrowseFilters;
		total?: number | null;
	}

	let { filters, total = null }: Props = $props();

	let open = $state(false);
	let detent = $state<'medium' | 'large'>('large');

	const groups = $derived(filterGroups(filters));
	const active = $derived(activeFilterCount(filters));
	const summary = $derived(filterSummary(filters));

	function openSheet(event: MouseEvent) {
		// Safari does not focus a tapped button; focusing it lets the sheet hand focus back to it.
		(event.currentTarget as HTMLElement).focus();
		detent = 'large';
		open = true;
	}

	// A chosen chip navigates as a normal link, then the sheet closes and focus returns to the
	// Filters button. Closing waits for the click to finish so SvelteKit still sees the link.
	function closeOnChoice(node: HTMLElement) {
		const onclick = (event: MouseEvent) => {
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			if (!(event.target as Element).closest('a[href]')) return;
			setTimeout(() => (open = false));
		};
		node.addEventListener('click', onclick);
		return () => node.removeEventListener('click', onclick);
	}
</script>

<div class="compact">
	<Button
		variant="secondary"
		size="sm"
		class="filters-trigger"
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-describedby="browse-filters-summary"
		onclick={openSheet}
	>
		<SlidersIcon size={16} aria-hidden="true" />
		<!-- Expressions keep the spaces Svelte would trim at the edge of an element. -->
		<span
			>Filters{#if active > 0}<span class="active-count">{` · ${active}`}</span><span
					class="sr-only">&nbsp;active</span
				>{/if}</span
		>
	</Button>
	<p class="summary" id="browse-filters-summary">{summary}</p>
</div>

<!-- The sheet is as tall as its three groups, up to the kit's large height. -->
<Sheet bind:open bind:detent label="Filters" class="browse-filter-sheet">
	<!-- The sheet is portalled out of the filter bar, so it repeats the bar's navigation hints. -->
	<div class="content" data-sveltekit-noscroll data-sveltekit-keepfocus {@attach closeOnChoice}>
		<div class="groups">
			{#each groups as group (group.key)}
				<div class="group" role="group" aria-labelledby="browse-sheet-{group.key}-label">
					<h3 class="label" id="browse-sheet-{group.key}-label">{group.label}</h3>
					<div class="options">
						{#each group.options as option (option.href)}
							<Chip href={option.href} selected={option.selected}>{option.label}</Chip>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<!-- Every chip applies at once; these confirm what the filters show, or undo them. -->
		<div class="actions">
			<Button href={resetFiltersHref(filters)} variant="outline" size="lg" disabled={active === 0}
				>Reset</Button
			>
			<Button variant="primary" size="lg" onclick={() => (open = false)}
				>{showResultsLabel(total)}</Button
			>
		</div>
	</div>
</Sheet>

<style>
	.compact {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		/* 44px button + 3px each side matches the strip it replaces, so hydration does not shift. */
		padding: 3px var(--page-gutter);
	}
	/* Landscape phones: the button sits at the end of the genre row; the summary is still read
	   out as its description. */
	@media (max-height: 500px) and (orientation: landscape) and (pointer: coarse) {
		.compact {
			padding-left: var(--space-2);
		}
		.summary {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
	/* Touch chips are 44px, so the strip is 4px taller: so is this row. */
	@media (pointer: coarse) {
		.compact {
			padding-block: 5px;
		}
	}
	.compact :global(.filters-trigger) {
		flex: 0 0 auto;
		min-height: var(--touch-target);
	}
	.active-count {
		color: var(--brand-primary);
	}
	.summary {
		display: -webkit-box;
		flex: 1 1 auto;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		color: var(--content-secondary);
		font-size: var(--text-xs);
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	:global(.kit-sheet.bottom.large.browse-filter-sheet) {
		height: auto;
	}
	.groups {
		display: grid;
		gap: var(--space-5);
	}
	.group {
		display: grid;
		gap: var(--space-2);
	}
	.label {
		margin: 0;
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	/* Even columns, so the decades line up instead of wrapping to a ragged second row. */
	.options {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.group:first-child .options {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.options > :global(.chip) {
		justify-content: center;
		min-height: var(--touch-target);
		padding-inline: var(--space-2);
	}
	/* The sheet is exactly as tall as its content, so there is nothing to resize: the grabber
	   row goes, and the title and close button share the first row. */
	:global(.kit-sheet.bottom.browse-filter-sheet .grabber) {
		display: none;
	}
	:global(.kit-sheet.bottom.browse-filter-sheet .kit-sheet-title) {
		display: flex;
		align-items: center;
		min-height: var(--touch-target);
	}
	:global(.kit-sheet.bottom.browse-filter-sheet .kit-sheet-close) {
		top: var(--space-3);
	}
	/* The action row ends the sheet; below it there is only the home-indicator inset. */
	:global(.kit-sheet.bottom.browse-filter-sheet .body) {
		padding-bottom: 0;
	}
	/* Pinned to the bottom of the sheet when its groups scroll. */
	.actions {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: var(--space-2);
		margin: var(--space-5) calc(-1 * var(--space-5)) 0;
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-overlay);
	}
	@media (max-height: 700px) {
		.compact {
			padding-block: 0;
		}
	}
</style>
