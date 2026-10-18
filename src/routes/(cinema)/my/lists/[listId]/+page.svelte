<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/button';
	import Dialog from '$lib/components/ui/dialog';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PosterGrid from '$lib/components/browse/poster-grid.svelte';
	import BackLink from '$lib/components/lists/back-link.svelte';
	import ListFilmGrid from '$lib/components/lists/list-film-grid.svelte';
	import VisibilityBadge from '$lib/components/lists/visibility-badge.svelte';
	import { filmCount, toListPosterItem } from '$lib/components/lists/list-form';
	import TrashIcon from 'lucide-svelte/icons/trash-2';
	import CompassIcon from 'lucide-svelte/icons/compass';

	let { data } = $props();
	let confirmDelete = $state(false);
	let deleting = $state(false);
	let filmsHeading = $state<HTMLHeadingElement | null>(null);

	const list = $derived(data.list);
	const isOwner = $derived(data.isOwner === true);
	const owner = $derived(list.user.displayName || list.user.username);
	const films = $derived(list.items.map((item) => toListPosterItem(item.movie)));
	const count = $derived(filmCount(films.length));
</script>

<svelte:head>
	<title>{list.name} | Alan's Database</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="list">
	<div class="page">
		<header class="head">
			<div class="title">
				{#if isOwner}
					<BackLink href="/my/lists" label="Lists" />
				{:else}
					<BackLink href="/my/films" label="Library" />
				{/if}
				<h1>{list.name}</h1>
				<p class="meta">
					<span>By {owner}</span>
					<span aria-hidden="true">·</span>
					<span>{count}</span>
					<VisibilityBadge isPublic={list.isPublic} />
				</p>
				{#if list.description}<p class="description">{list.description}</p>{/if}
			</div>
			{#if isOwner}
				<div class="links">
					<Button variant="outline" onclick={() => (confirmDelete = true)}>
						<TrashIcon size={18} aria-hidden="true" />
						Delete list
					</Button>
				</div>
			{/if}
		</header>

		<h2 class="sr-only" id="films-heading" tabindex="-1" bind:this={filmsHeading}>Films</h2>
	</div>

	{#if films.length === 0}
		<div class="page">
			<EmptyState
				title="This list is empty"
				description={isOwner
					? 'Find films in Browse, then add them to this list from their page.'
					: `${owner} has not added any films yet.`}
			>
				{#snippet action()}
					<Button href="/movies" variant="outline">
						<CompassIcon size={18} aria-hidden="true" />
						Browse movies
					</Button>
				{/snippet}
			</EmptyState>
		</div>
	{:else if isOwner}
		<ListFilmGrid items={films} label={count} onemptied={() => filmsHeading?.focus()} />
	{:else}
		<PosterGrid items={films} label={count} />
	{/if}
</div>

{#if isOwner}
	<Dialog bind:open={confirmDelete} label="Delete this list?">
		<p class="confirm-copy">
			“{list.name}” and its {count} will be removed from your library. The films themselves stay in the
			catalogue. This cannot be undone.
		</p>
		<form
			method="POST"
			action="?/deleteList"
			class="confirm-actions"
			use:enhance={() => {
				deleting = true;
				return async ({ update }) => {
					await update();
					deleting = false;
				};
			}}
		>
			<Button type="button" variant="outline" onclick={() => (confirmDelete = false)}
				>Keep list</Button
			>
			<Button type="submit" variant="danger" loading={deleting}>Delete list</Button>
		</form>
	</Dialog>
{/if}

<style>
	.list {
		padding: var(--space-6) 0 var(--space-8);
	}
	.page {
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding-inline: var(--page-gutter);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	.title {
		min-width: 0;
		max-width: var(--container-reading);
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		color: var(--content-secondary);
	}
	.description {
		margin-top: var(--space-3);
		color: var(--content-secondary);
		line-height: var(--leading-body);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.confirm-copy {
		margin-top: var(--space-3);
		color: var(--content-secondary);
		line-height: 1.5;
	}
	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}
</style>
