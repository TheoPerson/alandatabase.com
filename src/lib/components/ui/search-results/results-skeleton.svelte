<script lang="ts">
	import Skeleton from '../Skeleton.svelte';
	import ResultsGrid from './results-grid.svelte';

	interface Props {
		count?: number;
	}

	let { count = 12 }: Props = $props();
</script>

<!-- Same grid and poster ratio as the results, so the swap to real cards does not jump. -->
<ResultsGrid>
	{#each Array.from({ length: count }, (_, index) => index) as index (index)}
		<div class="cell" aria-hidden="true">
			<div class="poster">
				<Skeleton height="100%" borderRadius="var(--radius-md)" />
			</div>
			<Skeleton height="0.9rem" width="78%" />
			<Skeleton height="0.7rem" width="28%" />
		</div>
	{/each}
</ResultsGrid>

<style>
	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.poster {
		aspect-ratio: 2 / 3;
	}
</style>
