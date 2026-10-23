<script lang="ts">
	import { getHqpContext } from '../context';
	import { fraction } from '../logic/timeline';

	// Double-tap feedback inside the picture (section 6.1): a lens on that side, chevrons lighting in
	// sequence, the accumulated label and an emerald peek line, for 700 ms. Never paints the pillars.
	const { clock, ui } = getHqpContext();
	const ripple = $derived(ui.ripple);
	const label = $derived(
		ripple ? `${ripple.total < 0 ? '−' : '+'}${Math.abs(ripple.total)} s` : ''
	);
	const peek = $derived(ui.peekAt === null ? null : fraction(ui.peekAt, $clock.duration));

	// Out 300 ms (section 10.1); the element's own opacity is the starting point.
	function fadeOut(node: Element) {
		const from = Number(getComputedStyle(node).opacity) || 1;
		return { duration: ui.reducedMotion ? 0 : 300, css: (t: number) => `opacity: ${t * from}` };
	}
</script>

{#if ripple}
	<div class="ripple" data-side={ripple.side} aria-hidden="true" out:fadeOut>
		<div class="lens"></div>
		<div class="content">
			{#key ripple.key}
				<svg class="chevs" viewBox="0 0 54 18" aria-hidden="true">
					<path d="M3 2l12 7-12 7z" />
					<path d="M21 2l12 7-12 7z" />
					<path d="M39 2l12 7-12 7z" />
				</svg>
			{/key}
			<span class="num hqp-tnum">{label}</span>
		</div>
	</div>
{/if}
{#if peek !== null}
	<div class="peek" aria-hidden="true" style:--peek={peek} out:fadeOut><i></i></div>
{/if}

<style>
	.ripple {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40%;
		display: grid;
		place-items: center;
		pointer-events: none;
		z-index: var(--hqp-z-subs);
		animation: hqp-lens 120ms var(--hqp-ease-out) both;
	}
	.ripple[data-side='back'] {
		left: 0;
	}
	.ripple[data-side='forward'] {
		right: 0;
	}
	.lens {
		position: absolute;
		inset: 0;
		background: var(--hqp-ripple);
	}
	.ripple[data-side='back'] .lens {
		border-radius: 0 50% 50% 0 / 0 50% 50% 0;
	}
	.ripple[data-side='forward'] .lens {
		border-radius: 50% 0 0 50% / 50% 0 0 50%;
	}
	.content {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.chevs {
		width: clamp(42px, 12cqh, 64px);
		height: auto;
		fill: var(--hqp-ink);
		filter: var(--hqp-glyph-shadow);
	}
	.ripple[data-side='back'] .chevs {
		scale: -1 1;
	}
	.chevs path {
		opacity: 0.25;
		animation: hqp-chev 420ms var(--hqp-ease-out) both;
	}
	.chevs path:nth-child(2) {
		animation-delay: 90ms;
	}
	.chevs path:nth-child(3) {
		animation-delay: 180ms;
	}
	.num {
		font-size: clamp(17px, 6.4cqh, 30px);
		line-height: 1;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-shadow: 0 1px 10px var(--hqp-scrim-b);
	}
	.peek {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		z-index: var(--hqp-z-subs);
		background: var(--hqp-track);
		pointer-events: none;
	}
	.peek i {
		position: absolute;
		inset: 0;
		background: var(--hqp-accent);
		transform-origin: 0 50%;
		scale: var(--peek) 1;
	}
	@keyframes hqp-lens {
		from {
			opacity: 0;
		}
	}
	@keyframes hqp-chev {
		0% {
			opacity: 0.25;
		}
		40% {
			opacity: 1;
		}
		100% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ripple {
			animation: none;
		}
		.chevs path {
			animation: none;
			opacity: 1;
		}
	}
</style>
