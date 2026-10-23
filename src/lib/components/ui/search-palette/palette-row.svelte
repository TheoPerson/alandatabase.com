<script lang="ts">
	import { Command } from 'bits-ui';
	import SearchIcon from 'lucide-svelte/icons/search';
	import HistoryIcon from 'lucide-svelte/icons/history';
	import Trash2Icon from 'lucide-svelte/icons/trash-2';
	import RotateCwIcon from 'lucide-svelte/icons/rotate-cw';
	import FilmIcon from 'lucide-svelte/icons/film';
	import HomeIcon from 'lucide-svelte/icons/house';
	import TvIcon from 'lucide-svelte/icons/tv';
	import CompassIcon from 'lucide-svelte/icons/compass';
	import SparklesIcon from 'lucide-svelte/icons/sparkles';
	import LibraryIcon from 'lucide-svelte/icons/library';
	import ActivityIcon from 'lucide-svelte/icons/activity';
	import StarIcon from 'lucide-svelte/icons/star';
	import EnterIcon from 'lucide-svelte/icons/corner-down-left';
	import type { PaletteItem } from '$lib/search/model';
	import PalettePoster from './palette-poster.svelte';

	interface Props {
		item: PaletteItem;
		onselect: (item: PaletteItem) => void;
	}

	let { item, onselect }: Props = $props();

	const PAGE_ICONS: Record<string, typeof HomeIcon> = {
		'/': HomeIcon,
		'/movies': FilmIcon,
		'/tv': TvIcon,
		'/discover': CompassIcon,
		'/cinema/picker': SparklesIcon,
		'/my/films': LibraryIcon,
		'/status': ActivityIcon
	};

	const Icon = $derived.by(() => {
		switch (item.kind) {
			case 'search':
				return SearchIcon;
			case 'recent':
				return HistoryIcon;
			case 'clear':
				return Trash2Icon;
			case 'retry':
				return RotateCwIcon;
			case 'browse':
				return FilmIcon;
			case 'link':
				return PAGE_ICONS[item.href] ?? FilmIcon;
			default:
				return null;
		}
	});
</script>

<Command.Item
	value={item.value}
	class="kit-palette-item"
	data-kind={item.kind === 'movie' && item.hit.type === 'series' ? 'series' : item.kind}
	onSelect={() => onselect(item)}
>
	{#if item.kind === 'movie'}
		<PalettePoster posterPath={item.hit.posterPath} />
		<span class="kit-palette-main">
			<span class="kit-palette-label">{item.label}</span>
			{#if item.hit.year || item.hit.rating}
				<span class="kit-palette-meta">
					{#if item.hit.year}<span>{item.hit.year}</span>{/if}
					{#if item.hit.rating}
						<span class="kit-palette-rating">
							<StarIcon size={12} fill="currentColor" aria-hidden="true" />
							<span class="sr-only">Rated </span>{item.hit.rating}
						</span>
					{/if}
				</span>
			{/if}
		</span>
	{:else if Icon}
		<span class="kit-palette-icon" aria-hidden="true"><Icon size={18} /></span>
		<span class="kit-palette-label">{item.label}</span>
	{/if}
	<span class="kit-palette-enter" aria-hidden="true"><EnterIcon size={16} /></span>
</Command.Item>

<style>
	:global(.kit-palette-item) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--touch-target);
		margin-inline: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		color: var(--content-primary);
		font-size: var(--type-body);
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	:global(.kit-palette-item[data-kind='movie']),
	:global(.kit-palette-item[data-kind='series']) {
		min-height: 4rem;
	}
	/* The active row: a tint plus a brand bar, so it never relies on colour alone. */
	:global(.kit-palette-item[data-selected]) {
		background: var(--surface-interactive);
		box-shadow: inset 3px 0 0 var(--brand-primary);
	}
	:global(.kit-palette-icon) {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 2rem;
		color: var(--content-secondary);
	}
	:global(.kit-palette-item[data-selected] .kit-palette-icon) {
		color: var(--brand-primary);
	}
	:global(.kit-palette-main) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	:global(.kit-palette-label) {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	:global(.kit-palette-main .kit-palette-label) {
		flex: none;
	}
	:global(.kit-palette-meta) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	:global(.kit-palette-rating) {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	:global(.kit-palette-rating svg) {
		color: var(--rating-star);
	}
	:global(.kit-palette-enter) {
		display: none;
		flex: none;
		color: var(--content-secondary);
	}
	/* The Enter hint only helps people with a keyboard. */
	@media (hover: hover) and (pointer: fine) {
		:global(.kit-palette-item[data-selected] .kit-palette-enter) {
			display: inline-flex;
		}
	}
	@media (forced-colors: active) {
		:global(.kit-palette-item[data-selected]) {
			forced-color-adjust: none;
			background: Highlight;
			color: HighlightText;
			outline: 2px solid ButtonText;
			outline-offset: -2px;
		}
		:global(.kit-palette-item[data-selected] *) {
			color: HighlightText;
		}
	}
</style>
