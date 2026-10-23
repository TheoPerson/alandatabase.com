<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Sheet from '$lib/components/ui/sheet';
	import SlidersIcon from 'lucide-svelte/icons/sliders-horizontal';
	import type { PickerFilters, PickerPreset, RecommendationMode } from '$lib/picker/types';

	interface Props {
		activeFilters: PickerFilters;
		activePreset: PickerPreset | null;
		allGenres: string[];
		onFilterChange: (filters: PickerFilters) => void;
		onPresetSelect: (preset: PickerPreset) => void;
	}

	let { activeFilters, activePreset, allGenres, onFilterChange, onPresetSelect }: Props = $props();

	const PRESETS: Array<{ id: PickerPreset; label: string }> = [
		{ id: 'TONIGHT', label: 'Tonight' },
		{ id: 'HIGHLY_RATED', label: 'Rated 8+' },
		{ id: 'CRIME', label: 'Crime' },
		{ id: 'THRILLER', label: 'Thriller' },
		{ id: 'HIDDEN_GEM', label: 'Hidden gem' },
		{ id: 'CLASSIC', label: 'Classic' },
		{ id: 'SHORT', label: 'Under 2 hours' }
	];

	const MODES: Array<{ id: RecommendationMode; label: string }> = [
		{ id: 'balanced', label: 'Balanced' },
		{ id: 'safe', label: 'Safe bets' },
		{ id: 'discovery', label: 'Discovery' }
	];

	const ERAS = [
		{ id: 'all', label: 'Any year' },
		{ id: '1990+', label: '1990+' },
		{ id: '2000+', label: '2000+' },
		{ id: '2010+', label: '2010+' },
		{ id: '2020+', label: '2020+' },
		{ id: 'classic', label: '1950–1989' }
	] as const;

	const RATINGS = [7.0, 7.5, 8.0, 8.5];

	const RUNTIMES: Array<{ val: number | undefined; label: string }> = [
		{ val: undefined, label: 'Any length' },
		{ val: 100, label: 'Under 100 min' },
		{ val: 120, label: 'Under 2 h' },
		{ val: 150, label: 'Under 2.5 h' }
	];

	const DEFAULT_FILTERS: PickerFilters = {
		era: '1990+',
		minYear: 1990,
		minRating: 7.0,
		mode: 'balanced',
		genres: []
	};

	const wide = new MediaQuery('(min-width: 1024px)');

	let open = $state(false);
	// The sheet edits a draft; one request is sent when it is applied.
	let draft = $state<PickerFilters>({ ...DEFAULT_FILTERS });

	function openSheet() {
		draft = { ...activeFilters, genres: [...(activeFilters.genres ?? [])] };
		open = true;
	}

	function toggleGenre(genre: string) {
		const current = draft.genres ?? [];
		draft.genres = current.includes(genre)
			? current.filter((g) => g !== genre)
			: [...current, genre];
	}

	function setEra(era: (typeof ERAS)[number]['id']) {
		let minYear: number | undefined;
		let maxYear: number | undefined;
		if (era === '1990+') minYear = 1990;
		else if (era === '2000+') minYear = 2000;
		else if (era === '2010+') minYear = 2010;
		else if (era === '2020+') minYear = 2020;
		else if (era === 'classic') {
			minYear = 1950;
			maxYear = 1989;
		}
		draft = { ...draft, era, minYear, maxYear };
	}

	function setRating(minRating: number) {
		draft.minRating = draft.minRating === minRating ? undefined : minRating;
	}

	function apply() {
		open = false;
		onFilterChange({ ...draft });
	}

	function reset() {
		draft = { ...DEFAULT_FILTERS, genres: [] };
	}

	const activeCustomCount = $derived(
		(activeFilters.genres && activeFilters.genres.length > 0 ? 1 : 0) +
			(activeFilters.era && activeFilters.era !== '1990+' ? 1 : 0) +
			(activeFilters.minRating && activeFilters.minRating !== 7.0 ? 1 : 0) +
			(activeFilters.maxRuntime ? 1 : 0) +
			(activeFilters.mode && activeFilters.mode !== 'balanced' ? 1 : 0)
	);
</script>

<div class="filters">
	<div class="presets" role="group" aria-label="Moods">
		{#each PRESETS as preset (preset.id)}
			<Chip selected={activePreset === preset.id} onclick={() => onPresetSelect(preset.id)}>
				{preset.label}
			</Chip>
		{/each}
	</div>
	<Button
		variant="secondary"
		class="filters-button"
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={openSheet}
	>
		<SlidersIcon size={18} aria-hidden="true" />
		Filters
		{#if activeCustomCount > 0}
			<span class="count">{activeCustomCount}<span class="sr-only"> active</span></span>
		{/if}
	</Button>
</div>

<Sheet bind:open label="Refine the picker" side={wide.current ? 'right' : 'bottom'} detent="large">
	<div class="sheet-body">
		<fieldset>
			<legend>Style</legend>
			<div class="options">
				{#each MODES as mode (mode.id)}
					<Chip
						selected={(draft.mode ?? 'balanced') === mode.id}
						onclick={() => (draft.mode = mode.id)}
					>
						{mode.label}
					</Chip>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Release era</legend>
			<div class="options">
				{#each ERAS as era (era.id)}
					<Chip selected={(draft.era ?? '1990+') === era.id} onclick={() => setEra(era.id)}>
						{era.label}
					</Chip>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Minimum score</legend>
			<div class="options">
				{#each RATINGS as rating (rating)}
					<Chip selected={draft.minRating === rating} onclick={() => setRating(rating)}>
						{rating.toFixed(1)}+
					</Chip>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Length</legend>
			<div class="options">
				{#each RUNTIMES as runtime (runtime.label)}
					<Chip
						selected={draft.maxRuntime === runtime.val}
						onclick={() => (draft.maxRuntime = runtime.val)}
					>
						{runtime.label}
					</Chip>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Genres</legend>
			<div class="options">
				{#each allGenres as genre (genre)}
					<Chip
						selected={draft.genres?.includes(genre) ?? false}
						onclick={() => toggleGenre(genre)}
					>
						{genre}
					</Chip>
				{/each}
			</div>
		</fieldset>
	</div>
	<div class="sheet-actions">
		<Button variant="ghost" onclick={reset}>Reset</Button>
		<Button variant="primary" onclick={apply}>Show a film</Button>
	</div>
</Sheet>

<style>
	.filters {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	/* Chips scroll edge to edge on phones; the Filters button stays in reach. */
	.presets {
		display: flex;
		flex: 1;
		gap: var(--space-2);
		min-width: 0;
		margin-left: calc(-1 * var(--page-gutter));
		padding: var(--space-1) var(--space-1) var(--space-1) var(--page-gutter);
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(to right, black calc(100% - var(--space-5)), transparent);
	}
	.presets::-webkit-scrollbar {
		display: none;
	}
	.presets :global(.chip),
	.options :global(.chip) {
		min-height: var(--touch-target);
	}
	.filters :global(.filters-button) {
		flex-shrink: 0;
		border-radius: var(--radius-full);
	}
	.count {
		min-width: 1.25rem;
		padding: 0 0.35rem;
		border-radius: var(--radius-full);
		background: var(--brand-primary);
		color: var(--content-inverse);
		font-size: var(--text-xs);
		font-weight: 800;
		line-height: 1.25rem;
		text-align: center;
	}
	.sheet-body {
		display: grid;
		gap: var(--space-5);
		padding-bottom: var(--space-4);
	}
	fieldset {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-3);
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
	.sheet-actions {
		position: sticky;
		/* Bleeds over the sheet body padding so nothing scrolls visibly beneath it. */
		bottom: calc(-1 * var(--space-5));
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin: 0 calc(-1 * var(--space-5)) calc(-1 * var(--space-5));
		padding: var(--space-3) var(--space-5) calc(var(--space-5) + var(--safe-bottom));
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-overlay);
	}
	@media (min-width: 1024px) {
		.presets {
			margin-left: 0;
			padding-left: var(--space-1);
			flex-wrap: wrap;
			overflow: visible;
			mask-image: none;
		}
	}
</style>
