<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { getHqpContext } from '../context';
	import { trapFocus } from './a11y';

	// Dialog shell for the settings sheet, the episodes drawer and small sheets (section 7.2).
	// Portrait: floating sheet 8 px from the edges, radius 34/34/54/54, drag down to close.
	// Landscape: right panel min(560px, 60cqw). Large: 600 px panel anchored bottom right.
	// kind 'center': a centred card (help). Thick glass, focus trapped, Esc handled by the player.
	const {
		labelledby,
		kind = 'sheet',
		wide = false,
		parked = false,
		initialFocus,
		header,
		children
	}: {
		labelledby: string;
		kind?: 'sheet' | 'center';
		wide?: boolean;
		/** Built but closed: hidden, inert and out of the accessibility tree (no mount on open). */
		parked?: boolean;
		initialFocus?: string;
		header?: Snippet;
		children: Snippet;
	} = $props();

	const { ui } = getHqpContext();

	let panel: HTMLDivElement;
	let drag: {
		id: number;
		startY: number;
		lastY: number;
		lastT: number;
		v: number;
		height: number;
	} | null = null;
	let dy = $state(0);
	let dragging = $state(false);
	let raf = 0;
	let pendingDy = 0;

	const draggable = $derived(kind === 'sheet' && ui.portrait);

	// Parking after being open plays the close motion (240 ms ease-in) before hiding; a panel built
	// parked never shows. Opening restarts the open animation by dropping data-parked.
	let leaving = $state(false);
	let wasOpen = untrack(() => !parked);
	$effect(() => {
		if (!parked) {
			wasOpen = true;
			leaving = false;
			dy = 0;
			return;
		}
		if (!wasOpen) return;
		wasOpen = false;
		leaving = true;
		const timer = setTimeout(() => (leaving = false), ui.reducedMotion ? 120 : 240);
		return () => clearTimeout(timer);
	});

	function onpointerdown(event: PointerEvent) {
		if (!draggable || event.button > 0) return;
		const target = event.target as Element;
		// Controls keep their own taps (pointer capture would retarget their click).
		if (target.closest('button, [role="slider"], a')) return;
		drag = {
			id: event.pointerId,
			startY: event.clientY,
			lastY: event.clientY,
			lastT: event.timeStamp,
			v: 0,
			height: panel.getBoundingClientRect().height
		};
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	}
	function onpointermove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		const raw = event.clientY - drag.startY;
		const dt = Math.max(1, event.timeStamp - drag.lastT);
		drag.v = (event.clientY - drag.lastY) / dt;
		drag.lastY = event.clientY;
		drag.lastT = event.timeStamp;
		// Follows the finger 1:1 downwards; rubber band 0.35 past the top.
		pendingDy = raw >= 0 ? raw : raw * 0.35;
		dragging = Math.abs(raw) > 4;
		if (!raf)
			raf = requestAnimationFrame(() => {
				raf = 0;
				dy = pendingDy;
			});
	}
	function onpointerup(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		const travelled = event.clientY - drag.startY;
		const close = drag.v > 0.5 || travelled > drag.height * 0.4;
		drag = null;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		dragging = false;
		if (close && travelled > 8) ui.close();
		else dy = 0;
	}

	// Panel close: 240 ms ease-in, no spring (section 10.1).
	function leave(node: HTMLElement) {
		const reduced = ui.reducedMotion;
		const portraitSheet = node.dataset.kind === 'sheet' && ui.portrait;
		return {
			duration: reduced ? 120 : 240,
			easing: (t: number) => t * t,
			css: (t: number) => {
				const u = 1 - t;
				if (reduced) return `opacity: ${t}`;
				if (portraitSheet) return `transform: translateY(${u * 100}%)`;
				if (kind === 'sheet' && ui.layout === 'phone-landscape')
					return `opacity: ${t}; transform: translateX(${u * 24}px)`;
				return `opacity: ${t}; transform: scale(${0.96 + 0.04 * t})`;
			}
		};
	}
</script>

<div
	bind:this={panel}
	class="hqp-panel hqp-glass--thick"
	data-kind={kind}
	data-wide={wide ? '' : undefined}
	data-dragging={dragging ? '' : undefined}
	data-parked={parked ? '' : undefined}
	data-leaving={leaving ? '' : undefined}
	inert={parked}
	aria-hidden={parked ? 'true' : undefined}
	role="dialog"
	aria-modal="true"
	aria-labelledby={labelledby}
	tabindex="-1"
	style:--sheet-dy="{dy}px"
	use:trapFocus={parked ? false : initialFocus}
	out:leave
>
	{#if draggable}
		<div
			class="grab-area"
			data-grab-area
			role="presentation"
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
		>
			<span class="grabber" aria-hidden="true"></span>
			{@render header?.()}
		</div>
	{:else}
		{@render header?.()}
	{/if}
	<div class="body">
		{@render children()}
	</div>
</div>

<style>
	.hqp-panel {
		position: absolute;
		z-index: var(--hqp-z-panel);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--hqp-r-panel);
		outline: none;
		color: var(--hqp-ink);
		translate: 0 var(--sheet-dy, 0px);
		transition: translate var(--hqp-dur-panel) var(--hqp-spring);
	}
	.hqp-panel[data-dragging] {
		transition: none;
	}
	/* Parked (pre-built, closed): laid out once and never painted. Opening only changes visibility
	   and starts the transform animation, so no layout runs in the tap's frame. */
	.hqp-panel[data-parked] {
		visibility: hidden;
		pointer-events: none;
		animation: none !important;
	}
	.hqp-panel[data-parked][data-leaving] {
		visibility: visible;
		animation: hqp-panel-leave 240ms cubic-bezier(0.55, 0, 1, 0.45) both !important;
	}
	:global(.hqp[data-layout^='phone-portrait'])
		.hqp-panel[data-kind='sheet'][data-parked][data-leaving] {
		animation-name: hqp-sheet-leave !important;
	}
	:global(.hqp[data-layout='phone-landscape'])
		.hqp-panel[data-kind='sheet'][data-parked][data-leaving] {
		animation-name: hqp-side-leave !important;
	}
	@keyframes hqp-panel-leave {
		to {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@keyframes hqp-sheet-leave {
		to {
			transform: translateY(100%);
		}
	}
	@keyframes hqp-side-leave {
		to {
			opacity: 0;
			transform: translateX(24px);
		}
	}
	.body {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Portrait floating sheet: concentric with the display corners; fills under the glided frame. */
	:global(.hqp[data-layout^='phone-portrait']) .hqp-panel[data-kind='sheet'] {
		left: 8px;
		right: 8px;
		bottom: 8px;
		top: calc(max(var(--hqp-sa-t), 12px) + var(--frame-h) + 12px);
		border-radius: var(--hqp-r-panel) var(--hqp-r-panel) var(--hqp-r-sheet-bottom)
			var(--hqp-r-sheet-bottom);
		animation: hqp-sheet-up var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	/* Landscape: right panel, island-free (right edge-x). */
	:global(.hqp[data-layout='phone-landscape']) .hqp-panel[data-kind='sheet'] {
		top: 12px;
		bottom: max(12px, var(--hqp-sa-b));
		right: var(--hqp-edge-x);
		width: min(560px, 60cqw);
		animation: hqp-panel-side var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	@media (orientation: landscape) and (max-height: 379px) {
		:global(.hqp[data-layout='phone-landscape']) .hqp-panel[data-kind='sheet'] {
			top: 8px;
			bottom: 8px;
		}
	}
	/* Large: 600 px panel above the bottom bar, growing from the bottom right. */
	:global(.hqp[data-layout='large']) .hqp-panel[data-kind='sheet'] {
		right: var(--hqp-edge-x);
		bottom: 124px;
		width: min(600px, 100cqw - 2 * var(--hqp-edge-x));
		height: min(560px, 100cqh - 196px);
		transform-origin: 100% 100%;
		animation: hqp-panel-pop var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	.hqp-panel[data-kind='center'] {
		inset: 0;
		margin: auto;
		width: min(520px, 100cqw - 32px);
		height: fit-content;
		max-height: min(640px, 100cqh - 32px);
		animation: hqp-panel-pop var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	.hqp-panel[data-kind='center'][data-wide] {
		width: min(760px, 100cqw - 32px);
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-panel[data-kind='center'] {
		max-height: calc(100cqh - var(--hqp-sa-t) - var(--hqp-sa-b) - 32px);
	}

	.grab-area {
		flex: none;
		touch-action: none;
		cursor: grab;
	}
	.grabber {
		display: block;
		width: 40px;
		height: 5px;
		margin: 8px auto 0;
		border-radius: 3px;
		background: var(--hqp-ink-3);
		opacity: 0.6;
	}

	@keyframes hqp-sheet-up {
		from {
			transform: translateY(100%);
		}
	}
	@keyframes hqp-panel-side {
		from {
			opacity: 0;
			transform: translateX(24px);
		}
	}
	@keyframes hqp-panel-pop {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-panel,
		:global(.hqp[data-layout]) .hqp-panel[data-kind] {
			animation: hqp-panel-fade var(--hqp-dur-fade) linear both;
			transition: none;
		}
		.hqp-panel[data-parked][data-leaving],
		:global(.hqp[data-layout]) .hqp-panel[data-kind][data-parked][data-leaving] {
			animation: hqp-panel-fade 120ms linear reverse both !important;
		}
		@keyframes hqp-panel-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
