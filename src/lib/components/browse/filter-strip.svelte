<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';

	// One horizontally scrolling row of filter chips. It scrolls inside itself, never the page,
	// fades where more chips hide, and offers pointer arrows on desktop. Keyboard users get a
	// real tab stop per chip plus the left and right arrow keys.
	interface Props {
		/** Changes whenever the selection changes; the selected chip is then kept in view. */
		selectedKey?: string;
		keepSelectedInView?: boolean;
		children?: Snippet;
	}

	let { selectedKey = '', keepSelectedInView = false, children }: Props = $props();

	let scroller = $state<HTMLDivElement>();
	let track = $state<HTMLDivElement>();
	let atStart = $state(true);
	let atEnd = $state(false);
	let settled = false;

	function reducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function measure() {
		if (!scroller) return;
		atStart = scroller.scrollLeft <= 1;
		atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
	}

	function nudge(direction: 1 | -1) {
		scroller?.scrollBy({
			left: direction * scroller.clientWidth * 0.7,
			behavior: reducedMotion() ? 'auto' : 'smooth'
		});
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !scroller) return;
		const links = [...scroller.querySelectorAll<HTMLAnchorElement>('a[href]')];
		const index = links.indexOf(document.activeElement as HTMLAnchorElement);
		const target = links[index + (event.key === 'ArrowRight' ? 1 : -1)];
		if (index === -1 || !target) return;
		event.preventDefault();
		target.focus();
	}

	$effect(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (scroller) observer.observe(scroller);
		if (track) observer.observe(track);
		return () => observer.disconnect();
	});

	function revealSelected(behavior: ScrollBehavior) {
		const chip = scroller?.querySelector<HTMLElement>('[aria-current="true"]');
		if (!scroller || !chip) return;
		const margin = 16;
		const left = chip.offsetLeft;
		const right = left + chip.offsetWidth;
		const visible =
			left >= scroller.scrollLeft + margin &&
			right <= scroller.scrollLeft + scroller.clientWidth - margin;
		if (!visible) {
			scroller.scrollTo({ left: left - (scroller.clientWidth - chip.offsetWidth) / 2, behavior });
		}
	}

	// A shared link or the Back button can select a chip that is scrolled out of sight.
	$effect(() => {
		void selectedKey;
		if (!keepSelectedInView || !scroller) return;
		revealSelected(settled && !reducedMotion() ? 'smooth' : 'auto');
		// Chips widen when the web font arrives, so the first position is measured again then.
		if (!settled) void document.fonts?.ready.then(() => revealSelected('auto'));
		settled = true;
	});
</script>

<div class="strip" class:can-start={!atStart} class:can-end={!atEnd}>
	<div bind:this={scroller} class="scroller" onscroll={measure} {onkeydown} role="presentation">
		<div bind:this={track} class="track">
			{@render children?.()}
		</div>
	</div>
	<button
		type="button"
		class="arrow start"
		tabindex="-1"
		aria-hidden="true"
		onclick={() => nudge(-1)}
	>
		<ChevronLeftIcon size={18} aria-hidden="true" />
	</button>
	<button type="button" class="arrow end" tabindex="-1" aria-hidden="true" onclick={() => nudge(1)}>
		<ChevronRightIcon size={18} aria-hidden="true" />
	</button>
</div>

<style>
	.strip {
		position: relative;
	}
	.scroller {
		position: relative;
		/* Room for the 2px focus ring and its offset, which overflow would otherwise clip. */
		padding: 5px var(--page-gutter);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		--fade-start: 0px;
		--fade-end: 0px;
		mask-image: linear-gradient(
			to right,
			transparent 0,
			black var(--fade-start),
			black calc(100% - var(--fade-end)),
			transparent 100%
		);
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.can-start .scroller {
		--fade-start: 2rem;
	}
	.can-end .scroller {
		--fade-end: 2rem;
	}
	.track {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: max-content;
	}
	.track > :global(*) {
		flex: 0 0 auto;
	}
	.arrow {
		position: absolute;
		top: 50%;
		z-index: 1;
		display: none;
		width: 2rem;
		height: 2rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
		background: var(--surface-overlay);
		color: var(--content-primary);
		box-shadow: var(--elevation-2);
		transform: translateY(-50%);
		transition:
			background-color var(--duration-base) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.arrow:hover {
		background: var(--surface-interactive);
	}
	.start {
		left: calc(var(--page-gutter) - 0.5rem);
	}
	.end {
		right: calc(var(--page-gutter) - 0.5rem);
	}
	@media (hover: hover) and (pointer: fine) {
		.can-start .start,
		.can-end .end {
			display: inline-flex;
		}
	}
</style>
