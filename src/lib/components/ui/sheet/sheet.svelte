<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		open: boolean;
		label: string;
		/** Bottom sheet on phones, right panel on wide screens. */
		side?: 'bottom' | 'right';
		/** Bottom sheet height: half the screen or most of it. */
		detent?: 'medium' | 'large';
		/** Non-modal sheets keep the page interactive (used by the player settings). */
		modal?: boolean;
		/** Keeps Tab inside the sheet; on by default even for non-modal sheets. */
		trapFocus?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		label,
		side = 'bottom',
		detent = $bindable('medium'),
		modal = true,
		trapFocus = true,
		class: className = '',
		children
	}: Props = $props();

	function cycleDetent() {
		if (detent === 'medium') detent = 'large';
		else open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		{#if modal}
			<Dialog.Overlay class="kit-sheet-overlay" />
		{/if}
		<Dialog.Content
			class="kit-sheet {side} {detent} {className}"
			{trapFocus}
			preventScroll={modal}
			interactOutsideBehavior={modal ? 'close' : 'ignore'}
		>
			<header class="head">
				{#if side === 'bottom'}
					<button type="button" class="grabber" aria-label="Resize sheet" onclick={cycleDetent}>
						<span></span>
					</button>
				{/if}
				<Dialog.Title class="kit-sheet-title" level={2}>{label}</Dialog.Title>
				<Dialog.Close class="kit-sheet-close" aria-label="Close"><XIcon size={20} /></Dialog.Close>
			</header>
			<div class="body">{@render children()}</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.kit-sheet-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(0, 0, 0, 0.55);
		animation: kit-sheet-fade var(--duration-slow) var(--ease-out) both;
	}
	:global(.kit-sheet) {
		position: fixed;
		z-index: calc(var(--z-sheet) + 2);
		display: flex;
		flex-direction: column;
		background: var(--surface-overlay);
		color: var(--content-primary);
		box-shadow: var(--elevation-3);
		outline: none;
		overscroll-behavior: contain;
		animation: kit-sheet-slide var(--duration-slow) var(--ease-out) both;
	}
	:global(.kit-sheet.bottom) {
		left: 0;
		right: 0;
		bottom: 0;
		height: 50svh;
		max-height: min(85svh, calc(100% - env(safe-area-inset-top, 0px)));
		padding-bottom: var(--safe-bottom);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		--kit-sheet-from: translateY(24px);
	}
	:global(.kit-sheet.bottom.large) {
		height: min(85svh, calc(100% - env(safe-area-inset-top, 0px)));
	}
	:global(.kit-sheet.right) {
		top: 0;
		right: 0;
		bottom: 0;
		width: clamp(320px, 36vw, 440px);
		padding-top: var(--safe-top);
		--kit-sheet-from: translateX(24px);
	}
	.head {
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-5) var(--space-2);
	}
	.grabber {
		display: flex;
		justify-content: center;
		width: 100%;
		height: 3rem;
		margin-top: calc(-1 * var(--space-3));
		cursor: grab;
	}
	.grabber span {
		width: 2.5rem;
		height: 4px;
		margin-top: 0.6rem;
		border-radius: var(--radius-full);
		background: var(--content-tertiary);
	}
	.grabber:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: -4px;
		border-radius: var(--radius-md);
	}
	:global(.kit-sheet-title) {
		padding-right: var(--touch-target);
		font-size: var(--type-title);
		font-weight: 800;
	}
	:global(.kit-sheet-close) {
		position: absolute;
		top: var(--space-2);
		right: var(--space-3);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-secondary);
	}
	:global(.kit-sheet.bottom .kit-sheet-close) {
		top: var(--space-4);
	}
	:global(.kit-sheet-close:hover) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-primary);
	}
	:global(.kit-sheet-close:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0 var(--space-5) var(--space-5);
	}
	@keyframes kit-sheet-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes kit-sheet-slide {
		from {
			opacity: 0;
			transform: var(--kit-sheet-from, translateY(24px));
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-sheet-overlay),
		:global(.kit-sheet) {
			animation: kit-sheet-fade 1ms both;
		}
	}
</style>
