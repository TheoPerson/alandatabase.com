<script lang="ts">
	import PosterCard from '$lib/components/ui/poster-card';
	import VisibilityBadge from './visibility-badge.svelte';
	import { LIST_PREVIEW_LIMIT, previewCountLabel } from './list-form';

	interface Props {
		id: string;
		name: string;
		description?: string | null;
		isPublic: boolean;
		/** The first films of the list, as the index loader sends them. */
		films: { id: string; title: string; posterPath: string | null }[];
	}

	let { id, name, description = null, isPublic, films }: Props = $props();

	const slots = $derived(Array.from({ length: LIST_PREVIEW_LIMIT }, (_, index) => films[index]));
</script>

<a class="list-card" href={`/my/lists/${id}`} data-sveltekit-preload-data="hover">
	<div class="thumbs" aria-hidden="true">
		{#each slots as film, index (film?.id ?? `slot-${index}`)}
			<div class="thumb">
				{#if film}
					<PosterCard
						id={film.id}
						title={film.title}
						posterPath={film.posterPath}
						sizes="(min-width: 1024px) 90px, 22vw"
					/>
				{:else}
					<span class="slot"></span>
				{/if}
			</div>
		{/each}
	</div>
	<div class="body">
		<h2 class="name">{name}</h2>
		{#if description}<p class="description">{description}</p>{/if}
		<p class="meta">
			<span>{previewCountLabel(films.length)}</span>
			<VisibilityBadge {isPublic} />
		</p>
	</div>
</a>

<style>
	.list-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		height: 100%;
		padding: var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition:
			border-color var(--duration-fast) var(--ease-standard),
			background-color var(--duration-fast) var(--ease-standard);
	}
	.list-card:hover {
		border-color: var(--border-strong);
		background: var(--surface-interactive);
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.thumb {
		min-width: 0;
	}
	.thumb :global(.card) {
		--card-width: 100%;
	}
	.slot {
		display: block;
		aspect-ratio: 2 / 3;
		border-radius: var(--radius-md);
		background: var(--surface-subtle);
		border: 1px solid var(--border-subtle);
	}
	.body {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.name {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
	}
	.description {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		.list-card {
			transition: none;
		}
	}
</style>
