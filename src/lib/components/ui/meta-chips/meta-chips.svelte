<script lang="ts">
	interface Props {
		items: Array<string | null | undefined>;
		class?: string;
	}
	let { items, class: className = '' }: Props = $props();
	const visible = $derived(items.filter((item): item is string => Boolean(item)));
</script>

{#if visible.length > 0}
	<ul class="meta {className}">
		{#each visible as item, index (index)}
			<li>{item}</li>
		{/each}
	</ul>
{/if}

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0;
		list-style: none;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.meta li + li::before {
		content: '·';
		margin: 0 0.6rem;
		color: var(--content-tertiary);
	}
</style>
