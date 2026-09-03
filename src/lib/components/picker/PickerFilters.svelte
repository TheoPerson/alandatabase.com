<script lang="ts">
	import type { PickerFilters, PickerPreset, RecommendationMode } from '$lib/server/picker/types';

	interface Props {
		activeFilters: PickerFilters;
		activePreset: PickerPreset | null;
		allGenres: string[];
		onFilterChange: (filters: PickerFilters) => void;
		onPresetSelect: (preset: PickerPreset) => void;
	}

	let { activeFilters, activePreset, allGenres, onFilterChange, onPresetSelect }: Props = $props();

	let drawerOpen = $state(false);

	const PRESETS: Array<{ id: PickerPreset; label: string; icon: string }> = [
		{ id: 'TONIGHT', label: 'Tonight', icon: '✨' },
		{ id: 'HIGHLY_RATED', label: 'Masterpiece (8.0+)', icon: '⭐' },
		{ id: 'CRIME', label: 'Crime', icon: '🕵️' },
		{ id: 'THRILLER', label: 'Thriller', icon: '⚡' },
		{ id: 'HIDDEN_GEM', label: 'Hidden Gem', icon: '💎' },
		{ id: 'CLASSIC', label: 'Classic', icon: '🎞️' },
		{ id: 'SHORT', label: 'Short (< 2h)', icon: '⏱️' }
	];

	const ERAS = [
		{ id: 'all', label: 'All Time' },
		{ id: '1990+', label: '1990+' },
		{ id: '2000+', label: '2000+' },
		{ id: '2010+', label: '2010+' },
		{ id: '2020+', label: '2020+' },
		{ id: 'classic', label: 'Classic (1950–1989)' }
	] as const;

	const RATINGS = [
		{ val: 7.0, label: '7.0+' },
		{ val: 7.5, label: '7.5+' },
		{ val: 8.0, label: '8.0+' },
		{ val: 8.5, label: '8.5+' }
	];

	const RUNTIMES = [
		{ val: undefined, label: 'Any' },
		{ val: 100, label: '< 100 min' },
		{ val: 120, label: '< 2 hours' },
		{ val: 150, label: '< 2.5 hours' }
	];

	function toggleGenre(genre: string) {
		const current = activeFilters.genres || [];
		const updated = current.includes(genre)
			? current.filter((g) => g !== genre)
			: [...current, genre];
		onFilterChange({ ...activeFilters, genres: updated });
	}

	function setEra(era: typeof ERAS[number]['id']) {
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

		onFilterChange({ ...activeFilters, era, minYear, maxYear });
	}

	function setRating(minRating: number) {
		const updated = activeFilters.minRating === minRating ? undefined : minRating;
		onFilterChange({ ...activeFilters, minRating: updated });
	}

	function setRuntime(maxRuntime?: number) {
		onFilterChange({ ...activeFilters, maxRuntime });
	}

	function setMode(mode: RecommendationMode) {
		onFilterChange({ ...activeFilters, mode });
	}

	function resetFilters() {
		onFilterChange({
			era: '1990+',
			minYear: 1990,
			minRating: 7.0,
			mode: 'balanced',
			genres: []
		});
		drawerOpen = false;
	}

	const activeCustomCount = $derived(
		(activeFilters.genres && activeFilters.genres.length > 0 ? 1 : 0) +
			(activeFilters.era && activeFilters.era !== '1990+' ? 1 : 0) +
			(activeFilters.minRating && activeFilters.minRating !== 7.0 ? 1 : 0) +
			(activeFilters.maxRuntime ? 1 : 0) +
			(activeFilters.mode && activeFilters.mode !== 'balanced' ? 1 : 0)
	);
</script>

<div class="filter-bar">
	<!-- Quick Presets Carousel -->
	<div class="presets-row" role="tablist" aria-label="Recommendation Presets">
		{#each PRESETS as preset}
			<button
				type="button"
				class="preset-chip"
				class:active={activePreset === preset.id}
				onclick={() => onPresetSelect(preset.id)}
			>
				<span class="preset-icon">{preset.icon}</span>
				<span class="preset-label">{preset.label}</span>
			</button>
		{/each}

		<button
			type="button"
			class="filter-toggle-btn"
			class:has-active={activeCustomCount > 0}
			onclick={() => (drawerOpen = !drawerOpen)}
			aria-expanded={drawerOpen}
		>
			<span class="filter-icon">⚙️</span>
			<span>Filters</span>
			{#if activeCustomCount > 0}
				<span class="filter-badge">{activeCustomCount}</span>
			{/if}
		</button>
	</div>

	<!-- Drawer for Granular Controls -->
	{#if drawerOpen}
		<div class="drawer-backdrop" onclick={() => (drawerOpen = false)} role="presentation">
			<div class="drawer-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<div class="drawer-header">
					<h3 class="drawer-title">Refine Recommendations</h3>
					<button type="button" class="close-btn" onclick={() => (drawerOpen = false)} aria-label="Close filters">
						✕
					</button>
				</div>

				<div class="drawer-body">
					<!-- Recommendation Mode -->
					<div class="filter-section">
						<label class="section-label">Recommendation Style</label>
						<div class="pills-grid">
							<button
								type="button"
								class="option-pill"
								class:selected={!activeFilters.mode || activeFilters.mode === 'balanced'}
								onclick={() => setMode('balanced')}
							>
								Balanced (70/30)
							</button>
							<button
								type="button"
								class="option-pill"
								class:selected={activeFilters.mode === 'safe'}
								onclick={() => setMode('safe')}
							>
								Safe / High Confidence
							</button>
							<button
								type="button"
								class="option-pill"
								class:selected={activeFilters.mode === 'discovery'}
								onclick={() => setMode('discovery')}
							>
								Adventurous Discovery
							</button>
						</div>
					</div>

					<!-- Era -->
					<div class="filter-section">
						<label class="section-label">Release Era</label>
						<div class="pills-grid">
							{#each ERAS as era}
								<button
									type="button"
									class="option-pill"
									class:selected={activeFilters.era === era.id || (!activeFilters.era && era.id === '1990+')}
									onclick={() => setEra(era.id)}
								>
									{era.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- Minimum Rating -->
					<div class="filter-section">
						<label class="section-label">Minimum Score</label>
						<div class="pills-grid">
							{#each RATINGS as r}
								<button
									type="button"
									class="option-pill"
									class:selected={activeFilters.minRating === r.val}
									onclick={() => setRating(r.val)}
								>
									★ {r.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- Runtime -->
					<div class="filter-section">
						<label class="section-label">Maximum Runtime</label>
						<div class="pills-grid">
							{#each RUNTIMES as rt}
								<button
									type="button"
									class="option-pill"
									class:selected={activeFilters.maxRuntime === rt.val}
									onclick={() => setRuntime(rt.val)}
								>
									{rt.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- Genres Multi-Select -->
					<div class="filter-section">
						<label class="section-label">Genres (Multi-select)</label>
						<div class="genres-wrap">
							{#each allGenres as g}
								<button
									type="button"
									class="genre-chip"
									class:selected={activeFilters.genres?.includes(g)}
									onclick={() => toggleGenre(g)}
								>
									{g}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="drawer-footer">
					<button type="button" class="btn-reset" onclick={resetFilters}>Reset</button>
					<button type="button" class="btn-apply" onclick={() => (drawerOpen = false)}>
						Apply Filters
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-bar {
		position: relative;
		width: 100%;
		margin-bottom: 2rem;
	}

	.presets-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.presets-row::-webkit-scrollbar {
		display: none;
	}

	.preset-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.preset-chip:hover {
		background: var(--bg-surface-2);
		color: var(--text-primary);
		border-color: var(--border-strong);
	}

	.preset-chip.active {
		background: var(--accent-emerald-subtle);
		border-color: var(--accent-emerald);
		color: var(--accent-emerald);
	}

	.filter-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		margin-left: auto;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.filter-toggle-btn.has-active {
		border-color: var(--accent-gold);
		color: var(--accent-gold);
	}

	.filter-badge {
		background: var(--accent-gold);
		color: #000;
		font-size: 0.7rem;
		font-weight: 800;
		padding: 1px 6px;
		border-radius: 999px;
	}

	/* Drawer Modal */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		z-index: 100;
		display: flex;
		justify-content: flex-end;
		animation: fadeIn 150ms ease-out;
	}

	.drawer-panel {
		width: 100%;
		max-width: 440px;
		height: 100%;
		background: var(--bg-primary);
		border-left: 1px solid var(--border-strong);
		display: flex;
		flex-direction: column;
		animation: slideLeft 200ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.drawer-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.close-btn {
		font-size: 1.2rem;
		color: var(--text-tertiary);
		padding: 0.25rem;
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text-primary);
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		margin-bottom: 0.6rem;
	}

	.pills-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.option-pill {
		padding: 0.4rem 0.8rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option-pill:hover {
		background: var(--bg-surface-2);
		color: var(--text-primary);
	}

	.option-pill.selected {
		background: var(--accent-emerald-subtle);
		border-color: var(--accent-emerald);
		color: var(--accent-emerald);
	}

	.genres-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.genre-chip {
		padding: 0.35rem 0.7rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-tertiary);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.genre-chip:hover {
		color: var(--text-primary);
	}

	.genre-chip.selected {
		background: var(--accent-gold);
		border-color: var(--accent-gold);
		color: #000;
		font-weight: 700;
	}

	.drawer-footer {
		display: flex;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface-1);
	}

	.btn-reset {
		flex: 1;
		padding: 0.7rem 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.btn-apply {
		flex: 2;
		padding: 0.7rem 1rem;
		background: var(--accent-emerald);
		border: none;
		border-radius: var(--radius-md);
		color: #000;
		font-weight: 700;
		font-size: 0.9rem;
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideLeft {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
</style>
