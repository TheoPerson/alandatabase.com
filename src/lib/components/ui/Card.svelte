<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		class?: string;
		padding?: 'none' | 'sm' | 'md' | 'lg';
	}

	let { children, class: customClass = '', padding = 'md' }: Props = $props();
</script>

<div class="card pad-{padding} {customClass}">
	{@render children?.()}
</div>

<style>
	.card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: border-color var(--transition-fast), transform var(--transition-fast);
	}

	.pad-none { padding: 0; }
	.pad-sm { padding: 0.75rem; }
	.pad-md { padding: 1.5rem; }
	.pad-lg { padding: 2.5rem; }
</style>
