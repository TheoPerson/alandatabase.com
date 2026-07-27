<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title?: string;
		onclose: () => void;
		children?: Snippet;
	}

	let { open = $bindable(false), title, onclose, children }: Props = $props();

	let modalCardRef = $state<HTMLDivElement | null>(null);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
		if (e.key === 'Tab' && modalCardRef) {
			const focusables = modalCardRef.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				last.focus();
				e.preventDefault();
			} else if (!e.shiftKey && document.activeElement === last) {
				first.focus();
				e.preventDefault();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		role="button"
		tabindex="0"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
	>
		<div
			bind:this={modalCardRef}
			class="modal-card"
			transition:scale={{ duration: 150, start: 0.95 }}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				{#if title}
					<h3 id="modal-title">{title}</h3>
				{/if}
				<button type="button" class="close-btn" onclick={onclose} aria-label="Close modal">
					✕
				</button>
			</div>

			<div class="modal-body">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(7, 8, 11, 0.8);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.modal-card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 500px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.modal-header h3 {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.close-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface-2);
	}

	.modal-body {
		padding: 1.5rem;
	}
</style>
