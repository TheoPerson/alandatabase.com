<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { railScrollTarget } from './scroll';

	interface Props {
		label: string;
		class?: string;
		children?: Snippet;
	}

	let { label, class: className = '', children }: Props = $props();

	let scroller = $state<HTMLDivElement>();
	let atStart = $state(true);
	let atEnd = $state(false);

	function measure() {
		if (!scroller) return;
		atStart = scroller.scrollLeft <= 1;
		atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
	}

	function scroll(direction: 1 | -1) {
		if (!scroller) return;
		scroller.scrollTo({
			left: railScrollTarget(
				scroller.scrollLeft,
				scroller.clientWidth,
				scroller.scrollWidth,
				direction
			),
			// An explicit 'smooth' would override the reduced-motion rule in app.css.
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	$effect(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (scroller) observer.observe(scroller);
		return () => observer.disconnect();
	});
</script>

<div class="rail {className}">
	<div
		bind:this={scroller}
		class="scroller"
		role="group"
		aria-label={label}
		tabindex="0"
		onscroll={measure}
	>
		{@render children?.()}
	</div>
	<button
		type="button"
		class="arrow left"
		aria-label="Scroll {label} backwards"
		disabled={atStart}
		onclick={() => scroll(-1)}><ChevronLeftIcon size={22} /></button
	>
	<button
		type="button"
		class="arrow right"
		aria-label="Scroll {label} forwards"
		disabled={atEnd}
		onclick={() => scroll(1)}><ChevronRightIcon size={22} /></button
	>
</div>

<style>
	.rail {
		position: relative;
	}
	.scroller {
		display: flex;
		gap: var(--space-3);
		/* Full bleed, but the first card lines up with the section title and the hero copy. */
		padding-inline: var(--page-inset);
		padding-block: var(--space-2);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--page-inset);
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.scroller > :global(*) {
		flex: 0 0 auto;
		scroll-snap-align: start;
	}
	.arrow {
		position: absolute;
		top: 50%;
		z-index: var(--z-rail-controls);
		display: none;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface-canvas) 82%, transparent);
		color: var(--content-primary);
		box-shadow: var(--elevation-2);
		transform: translateY(-50%);
		opacity: 0;
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.arrow:disabled {
		visibility: hidden;
	}
	.left {
		left: calc(var(--page-inset) - 1.375rem);
	}
	.right {
		right: calc(var(--page-inset) - 1.375rem);
	}
	@media (hover: hover) and (min-width: 1024px) {
		.arrow {
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
		.rail:hover .arrow,
		.rail:focus-within .arrow {
			opacity: 1;
		}
		.arrow:hover {
			transform: translateY(-50%) scale(1.06);
		}
	}
</style>
