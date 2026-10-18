<script lang="ts">
	import Button from '$lib/components/ui/button';
	import BackLink from '$lib/components/lists/back-link.svelte';
	import ListsEmpty from '$lib/components/lists/lists-empty.svelte';
	import ListCard from '$lib/components/lists/list-card.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';

	let { data } = $props();

	const lists = $derived(
		data.lists.map((list) => ({
			id: list.id,
			name: list.name,
			description: list.description,
			isPublic: list.isPublic,
			films: list.items.map((item) => ({
				id: item.movieId,
				title: item.movie.title,
				posterPath: item.movie.posterPath ?? null
			}))
		}))
	);
	const publicCount = $derived(lists.filter((list) => list.isPublic).length);
</script>

<svelte:head>
	<title>Your lists | Alan's Database</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="lists">
	<header class="head">
		<div>
			<BackLink href="/my/films" label="Library" />
			<h1>Your lists</h1>
			{#if lists.length > 0}
				<p class="summary">
					{lists.length} list{lists.length === 1 ? '' : 's'} · {publicCount} public
				</p>
			{/if}
		</div>
		{#if lists.length > 0}
			<Button href="/my/lists/create" variant="primary">
				<PlusIcon size={18} aria-hidden="true" />
				Create list
			</Button>
		{/if}
	</header>

	{#if lists.length === 0}
		<ListsEmpty posters={data.fan} />
	{:else}
		<ul class="grid" aria-label="Your lists">
			{#each lists as list (list.id)}
				<li><ListCard {...list} /></li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.lists {
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-8);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	.summary {
		margin-top: var(--space-2);
		color: var(--content-secondary);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(20rem, 100%), 1fr));
		gap: var(--space-4);
		list-style: none;
	}
</style>
