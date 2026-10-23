<script lang="ts">
	import PosterCard from '$lib/components/ui/poster-card';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { PosterItem } from '$lib/catalogue/items';

	interface Props {
		items: PosterItem[];
		/** Skeleton cards drawn after the films, the size of a poster card (loading). */
		placeholders?: number;
		/** Films whose artwork loads eagerly: the ones in the first screen. */
		eagerCount?: number;
		label: string;
	}

	let { items, placeholders = 0, eagerCount = 6, label }: Props = $props();

	// Mirrors the grid below: three columns on a phone, about five on a tablet, 180px+ on desktop.
	const sizes = '(min-width: 1024px) 200px, (min-width: 640px) 20vw, 31vw';
</script>

<ul class="grid" aria-label={label}>
	{#each items as item, index (item.id)}
		<li>
			<PosterCard {...item} eager={index < eagerCount} {sizes} />
		</li>
	{/each}
	{#each { length: placeholders }, index (index)}
		<li class="placeholder" aria-hidden="true">
			<Skeleton height="auto" borderRadius="var(--radius-md)" class="poster" />
			<Skeleton width="80%" height="0.875rem" class="line" />
			<Skeleton width="30%" height="0.75rem" class="line" />
		</li>
	{/each}
</ul>

<style>
	.grid {
		/* Three posters across a phone (about 128px at 440), the density of a TV app. */
		--min-column: 7.5rem;
		--gap: var(--space-3);
		display: grid;
		/* Never fewer than two columns, even at 320px: the minimum never exceeds half the row. */
		grid-template-columns: repeat(
			auto-fill,
			minmax(min(var(--min-column), calc((100% - var(--gap)) / 2)), 1fr)
		);
		gap: var(--space-5) var(--gap);
		max-width: var(--container-wide);
		margin-inline: auto;
		padding-inline: var(--page-gutter);
		list-style: none;
	}
	@media (min-width: 1024px) {
		.grid {
			--min-column: 180px;
			--gap: var(--space-5);
		}
	}
	/* Cards fill their cell; the kit card is sized for rails. */
	.grid :global(.card) {
		--card-width: 100%;
	}
	.placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.placeholder :global(.poster) {
		aspect-ratio: 2 / 3;
	}
	.placeholder :global(.line) {
		margin-top: 0.15rem;
	}
</style>
