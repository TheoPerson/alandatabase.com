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
	<a {href} class="btn {variant} {size} {customClass}" class:disabled>
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
		transition: all var(--transition-fast);
		cursor: pointer;
		white-space: nowrap;
	}

	.btn.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	/* Sizes */
	.sm {
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
		background: #10b981;
		color: #050507;
		font-weight: 800;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
	}

	.primary:hover {
		background: #34d399;
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
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.4);
	}

	.outline:hover {
		background: rgba(16, 185, 129, 0.12);
		border-color: #10b981;
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
</style>
