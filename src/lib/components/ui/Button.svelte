<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'success';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		type = 'button',
		href,
		onclick,
		children,
		class: customClass = ''
	}: Props = $props();
</script>

{#if href}
	<a
		href={disabled ? undefined : href}
		class="btn {variant} {size} {customClass}"
		class:disabled
		aria-disabled={disabled}
		tabindex={disabled ? -1 : undefined}
	>
		{@render children?.()}
	</a>
{:else}
	<button {type} {disabled} {onclick} class="btn {variant} {size} {customClass}">
		{@render children?.()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		min-height: var(--touch-target);
		border: 1px solid transparent;
		transition:
			background-color var(--transition-fast),
			border-color var(--transition-fast),
			color var(--transition-fast),
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		cursor: pointer;
		white-space: nowrap;
	}

	.btn.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.btn:active:not(.disabled),
	button.btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	/* Sizes */
	.sm {
		min-height: 2.25rem;
		padding: 0.4rem 0.85rem;
		font-size: 0.85rem;
	}

	.md {
		padding: 0.65rem 1.25rem;
		font-size: 0.95rem;
	}

	.lg {
		padding: 0.85rem 1.75rem;
		font-size: 1.05rem;
	}

	/* Variants */
	.primary {
		background: var(--brand-primary);
		color: var(--content-inverse);
		font-weight: 800;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
	}

	.primary:hover {
		background: var(--brand-hover);
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
	}

	.secondary {
		background: var(--bg-surface-3);
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
	}

	.secondary:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--border-strong);
	}

	.ghost {
		background: transparent;
		color: var(--text-secondary);
	}

	.ghost:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
	}

	.outline {
		background: transparent;
		color: var(--brand-primary);
		border-color: var(--brand-border);
	}

	.outline:hover {
		background: var(--brand-muted);
		border-color: var(--brand-primary);
	}

	.success {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.success:hover {
		background: rgba(34, 197, 94, 0.25);
		border-color: rgba(34, 197, 94, 0.5);
	}

	@media (prefers-reduced-motion: reduce) {
		.primary:hover,
		.btn:active:not(.disabled),
		button.btn:active:not(:disabled) {
			transform: none;
		}
	}
</style>
