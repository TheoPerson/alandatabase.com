<script lang="ts">
	import Skeleton from './Skeleton.svelte';

	interface Props {
		label?: string;
		rows?: number;
	}

	let { label = 'Loading content', rows = 3 }: Props = $props();
</script>

<div class="loading-state" role="status" aria-live="polite">
	<span class="sr-only">{label}</span>
	{#each Array(Math.max(1, Math.min(rows, 8))) as _}
		<Skeleton height="1rem" />
	{/each}
</div>

<style>
	.loading-state {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
</style>
