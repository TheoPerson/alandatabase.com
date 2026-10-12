<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HeroItem } from '$lib/catalogue/items';
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
	}

	let { items, intervalMs = 8000, actions }: Props = $props();

	let index = $state(0);
	let paused = $state(false);
	let pointerStartX: number | null = null;

	const current = $derived(items[index] ?? null);
	const count = $derived(items.length);
	const logo = $derived(logoSrcSet(current?.logoPath));
	const meta = $derived(
		current
			? [
					formatRating(current.rating) ? `★ ${formatRating(current.rating)}` : null,
					formatYear(current.releaseDate),
					formatRuntime(current.runtime),
					...(current.genres ?? []).slice(0, 3)
				]
			: []
	);

	function goTo(target: number) {
		index = target;
	}

	$effect(() => {
		// Preload the next backdrop so the switch never shows a blank frame.
		const next = items[nextIndex(index, count)];
		const set = backdropSrcSet(next?.backdropPath);
		if (set && typeof Image !== 'undefined') {
			const preload = new Image();
			preload.src = set.src;
		}
	});

	$effect(() => {
		if (count <= 1 || paused) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
		aria-roledescription="carousel"
		aria-label="Featured titles"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={() => (pointerStartX = null)}
	>
		<BackdropImage path={current.backdropPath} eager={index === 0} sizes="100vw" />
		<div class="scrim" aria-hidden="true"></div>

		<div class="content" aria-live="polite">
			{#key current.id}
				<div class="text">
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
						<h1 class="sr-only">{current.title}</h1>
					{:else}
						<h1 class="title">{current.title}</h1>
					{/if}
					<MetaChips items={meta} class="meta" />
					{#if current.overview}<p class="overview">{current.overview}</p>{/if}
					{#if actions}<div class="actions">{@render actions(current)}</div>{/if}
				</div>
			{/key}
		</div>

		{#if count > 1}
			<div class="dots" role="tablist" aria-label="Choose featured title">
				{#each items as item, dotIndex (item.id)}
					<button
						type="button"
						role="tab"
						class="dot"
						class:active={dotIndex === index}
						aria-selected={dotIndex === index}
						aria-label={item.title}
						onclick={() => goTo(dotIndex)}
					>
						<span class="dot-fill" style:animation-duration={`${intervalMs}ms`}></span>
					</button>
				{/each}
			</div>
		{/if}
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
			align-items: center;
		}
	}
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 0%, rgba(8, 9, 11, 0.55) 40%, transparent 75%),
			linear-gradient(to right, rgba(8, 9, 11, 0.9) 0%, rgba(8, 9, 11, 0.35) 55%, transparent 100%);
	}
	.content {
		position: relative;
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-7);
	}
	.text {
		max-width: 44rem;
		animation: rise var(--duration-slow) var(--ease-out) both;
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
	.logo {
		display: block;
		width: min(70vw, 420px);
		max-height: 160px;
		object-fit: contain;
		object-position: left bottom;
		margin-bottom: var(--space-4);
		filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.6));
	}
	.title {
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
	}
	.text :global(.meta) {
		margin-top: var(--space-3);
		color: var(--content-primary);
	}
	.overview {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 36rem;
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: 1.55;
	}
	@media (max-width: 639px) {
		.overview {
			-webkit-line-clamp: 2;
		}
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-5);
	}
	.dots {
		position: absolute;
		right: var(--page-gutter);
		bottom: var(--space-4);
		display: flex;
		gap: 0.4rem;
	}
	.dot {
		width: 2rem;
		height: var(--touch-target);
		display: flex;
		align-items: center;
	}
	.dot-fill {
		display: block;
		width: 100%;
		height: 3px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.25);
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
	.hero:hover .dot.active .dot-fill::after,
	.hero:focus-within .dot.active .dot-fill::after {
		animation-play-state: paused;
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
