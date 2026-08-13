<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'gold' | 'surface' | 'outline' | 'success';
		children?: Snippet;
		class?: string;
	}

	let { variant = 'surface', children, class: customClass = '' }: Props = $props();
</script>

<span class="badge {variant} {customClass}">
	{@render children?.()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: var(--radius-sm);
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.gold {
		background: rgba(16, 185, 129, 0.15);
		color: var(--accent-emerald);
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.surface {
		background: var(--bg-surface-3);
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
	}

	.outline {
		background: transparent;
		color: var(--text-tertiary);
		border: 1px solid var(--border-subtle);
	}

	.success {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}
</style>
