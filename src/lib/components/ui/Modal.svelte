<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title?: string;
		onclose: () => void;
		children?: Snippet;
	}

	let { open = $bindable(false), title, onclose, children }: Props = $props();

	let modalCardRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (!open) return;
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		tick().then(() => {
			const firstFocusable = modalCardRef?.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			(firstFocusable ?? modalCardRef)?.focus();
		});

		return () => {
			document.body.style.overflow = previousOverflow;
			previouslyFocused?.focus();
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
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
		role="presentation"
		onclick={(event) => event.currentTarget === event.target && onclose()}
	>
		<div
			bind:this={modalCardRef}
			class="modal-card"
			transition:scale={{ duration: 150, start: 0.95 }}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			aria-label={title ? undefined : 'Dialog'}
		>
			<div class="modal-header">
				{#if title}
					<h3 id="modal-title">{title}</h3>
				{/if}
				<button type="button" class="close-btn" onclick={onclose} aria-label="Close modal">
					Close
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
		padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
	}

	.modal-card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 500px;
		max-height: min(88dvh, 48rem);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
		overflow: auto;
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
		min-width: var(--touch-target);
		min-height: var(--touch-target);
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
