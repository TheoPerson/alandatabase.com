<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PickerCard from './PickerCard.svelte';
	import PickerFiltersComponent from './PickerFilters.svelte';
	import type {
		PickerFilters,
		PickerPreset,
		PickerRecommendationResponse
	} from '$lib/server/picker/types';
	import { QUICK_PRESETS } from '$lib/server/picker/config';

	interface Props {
		initialGenres: string[];
		initialPick?: PickerRecommendationResponse | null;
	}

	let { initialGenres, initialPick = null }: Props = $props();

	// Session State
	let sessionId = $state('');
	let position = $state(1);
	let shownMovieIds = $state<string[]>([]);
	let recentDirectors = $state<string[]>([]);
	let recentGenres = $state<string[]>([]);

	// Active Filters & State
	let activePreset = $state<PickerPreset | null>('TONIGHT');
	let activeFilters = $state<PickerFilters>({
		era: '1990+',
		minYear: 1990,
		minRating: 7.0,
		mode: 'balanced'
	});

	let recommendation = $state<PickerRecommendationResponse | null>(initialPick);
	let loading = $state(false);
	let hasStarted = $state(initialPick !== null);
	let errorMessage = $state<string | null>(null);

	// Quick interaction states for current movie
	let isFavorited = $state(false);
	let isWatchlisted = $state(false);
	let isWatched = $state(false);

	onMount(() => {
		sessionId = crypto.randomUUID();
		if (initialPick) {
			shownMovieIds.push(initialPick.movie.id);
			if (initialPick.movie.director) recentDirectors.push(initialPick.movie.director);
			if (initialPick.movie.genres[0]) recentGenres.push(initialPick.movie.genres[0]);
			logEvent('impression', initialPick.movie.id);
		}

		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		) {
			return;
		}

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!hasStarted) {
				findMovie();
			} else {
				handleAnother();
			}
		} else if (e.key === 'n' || e.key === 'N') {
			if (hasStarted && recommendation) {
				e.preventDefault();
				handleAnother();
			}
		} else if (e.key === 'x' || e.key === 'X') {
			if (hasStarted && recommendation) {
				e.preventDefault();
				handleNotTonight();
			}
		} else if (e.key === 'w' || e.key === 'W') {
			if (hasStarted && recommendation) {
				e.preventDefault();
				window.location.href = `/movies/${recommendation.movie.id}`;
			}
		}
	}

	async function findMovie(forceNewFilters?: PickerFilters) {
		loading = true;
		errorMessage = null;
		hasStarted = true;

		const currentFilters = forceNewFilters || activeFilters;

		try {
			const res = await fetch('/api/picker/recommend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					shownMovieIds,
					position,
					filters: currentFilters,
					recentDirectorsShown: recentDirectors.slice(-3),
					recentPrimaryGenresShown: recentGenres.slice(-3)
				})
			});

			if (!res.ok) {
				throw new Error(`Server returned ${res.status}`);
			}

			const data = (await res.json()) as PickerRecommendationResponse & { message?: string };

			if (!data.movie) {
				recommendation = null;
				errorMessage = 'No movies matched your strict filters. Try relaxing era or rating.';
			} else {
				recommendation = data;
				shownMovieIds.push(data.movie.id);
				position++;

				if (data.movie.director) {
					recentDirectors.push(data.movie.director);
				}
				if (data.movie.genres[0]) {
					recentGenres.push(data.movie.genres[0]);
				}

				// Reset interaction toggles for new movie
				isFavorited = false;
				isWatchlisted = false;
				isWatched = false;

				logEvent('impression', data.movie.id);
			}
		} catch (err: any) {
			console.error('Picker error:', err);
			errorMessage = 'Unable to generate recommendation. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleAnother() {
		if (recommendation) {
			logEvent('another', recommendation.movie.id);
		}
		await findMovie();
	}

	async function handleNotTonight() {
		if (recommendation) {
			logEvent('not_tonight', recommendation.movie.id);
		}
		await findMovie();
	}

	async function logEvent(action: string, movieId: string) {
		try {
			await fetch('/api/picker/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					movieId,
					action,
					position,
					score: recommendation?.signals.finalScore
				})
			});
		} catch {
			// Telemetry failure is non-blocking
		}
	}

	async function toggleFavorite() {
		if (!recommendation) return;
		isFavorited = !isFavorited;
		logEvent('favorite', recommendation.movie.id);
		await submitInteraction('favorite', isFavorited);
	}

	async function toggleWatchlist() {
		if (!recommendation) return;
		isWatchlisted = !isWatchlisted;
		logEvent('watchlist', recommendation.movie.id);
		await submitInteraction('watchlist', isWatchlisted);
	}

	async function toggleWatched() {
		if (!recommendation) return;
		isWatched = !isWatched;
		logEvent('watch', recommendation.movie.id);
		await submitInteraction('watched', isWatched);
	}

	async function submitInteraction(type: string, value: boolean) {
		if (!recommendation) return;
		try {
			const form = new FormData();
			form.set('movieId', recommendation.movie.id);
			form.set('type', type);
			form.set('value', String(value));

			await fetch(`/movies/catalog/${recommendation.movie.id}?/logInteraction`, {
				method: 'POST',
				body: form
			});
		} catch {
			// Non-blocking
		}
	}

	function handlePresetSelect(preset: PickerPreset) {
		activePreset = preset;
		const presetConfig = QUICK_PRESETS[preset];
		activeFilters = {
			...activeFilters,
			...presetConfig
		};
		findMovie(activeFilters);
	}

	function handleFilterChange(newFilters: PickerFilters) {
		activePreset = null;
		activeFilters = newFilters;
		findMovie(newFilters);
	}

	function handleReset() {
		activePreset = 'TONIGHT';
		activeFilters = {
			era: '1990+',
			minYear: 1990,
			minRating: 7.0,
			mode: 'balanced',
			genres: []
		};
		shownMovieIds = [];
		findMovie(activeFilters);
	}
</script>

<div class="picker-container">
	<!-- Top Controls: Presets and Filters -->
	<PickerFiltersComponent
		{activeFilters}
		{activePreset}
		allGenres={initialGenres}
		onFilterChange={handleFilterChange}
		onPresetSelect={handlePresetSelect}
	/>

	<!-- Main Interaction Area -->
	<main class="picker-stage">
		{#if !hasStarted}
			<!-- Initial Zero-Thinking Hero Screen -->
			<section class="hero-start-box">
				<div class="radar-pulse-disc">
					<span class="cinema-clapper">🎬</span>
				</div>
				<h1 class="hero-prompt">What should I watch tonight?</h1>
				<p class="hero-subtext">
					High-confidence cinema curation powered by authentic IMDb quality and your personal taste
					profile.
				</p>

				<button type="button" class="btn-hero-launch" onclick={() => findMovie()}>
					<span>🎬 FIND A MOVIE</span>
				</button>

				<div class="keyboard-hint">
					<span>Tip: Press</span> <kbd>Space</kbd> <span>or</span> <kbd>Enter</kbd>
				</div>
			</section>
		{:else if loading}
			<!-- Loading Skeleton State -->
			<div class="loading-box" aria-live="polite">
				<div class="skeleton-card">
					<div class="skeleton-poster shimmer"></div>
					<div class="skeleton-content">
						<div class="skeleton-line shimmer title-line"></div>
						<div class="skeleton-line shimmer subtitle-line"></div>
						<div class="skeleton-line shimmer desc-line"></div>
						<div class="skeleton-line shimmer desc-line short"></div>
					</div>
				</div>
				<p class="loading-label">Curating the highest-confidence pick...</p>
			</div>
		{:else if recommendation}
			<!-- Recommendation Result Card -->
			<div class="card-display-wrap">
				<PickerCard
					{recommendation}
					{isFavorited}
					{isWatchlisted}
					{isWatched}
					{loading}
					onAnother={handleAnother}
					onNotTonight={handleNotTonight}
					onToggleFavorite={toggleFavorite}
					onToggleWatchlist={toggleWatchlist}
					onToggleWatched={toggleWatched}
				/>

				<div class="keyboard-legend">
					<span>Keyboard:</span>
					<span class="legend-item"><kbd>Space</kbd> Another</span>
					<span class="legend-item"><kbd>X</kbd> Not Tonight</span>
					<span class="legend-item"><kbd>W</kbd> Open Movie</span>
				</div>
			</div>
		{:else if errorMessage}
			<!-- Empty State / Fallback -->
			<section class="empty-state-box">
				<div class="empty-icon">🔍</div>
				<h3 class="empty-title">No Perfect Matches Found</h3>
				<p class="empty-desc">{errorMessage}</p>

				<div class="empty-actions">
					<button type="button" class="btn-reset-filters" onclick={handleReset}>
						↻ Reset Filters to Defaults
					</button>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.picker-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 1080px;
		margin: 0 auto;
		padding: 1rem 1rem 4rem;
	}

	.picker-stage {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 480px;
	}

	/* Initial Hero View */
	.hero-start-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 580px;
		padding: 3rem 1.5rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-md);
	}

	.radar-pulse-disc {
		width: 80px;
		height: 80px;
		border-radius: var(--radius-full);
		background: var(--accent-emerald-subtle);
		border: 2px solid var(--accent-emerald);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
		animation: pulseRing 3s infinite ease-in-out;
	}

	.cinema-clapper {
		font-size: 2.2rem;
	}

	.hero-prompt {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.75rem;
	}

	.hero-subtext {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 2rem;
	}

	.btn-hero-launch {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 2.5rem;
		background: var(--accent-emerald);
		border-radius: var(--radius-md);
		color: #000;
		font-size: 1.1rem;
		font-weight: 800;
		cursor: pointer;
		box-shadow: 0 4px 25px rgba(16, 185, 129, 0.4);
		transition: all var(--transition-fast);
	}

	.btn-hero-launch:hover {
		background: var(--accent-emerald-hover);
		transform: scale(1.03) translateY(-2px);
		box-shadow: 0 6px 30px rgba(16, 185, 129, 0.5);
	}

	.keyboard-hint {
		margin-top: 1.5rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	kbd {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		padding: 2px 6px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	/* Loading Skeleton */
	.loading-box {
		width: 100%;
		max-width: 960px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.skeleton-card {
		width: 100%;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	@media (min-width: 768px) {
		.skeleton-card {
			flex-direction: row;
		}
	}

	.skeleton-poster {
		width: 280px;
		height: 400px;
		border-radius: var(--radius-md);
		background: var(--bg-surface-2);
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		padding-top: 1rem;
	}

	.skeleton-line {
		height: 20px;
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
	}

	.title-line {
		width: 60%;
		height: 36px;
	}

	.subtitle-line {
		width: 40%;
	}

	.desc-line {
		width: 100%;
		height: 14px;
	}

	.desc-line.short {
		width: 75%;
	}

	.shimmer {
		animation: shimmer 1.5s infinite linear;
		background: linear-gradient(
			to right,
			var(--bg-surface-2) 0%,
			var(--bg-surface-3) 50%,
			var(--bg-surface-2) 100%
		);
		background-size: 800px 100%;
	}

	.loading-label {
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	/* Card Display Wrap */
	.card-display-wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	.keyboard-legend {
		display: none;
		align-items: center;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	@media (min-width: 768px) {
		.keyboard-legend {
			display: flex;
		}
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* Empty State */
	.empty-state-box {
		text-align: center;
		padding: 3rem 2rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		max-width: 480px;
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	.empty-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.empty-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}

	.btn-reset-filters {
		padding: 0.75rem 1.5rem;
		background: var(--accent-emerald);
		border: none;
		border-radius: var(--radius-md);
		color: #000;
		font-weight: 700;
		cursor: pointer;
	}

	@keyframes pulseRing {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
		}
		50% {
			box-shadow: 0 0 0 15px rgba(16, 185, 129, 0);
		}
	}

	@keyframes shimmer {
		0% {
			background-position: -400px 0;
		}
		100% {
			background-position: 400px 0;
		}
	}
</style>
