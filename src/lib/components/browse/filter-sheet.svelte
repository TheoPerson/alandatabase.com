<script lang="ts">
	import SlidersIcon from 'lucide-svelte/icons/sliders-horizontal';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Sheet from '$lib/components/ui/sheet';
	import type { BrowseFilters } from '$lib/catalogue/browse';
	import { activeFilterCount, filterGroups, filterSummary } from './filter-groups';

	// The phone version of the Sort, Decade and Rating strip: one compact row whose Filters
	// button opens a bottom sheet with the same link chips the desktop strip shows.
	interface Props {
		filters: BrowseFilters;
	}

	let { filters }: Props = $props();

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
	<div class="groups" data-sveltekit-noscroll data-sveltekit-keepfocus {@attach closeOnChoice}>
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
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.options > :global(.chip) {
		min-height: var(--touch-target);
	}
	@media (max-height: 700px) {
		.compact {
			padding-block: 0;
		}
	}
</style>
