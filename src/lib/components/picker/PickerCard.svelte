<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import BackdropImage from '$lib/components/ui/backdrop-image';
	import Button from '$lib/components/ui/button';
	import MetaChips from '$lib/components/ui/meta-chips';
	import PosterCard from '$lib/components/ui/poster-card';
	import { formatRuntime, formatYear } from '$lib/format';
	import type { PickerRecommendationResponse } from '$lib/picker/types';
	import BookmarkIcon from 'lucide-svelte/icons/bookmark';
	import BookmarkCheckIcon from 'lucide-svelte/icons/bookmark-check';
	import CheckIcon from 'lucide-svelte/icons/check';
	import EyeIcon from 'lucide-svelte/icons/eye';
	import HeartIcon from 'lucide-svelte/icons/heart';
	import {
		pickerRating,
		pickerSignals,
		swipeDecision,
		type InteractionState,
		type InteractionType
	} from './picker-view';

	interface Props {
		recommendation: PickerRecommendationResponse;
		/** Server-confirmed state for this film; null until the server has answered once. */
		interaction: InteractionState | null;
		pending: InteractionType | null;
		busy: boolean;
		onAnother: () => void;
		onToggle: (type: InteractionType) => void;
	}

	let { recommendation, interaction, pending, busy, onAnother, onToggle }: Props = $props();

	const movie = $derived(recommendation.movie);
	const rating = $derived(pickerRating(movie));
	const signals = $derived(pickerSignals(recommendation.signals));
	const meta = $derived([
		formatYear(movie.releaseDate),
		formatRuntime(movie.runtime),
		movie.genres[0] ?? null
	]);

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	// Swipe left for another film. With reduced motion the card only fades.
	let start: { x: number; y: number; id: number } | null = null;
	let dragX = $state(0);
	let swiped = false;
	const dragStyle = $derived(
		dragX === 0
			? undefined
			: `${reducedMotion.current ? '' : `transform: translateX(${dragX}px);`} opacity: ${Math.max(0.4, 1 - Math.abs(dragX) / 320)}`
	);

	function onpointerdown(event: PointerEvent) {
		swiped = false;
		if (event.pointerType === 'mouse' || busy) return;
		start = { x: event.clientX, y: event.clientY, id: event.pointerId };
	}

	function onpointermove(event: PointerEvent) {
		if (!start || event.pointerId !== start.id) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		// A vertical gesture is a scroll: let it go.
		if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 12) {
			start = null;
			dragX = 0;
			return;
		}
		dragX = Math.min(0, dx);
	}

	function onpointerup(event: PointerEvent) {
		if (!start || event.pointerId !== start.id) return;
		const decision = swipeDecision(event.clientX - start.x, event.clientY - start.y);
		start = null;
		dragX = 0;
		if (decision === 'another') {
			// A swipe that starts and ends on a link or button must not also click it.
			swiped = true;
			onAnother();
		}
	}

	function onclickcapture(event: MouseEvent) {
		if (!swiped) return;
		swiped = false;
		event.preventDefault();
		event.stopPropagation();
	}

	function onpointercancel() {
		start = null;
		dragX = 0;
	}

	const TOGGLES: Array<{ type: InteractionType; label: string; doneLabel: string }> = [
		{ type: 'watchlist', label: 'Watchlist', doneLabel: 'In watchlist' },
		{ type: 'favorite', label: 'Favourite', doneLabel: 'Favourite' },
		{ type: 'watched', label: 'Watched', doneLabel: 'Watched' }
	];
</script>

<article
	class="card"
	class:busy
	class:dragging={dragX !== 0}
	aria-labelledby="picker-title"
	aria-busy={busy}
	style={dragStyle}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onpointercancel}
	{onclickcapture}
>
	<div class="art" aria-hidden="true">
		<BackdropImage path={movie.backdropPath} eager sizes="(min-width: 1024px) 90rem, 100vw" />
	</div>
	<div class="scrim" aria-hidden="true"></div>

	<div class="content">
		<div class="poster">
			<PosterCard
				id={movie.id}
				title={movie.title}
				posterPath={movie.posterPath}
				eager
				sizes="(min-width: 1024px) 220px, (min-width: 640px) 150px, 88px"
			/>
		</div>

		<div class="head">
			<p class="eyebrow">
				{recommendation.mode === 'discovery' ? 'Discovery pick' : 'Curated match'}
			</p>
			<h2 id="picker-title" class="title">{movie.title}</h2>
			{#if movie.originalTitle && movie.originalTitle !== movie.title}
				<p class="original">{movie.originalTitle}</p>
			{/if}
			<div class="facts">
				{#if rating}
					<span class="score">
						<span class="score-value">{rating.value}</span>
						<span class="score-source">{rating.source}</span>
						{#if rating.votes}<span class="score-votes">{rating.votes} votes</span>{/if}
					</span>
				{/if}
				<MetaChips items={meta} />
			</div>
		</div>

		<div class="body">
			<div class="why">
				<p class="why-label">Why this film</p>
				<p class="reason">{recommendation.reason}</p>
				<ul class="signals" aria-label="Picker signals">
					{#each signals as signal (signal.label)}
						<li><span>{signal.label}</span> <strong>{signal.value}</strong></li>
					{/each}
				</ul>
			</div>

			{#if movie.overview}
				<p class="overview">{movie.overview}</p>
			{/if}
			{#if movie.director}
				<p class="credit">Directed by <span>{movie.director}</span></p>
			{/if}

			<div class="actions">
				<Button href={`/movies/${movie.id}`} variant="primary" class="open">Open film</Button>
				<div class="toggles" role="group" aria-label="Save this film">
					{#each TOGGLES as toggle (toggle.type)}
						{@const on = interaction ? interaction[toggle.type] : false}
						<Button
							variant="secondary"
							class={on ? 'toggle on' : 'toggle'}
							aria-pressed={interaction ? on : undefined}
							aria-busy={pending === toggle.type ? 'true' : undefined}
							onclick={() => onToggle(toggle.type)}
						>
							{#if toggle.type === 'watchlist'}
								{#if on}
									<BookmarkCheckIcon size={18} aria-hidden="true" />
								{:else}
									<BookmarkIcon size={18} aria-hidden="true" />
								{/if}
							{:else if toggle.type === 'favorite'}
								<HeartIcon size={18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
							{:else if on}
								<CheckIcon size={18} aria-hidden="true" />
							{:else}
								<EyeIcon size={18} aria-hidden="true" />
							{/if}
							{on ? toggle.doneLabel : toggle.label}
						</Button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</article>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-raised);
		touch-action: pan-y;
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}
	.card.dragging {
		transition: none;
	}
	.card.busy {
		opacity: 0.55;
	}
	.art {
		position: absolute;
		inset: 0;
	}
	/* Same wash as the detail headers: the artwork stays visible, the text keeps AA contrast. */
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 45%, var(--surface-scrim) 72%, transparent 96%),
			linear-gradient(to right, var(--surface-scrim), transparent 70%);
	}
	.content {
		position: relative;
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		grid-template-areas:
			'poster head'
			'body body';
		align-items: end;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-4) var(--space-4);
	}
	.poster {
		grid-area: poster;
	}
	.head {
		grid-area: head;
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.body {
		grid-area: body;
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.eyebrow,
	.why-label {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: 1.05;
		overflow-wrap: anywhere;
	}
	.original {
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
	}
	.score {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.score-value {
		font-size: var(--text-lg);
		font-weight: 900;
	}
	.score-source {
		color: var(--rating-star);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
	}
	.score-votes {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
	}
	.why {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-left: 2px solid var(--brand-primary);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		background: var(--brand-muted);
	}
	.reason {
		color: var(--content-primary);
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	.signals {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		list-style: none;
		color: var(--content-secondary);
		font-size: var(--text-xs);
	}
	.signals strong {
		color: var(--content-primary);
		font-weight: 800;
	}
	.overview {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		max-width: 62ch;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.55;
	}
	.credit {
		color: var(--content-tertiary);
		font-size: var(--text-sm);
	}
	.credit span {
		color: var(--content-secondary);
		font-weight: 600;
	}
	.actions {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.toggles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.toggles :global(.toggle) {
		min-width: 0;
		padding-inline: var(--space-2);
		font-size: var(--text-sm);
	}
	.toggles :global(.toggle.on) {
		border-color: var(--brand-border);
		color: var(--brand-primary);
	}
	.toggles :global(.toggle[aria-busy='true']) {
		opacity: 0.6;
	}

	/* On a phone the card keeps to what decides: the reason, the signals, the actions. */
	@media (max-width: 639px) {
		.overview,
		.credit {
			display: none;
		}
		/* Year, length and genre stay on one line beside the poster. */
		.facts :global(.meta) {
			font-size: var(--text-xs);
		}
	}

	@media (min-width: 640px) {
		.content {
			grid-template-columns: 150px minmax(0, 1fr);
			grid-template-areas:
				'poster head'
				'poster body';
			column-gap: var(--space-5);
			padding: var(--space-7) var(--space-6) var(--space-6);
		}
		.actions {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
		}
		.toggles {
			display: flex;
		}
	}

	@media (min-width: 1024px) {
		.content {
			grid-template-columns: 220px minmax(0, 46rem);
			column-gap: var(--space-6);
			padding: var(--space-8) var(--space-7) var(--space-7);
		}
		.scrim {
			background:
				linear-gradient(to top, var(--surface-canvas) 2%, transparent 55%),
				linear-gradient(
					to right,
					var(--surface-canvas) 18%,
					var(--surface-scrim) 50%,
					transparent 85%
				);
		}
	}
</style>
