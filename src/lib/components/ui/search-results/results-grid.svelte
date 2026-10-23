<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let { class: className = '', children }: Props = $props();
</script>

<!--
	The Browse grid recipe: auto-fill columns of at least 120px on phones (three across at 440px,
	never fewer than two, even at 320px) and 180px from 1024px up. Cards fill their cell instead of keeping
	their rail width.
-->
<div class="grid {className}">
	{@render children?.()}
</div>

<style>
	.grid {
		--grid-gap: var(--space-3);
		display: grid;
		grid-template-columns: repeat(
			auto-fill,
			minmax(min(7.5rem, calc((100% - var(--grid-gap)) / 2)), 1fr)
		);
		gap: var(--space-5) var(--grid-gap);
	}
	@media (min-width: 1024px) {
		.grid {
			--grid-gap: var(--space-5);
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		}
	}
	.grid :global(.card) {
		--card-width: 100%;
	}
</style>
