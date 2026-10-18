<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HeroItem } from '$lib/catalogue/items';
	import PauseIcon from 'lucide-svelte/icons/pause';
	import PlayIcon from 'lucide-svelte/icons/play';
	import { backdropSrcSet, logoSrcSet } from '$lib/tmdb/images';
	import { formatRating, formatRuntime, formatYear } from '$lib/format';
	import BackdropImage from '../backdrop-image/backdrop-image.svelte';
	import MetaChips from '../meta-chips/meta-chips.svelte';
	import { nextIndex, previousIndex, swipeDirection } from './rotation';

	interface Props {
		items: HeroItem[];
		intervalMs?: number;
		// Rendered inside the text block, below the overview: the page decides the actions.
		actions?: Snippet<[HeroItem]>;
		// The page's own h1 (visually hidden): slide titles change, the page heading must not.
		heading?: string;
	}

	let { items, intervalMs = 8000, actions, heading }: Props = $props();

	let index = $state(0);
	let hovered = $state(false);
	let userPaused = $state(false);
	let reducedMotion = $state(false);
	let pointerStartX: number | null = null;
	// The previous backdrop stays underneath while the new one fades in over it.
	let layers = $state<HeroItem[]>(items[0] ? [items[0]] : []);

	const count = $derived(items.length);
	const current = $derived(items[index] ?? null);
	const rotating = $derived(count > 1 && !hovered && !userPaused && !reducedMotion);
	const logo = $derived(logoSrcSet(current?.logoPath));
	const meta = $derived(
		current
			? [
					formatRating(current.rating) ? `★ ${formatRating(current.rating)}` : null,
					formatYear(current.releaseDate),
					formatRuntime(current.runtime),
					// Two genres keep the line to one row on a phone, the way TV apps show it.
					...(current.genres ?? []).slice(0, 2)
				]
			: []
	);

	$effect(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	$effect(() => {
		const item = current;
		if (!item) return;
		const existing = untrack(() => layers);
		const previous = existing[existing.length - 1];
		if (previous?.id === item.id) return;
		layers = previous ? [previous, item] : [item];
	});

	$effect(() => {
		// Preload the next slide with the same candidates the browser will pick.
		const next = items[nextIndex(index, count)];
		if (!next || typeof Image === 'undefined') return;
		const backdrop = backdropSrcSet(next.backdropPath);
		if (backdrop) {
			const image = new Image();
			image.sizes = '100vw';
			image.srcset = backdrop.srcset;
			image.src = backdrop.src;
			new Image().src = backdrop.placeholder;
		}
		const nextLogo = logoSrcSet(next.logoPath);
		if (nextLogo) {
			const image = new Image();
			image.sizes = '(min-width: 1024px) 420px, 70vw';
			image.srcset = nextLogo.srcset;
			image.src = nextLogo.src;
		}
	});

	$effect(() => {
		if (!rotating) return;
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') index = nextIndex(index, count);
		}, intervalMs);
		return () => window.clearInterval(timer);
	});

	function onPointerDown(event: PointerEvent) {
		pointerStartX = event.clientX;
	}

	function onPointerUp(event: PointerEvent) {
		if (pointerStartX === null) return;
		const direction = swipeDirection(event.clientX - pointerStartX);
		pointerStartX = null;
		if (direction === 1) index = nextIndex(index, count);
		if (direction === -1) index = previousIndex(index, count);
	}
</script>

{#if current}
	<section
		class="hero"
		class:paused={!rotating}
		aria-roledescription="carousel"
		aria-label="Featured titles"
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => (hovered = false)}
		onfocusin={() => (hovered = true)}
		onfocusout={() => (hovered = false)}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={() => (pointerStartX = null)}
	>
		{#if heading}<h1 class="sr-only">{heading}</h1>{/if}
		<div class="layers" aria-hidden="true">
			{#each layers as layer (layer.id)}
				<BackdropImage path={layer.backdropPath} eager={layer.id === items[0]?.id} sizes="100vw" />
			{/each}
		</div>
		<div class="scrim" aria-hidden="true"></div>

		<div class="content">
			{#if count > 1}
				<!-- First in the tab order, as the ARIA carousel pattern asks; shown under the slide. -->
				<div class="controls">
					<button
						type="button"
						class="pause"
						aria-label={userPaused ? 'Play featured titles' : 'Pause featured titles'}
						aria-pressed={userPaused}
						onclick={() => (userPaused = !userPaused)}
					>
						{#if userPaused}
							<PlayIcon size={18} aria-hidden="true" />
						{:else}
							<PauseIcon size={18} aria-hidden="true" />
						{/if}
					</button>
					<div class="dots" role="group" aria-label="Choose featured title">
						{#each items as item, dotIndex (item.id)}
							<button
								type="button"
								class="dot"
								class:active={dotIndex === index}
								aria-current={dotIndex === index ? 'true' : undefined}
								aria-label={`Show ${dotIndex + 1} of ${count}: ${item.title}`}
								onclick={() => (index = dotIndex)}
							>
								<span class="dot-fill" style:animation-duration={`${intervalMs}ms`}></span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="slides" aria-live={rotating ? 'off' : 'polite'}>
				{#key current.id}
					<div
						class="text"
						role="group"
						aria-roledescription="slide"
						aria-label={`${index + 1} of ${count}: ${current.title}`}
					>
						<div class="title-box">
							{#if logo}
								<img
									class="logo"
									src={logo.src}
									srcset={logo.srcset || undefined}
									sizes="(min-width: 1024px) 420px, 70vw"
									alt=""
									loading="eager"
									decoding="async"
								/>
								<h2 class="sr-only">{current.title}</h2>
							{:else}
								<h2 class="title">{current.title}</h2>
							{/if}
						</div>
						<MetaChips items={meta} class="meta" />
						{#if current.overview}<p class="overview">{current.overview}</p>{/if}
						{#if actions}<div class="actions">{@render actions(current)}</div>{/if}
					</div>
				{/key}
			</div>
		</div>
	</section>
{/if}

<style>
	.hero {
		position: relative;
		/* Sit under the transparent top bar. */
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
		min-height: min(70dvh, 560px);
		display: flex;
		align-items: flex-end;
		overflow: hidden;
		touch-action: pan-y;
		isolation: isolate;
	}
	@media (min-width: 1024px) {
		.hero {
			min-height: min(80dvh, 720px);
		}
	}
	.layers {
		position: absolute;
		inset: 0;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to top,
				var(--surface-canvas) 0%,
				color-mix(in srgb, var(--surface-canvas) 55%, transparent) 40%,
				transparent 75%
			),
			linear-gradient(
				to right,
				color-mix(in srgb, var(--surface-canvas) 90%, transparent) 0%,
				color-mix(in srgb, var(--surface-canvas) 35%, transparent) 55%,
				transparent 100%
			);
	}
	.content {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-5)) var(--page-gutter)
			var(--space-6);
	}
	.slides {
		order: 1;
	}
	.controls {
		order: 2;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.text {
		position: relative;
		max-width: 44rem;
		animation: rise var(--duration-slow) var(--ease-out) both;
	}
	/* A soft local vignette keeps the copy readable over bright artwork. It reaches zero at its
	   own edges (closest-side), so it never shows as a box over the backdrop. */
	.text::before {
		content: '';
		position: absolute;
		inset: -4rem -6rem;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			closest-side ellipse at 40% 55%,
			color-mix(in srgb, var(--surface-canvas) 72%, transparent),
			color-mix(in srgb, var(--surface-canvas) 45%, transparent) 55%,
			transparent
		);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.title-box {
		display: flex;
		align-items: flex-end;
		min-height: clamp(4.5rem, 12vw, 10rem);
	}
	.logo {
		display: block;
		height: clamp(4.5rem, 12vw, 10rem);
		width: auto;
		max-width: min(70vw, 420px);
		object-fit: contain;
		object-position: left bottom;
		filter: drop-shadow(0 6px 24px color-mix(in srgb, black 60%, transparent));
	}
	.title {
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		text-shadow: 0 4px 30px color-mix(in srgb, black 60%, transparent);
	}
	.text :global(.meta) {
		margin-top: var(--space-3);
		color: var(--content-primary);
	}
	.overview {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 36rem;
		margin-top: var(--space-3);
		color: var(--content-primary);
		opacity: 0.92;
		font-size: var(--text-md);
		line-height: 1.55;
	}
	@media (max-width: 639px) {
		.overview {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-5);
	}
	.pause {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--surface-canvas) 60%, transparent);
		color: var(--content-primary);
		transition: background-color var(--duration-base) var(--ease-out);
	}
	.pause:hover {
		background: color-mix(in srgb, var(--content-primary) 12%, transparent);
	}
	.dots {
		display: flex;
	}
	/* A full 44px target around a calm 2rem bar; the targets touch, the bars keep their gap. */
	.dot {
		width: var(--touch-target);
		height: var(--touch-target);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.dot-fill {
		display: block;
		width: 2rem;
		height: 3px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--content-primary) 25%, transparent);
		overflow: hidden;
		position: relative;
	}
	.dot.active .dot-fill::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--brand-primary);
		transform-origin: left;
		animation: progress linear forwards;
		animation-duration: inherit;
	}
	.hero.paused .dot.active .dot-fill::after {
		animation-play-state: paused;
	}
	/* The first section after the hero keeps the page rhythm instead of a dead band. */
	.hero + :global(.section) {
		margin-top: var(--space-5);
	}
	@media (max-width: 639px) {
		.content {
			padding-bottom: var(--space-4);
		}
	}
	/* Landscape phones: the whole slide, actions and controls included, fits above the tab bar. */
	@media (max-height: 500px) and (orientation: landscape) {
		.hero {
			min-height: calc(100svh - var(--bottom-bar-height) - var(--tab-bar-inset));
		}
		.content {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
			column-gap: var(--space-4);
			padding-top: calc(var(--top-bar-height) + var(--safe-top) + var(--space-3));
			padding-bottom: var(--space-4);
		}
		.slides {
			grid-column: 1;
			grid-row: 1;
		}
		.controls {
			grid-column: 2;
			grid-row: 1;
			margin-top: 0;
		}
		.title-box {
			min-height: 4rem;
		}
		.logo {
			height: 4rem;
		}
		.title {
			font-size: var(--type-headline);
		}
		.overview {
			-webkit-line-clamp: 2;
			line-clamp: 2;
			max-width: 32rem;
		}
		.actions {
			margin-top: var(--space-3);
		}
	}
	@keyframes progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
</style>
