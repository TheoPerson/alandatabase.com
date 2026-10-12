<script lang="ts">
	import type { PosterItem } from '$lib/catalogue/items';
	import Rail from '../rail/rail.svelte';
	import PosterCard from '../poster-card/poster-card.svelte';

	interface Props {
		label: string;
		items: PosterItem[];
	}
	let { label, items }: Props = $props();
</script>

<Rail {label}>
	{#each items as item, index (item.id)}
		<PosterCard {...item} rank={index + 1} eager={index < 3} />
	{/each}
</Rail>
