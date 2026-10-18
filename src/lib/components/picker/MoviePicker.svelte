<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { deserialize } from '$app/forms';
	import Button from '$lib/components/ui/button';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { addToast } from '$lib/stores/toast';
	import { QUICK_PRESETS } from '$lib/picker/presets';
	import type {
		PickerFilters,
		PickerPreset,
		PickerRecommendationResponse
	} from '$lib/picker/types';
	import ArrowRightIcon from 'lucide-svelte/icons/arrow-right';
	import RefreshIcon from 'lucide-svelte/icons/refresh-cw';
	import SparklesIcon from 'lucide-svelte/icons/sparkles';
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import PickerCard from './PickerCard.svelte';
	import PickerFiltersComponent from './PickerFilters.svelte';
	import {
		interactionOutcome,
		interactionToast,
		isAnotherShortcut,
		type InteractionState,
		type InteractionType
	} from './picker-view';

	interface Props {
		initialGenres: string[];
		initialPick?: PickerRecommendationResponse | null;
		/** TMDB backdrop paths from the viewer's watchlist, for the idle stage's ambient strip. */
		backdrops?: string[];
	}

	let { initialGenres, initialPick = null, backdrops = [] }: Props = $props();
	const ambient = $derived(
		backdrops.map((path) => tmdbImageUrl(path, 'w780')).filter((src): src is string => !!src)
	);

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

	// svelte-ignore state_referenced_locally
	let recommendation = $state<PickerRecommendationResponse | null>(initialPick);
	let loading = $state(false);
	// svelte-ignore state_referenced_locally
	let hasStarted = $state(initialPick !== null);
	let outcome = $state<'idle' | 'ready' | 'empty' | 'error'>('idle');
	let announcement = $state('');
	let stage = $state<HTMLDivElement>();

	// Only what the server confirmed for the film on screen; null means unknown.
	let interaction = $state<InteractionState | null>(null);
	let pending = $state<InteractionType | null>(null);

	onMount(() => {
		sessionId = crypto.randomUUID();
		if (initialPick) {
			outcome = 'ready';
			shownMovieIds.push(initialPick.movie.id);
			if (initialPick.movie.director) recentDirectors.push(initialPick.movie.director);
			if (initialPick.movie.genres[0]) recentGenres.push(initialPick.movie.genres[0]);
			logEvent('impression', initialPick.movie.id);
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!hasStarted || !recommendation || loading) return;
		if (!isAnotherShortcut(event)) return;
		event.preventDefault();
		handleAnother();
	}

	// On a phone the first pick scrolls the card up to fill the screen between the bars.
	async function revealStage() {
		if (!stage || !window.matchMedia('(max-width: 1023px)').matches) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		await tick();
		stage?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
	}

	async function findMovie(forceNewFilters?: PickerFilters) {
		const first = !hasStarted;
		loading = true;
		hasStarted = true;
		if (first) revealStage();
		announcement = 'Finding a film';

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
				outcome = 'empty';
				announcement = 'No film matches these filters';
			} else {
				recommendation = data;
				outcome = 'ready';
				shownMovieIds.push(data.movie.id);
				position++;

				if (data.movie.director) {
					recentDirectors.push(data.movie.director);
				}
				if (data.movie.genres[0]) {
					recentGenres.push(data.movie.genres[0]);
				}

				// A new film: nothing is known about it until the server answers.
				interaction = null;
				pending = null;
				announcement = `Now showing ${data.movie.title}`;

				logEvent('impression', data.movie.id);
			}
		} catch (err) {
			console.error('Picker error:', err);
			if (recommendation) {
				// Keep the film on screen; say the next one did not arrive.
				addToast('Could not load another film. Please try again.', 'error');
				announcement = 'Could not load another film';
			} else {
				outcome = 'error';
				announcement = 'Could not load a film';
			}
		} finally {
			loading = false;
		}
	}

	async function handleAnother() {
		if (loading) return;
		if (recommendation) {
			logEvent('another', recommendation.movie.id);
		}
		await findMovie();
	}

	async function handleNotTonight() {
		if (loading) return;
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

	const EVENT_FOR: Record<InteractionType, string> = {
		favorite: 'favorite',
		watchlist: 'watchlist',
		watched: 'watch'
	};

	async function toggleInteraction(type: InteractionType) {
		if (!recommendation || pending) return;
		const movie = recommendation.movie;
		// Unknown state asks to add; a confirmed state flips.
		const value = interaction ? !interaction[type] : true;
		pending = type;
		logEvent(EVENT_FOR[type], movie.id);

		let result: Parameters<typeof interactionOutcome>[0];
		try {
			const form = new FormData();
			form.set('type', type);
			form.set('value', String(value));
			const res = await fetch(`/movies/${encodeURIComponent(movie.id)}?/logInteraction`, {
				method: 'POST',
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
				body: form
			});
			result = deserialize(await res.text()) as Parameters<typeof interactionOutcome>[0];
		} catch {
			result = { type: 'error', error: new Error('network') };
		}

		// The answer is for this film only; a newer pick has its own state.
		if (recommendation?.movie.id !== movie.id) return;
		pending = null;
		const next = interactionOutcome(result);
		if (next.ok) {
			interaction = next.interaction;
			addToast(interactionToast(type, movie.title, next.interaction), 'success');
		} else {
			addToast(next.message, 'error');
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

<svelte:window onkeydown={handleKeydown} />

<div class="picker">
	<PickerFiltersComponent
		{activeFilters}
		{activePreset}
		allGenres={initialGenres}
		onFilterChange={handleFilterChange}
		onPresetSelect={handlePresetSelect}
	/>

	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<div class="stage" class:idle={!hasStarted} bind:this={stage}>
		{#if recommendation && outcome === 'ready'}
			<PickerCard
				{recommendation}
				{interaction}
				{pending}
				busy={loading}
				onAnother={handleAnother}
				onToggle={toggleInteraction}
			/>
		{:else if loading}
			<div class="frame skeleton" aria-hidden="true">
				<div class="skeleton-content">
					<div class="poster-skeleton"><Skeleton height="100%" /></div>
					<div class="skeleton-lines">
						<Skeleton width="40%" height="0.75rem" />
						<Skeleton width="75%" height="2rem" />
						<Skeleton width="55%" height="0.875rem" />
					</div>
					<div class="skeleton-body">
						<Skeleton height="4.5rem" />
						<Skeleton width="90%" height="0.875rem" />
						<Skeleton width="70%" height="0.875rem" />
						<Skeleton height="var(--touch-target)" />
					</div>
				</div>
			</div>
		{:else if !hasStarted}
			<section class="frame start" aria-labelledby="picker-start-title">
				{#if ambient.length >= 3}
					<div class="ambient" aria-hidden="true">
						{#each ambient as src, index (src)}
							<img {src} alt="" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
						{/each}
					</div>
				{/if}
				<div class="start-copy">
					<span class="mark" aria-hidden="true"><SparklesIcon size={26} /></span>
					<div class="start-text">
						<h2 id="picker-start-title">One film, chosen for tonight</h2>
						<p>
							Pick a mood above, or let the picker choose a well-rated film that suits what you
							usually watch.
						</p>
					</div>
				</div>
				<Button size="lg" class="start-cta" onclick={() => findMovie()}>
					<SparklesIcon size={18} aria-hidden="true" />
					Pick a film
				</Button>
			</section>
		{:else if outcome === 'empty'}
			<div class="frame state">
				<EmptyState
					title="No film matches these filters"
					description="Try a wider era, a lower minimum score or fewer genres."
				>
					{#snippet action()}
						<Button variant="secondary" onclick={handleReset}>Reset filters</Button>
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			<div class="frame state">
				<ErrorState
					title="The picker could not load a film"
					description="Check your connection and try again."
				>
					{#snippet action()}
						<Button variant="secondary" onclick={() => findMovie()}>Try again</Button>
					{/snippet}
				</ErrorState>
			</div>
		{/if}
	</div>

	{#if recommendation && outcome === 'ready'}
		<div class="decision">
			<p class="hint">
				Press <kbd aria-label="Right arrow"><ArrowRightIcon size={14} aria-hidden="true" /></kbd>
				for another film
			</p>
			<div class="decision-buttons">
				<Button variant="ghost" size="lg" class="not-tonight" onclick={handleNotTonight}>
					Not tonight
				</Button>
				<Button
					variant="primary"
					size="lg"
					class="another"
					aria-busy={loading ? 'true' : undefined}
					onclick={handleAnother}
				>
					<span class="another-icon" class:spinning={loading}>
						<RefreshIcon size={18} aria-hidden="true" />
					</span>
					Another
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	/* The card fills what the bars leave on a phone; the header scrolls away above it. */
	.stage {
		display: flex;
		scroll-margin-top: calc(var(--top-bar-height) + var(--safe-top) + var(--space-2));
		min-height: max(
			28rem,
			calc(
				100dvh - var(--top-bar-height) - var(--safe-top) - var(--bottom-bar-height) -
					var(--safe-bottom) - 6.5rem
			)
		);
	}
	.stage > :global(*) {
		flex: 1;
		min-width: 0;
	}
	.frame {
		display: flex;
		flex-direction: column;
		width: 100%;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-raised);
	}
	.skeleton {
		justify-content: flex-end;
	}
	.skeleton-content {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		align-items: end;
		gap: var(--space-4);
		padding: var(--space-4);
	}
	.poster-skeleton {
		aspect-ratio: 2 / 3;
	}
	.skeleton-lines,
	.skeleton-body {
		display: grid;
		gap: var(--space-3);
	}
	.skeleton-body {
		grid-column: 1 / -1;
	}
	/* Idle: a calm, compact invitation (not a screen-tall void). */
	.stage.idle {
		min-height: 0;
	}
	.start {
		position: relative;
		isolation: isolate;
		align-items: center;
		justify-content: center;
		gap: var(--space-5);
		min-height: min(26rem, 60svh);
		padding: var(--space-7) var(--space-5);
		overflow: hidden;
		text-align: center;
	}
	.start-copy {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
	}
	.start-text {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
	}
	/* A soft strip of the viewer's own watchlist, far behind the copy. */
	.ambient {
		position: absolute;
		inset: 0;
		z-index: -1;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(12rem, 1fr);
		gap: var(--space-2);
		opacity: 0.32;
		filter: blur(6px) saturate(1.1);
		transform: scale(1.08);
		mask-image: radial-gradient(75% 90% at 50% 50%, transparent 15%, black 85%);
	}
	.ambient img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ambient::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			var(--surface-raised),
			transparent 35%,
			transparent 65%,
			var(--surface-raised)
		);
	}
	@media (prefers-reduced-motion: no-preference) {
		.ambient {
			animation:
				ambient-in var(--duration-slow) var(--ease-out) both,
				ambient-drift 60s linear infinite alternate;
		}
	}
	@keyframes ambient-in {
		from {
			opacity: 0;
		}
	}
	@keyframes ambient-drift {
		to {
			transform: scale(1.08) translateX(-4%);
		}
	}
	.mark {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	.start h2 {
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: 1.1;
	}
	.start p {
		max-width: 34rem;
		color: var(--content-secondary);
		line-height: 1.55;
	}
	.state {
		justify-content: center;
		padding: var(--space-5);
	}
	/* Big thumb-reach buttons pinned above the tab bar on phones. */
	.decision {
		position: sticky;
		bottom: calc(var(--bottom-bar-height) + var(--safe-bottom) + var(--space-2));
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.decision-buttons {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-scrim);
		backdrop-filter: blur(16px);
	}
	.decision-buttons :global(.another) {
		width: 100%;
	}
	.another-icon {
		display: inline-flex;
	}
	.another-icon.spinning {
		animation: spin 0.9s linear infinite;
	}
	.hint {
		display: none;
		align-items: center;
		gap: var(--space-2);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.75rem;
		height: 1.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xs);
		background: var(--surface-interactive);
		color: var(--content-secondary);
	}
	@media (min-width: 640px) {
		.skeleton-content {
			grid-template-columns: 150px minmax(0, 1fr);
			padding: var(--space-6);
		}
	}
	@media (min-width: 1024px) {
		.stage {
			min-height: min(36rem, calc(100dvh - var(--top-bar-height) - 14rem));
		}
		.stage.idle {
			min-height: 0;
		}
		.start {
			min-height: 24rem;
		}
		.decision {
			position: static;
		}
		.decision-buttons {
			display: flex;
			width: auto;
			padding: 0;
			border: 0;
			background: none;
			backdrop-filter: none;
		}
		.hint {
			display: inline-flex;
		}
	}
	/* Phone landscape: the stage never outgrows the screen; the idle state is one row with the
	   call to action on the right, above the fold next to the moods. */
	@media (orientation: landscape) and (max-height: 500px) {
		.stage {
			min-height: 0;
		}
		.start {
			flex-direction: row;
			justify-content: space-between;
			gap: var(--space-5);
			min-height: 0;
			padding: var(--space-4) var(--space-5);
			text-align: start;
		}
		.start-copy {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			justify-items: start;
		}
		.start-text {
			justify-items: start;
			gap: var(--space-1);
		}
		.start h2 {
			font-size: var(--type-title);
		}
		.start p {
			font-size: var(--text-sm);
		}
		.mark {
			width: 2.75rem;
			height: 2.75rem;
		}
		.start :global(.start-cta) {
			flex: none;
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.another-icon.spinning {
			animation: none;
		}
	}
</style>
