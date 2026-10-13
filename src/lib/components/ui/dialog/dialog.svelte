<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		open: boolean;
		label: string;
		/** `center` is a card; `fullscreen` is a black canvas that also hides the bottom tab bar. */
		variant?: 'center' | 'fullscreen';
		onclose?: () => void;
		class?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		label,
		variant = 'center',
		onclose,
		class: className = '',
		children
	}: Props = $props();

	$effect(() => {
		if (variant !== 'fullscreen') return;
		document.documentElement.toggleAttribute('data-player-open', open);
		return () => document.documentElement.removeAttribute('data-player-open');
	});
</script>

<Dialog.Root
	bind:open
	onOpenChange={(next) => {
		if (!next) onclose?.();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="kit-dialog-overlay" />
		<Dialog.Content class="kit-dialog {variant} {className}" trapFocus preventScroll>
			<Dialog.Title class="kit-dialog-title" level={2}>{label}</Dialog.Title>
			{#if variant === 'center'}
				<Dialog.Close class="kit-dialog-close" aria-label="Close"><XIcon size={20} /></Dialog.Close>
			{/if}
			{@render children()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.kit-dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(0, 0, 0, 0.7);
		animation: kit-dialog-fade var(--duration-slow) var(--ease-out) both;
	}
	:global(.kit-dialog) {
		position: fixed;
		z-index: calc(var(--z-sheet) + 1);
		background: var(--surface-raised);
		color: var(--content-primary);
		outline: none;
		animation: kit-dialog-fade var(--duration-slow) var(--ease-out) both;
	}
	:global(.kit-dialog.center) {
		left: 50%;
		top: 50%;
		width: min(92vw, 32rem);
		max-height: 85dvh;
		overflow: auto;
		padding: var(--space-6) var(--space-5) var(--space-5);
		border-radius: var(--radius-xl);
		box-shadow: var(--elevation-3);
		transform: translate(-50%, -50%);
	}
	:global(.kit-dialog.fullscreen) {
		inset: 0;
		display: flex;
		flex-direction: column;
		background: #000;
	}
	/* The label names the dialog for assistive technology; the content shows its own heading. */
	:global(.kit-dialog-title) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global(.kit-dialog-close) {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-secondary);
		transition: background-color var(--duration-fast) var(--ease-out);
	}
	:global(.kit-dialog-close:hover) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-primary);
	}
	:global(.kit-dialog-close:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	@keyframes kit-dialog-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-dialog-overlay),
		:global(.kit-dialog) {
			animation-duration: 1ms;
		}
	}
</style>
