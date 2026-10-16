<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Button from '$lib/components/ui/button';
	import PosterCard from '$lib/components/ui/poster-card';
	import { addToast } from '$lib/stores/toast';
	import type { PosterItem } from '$lib/catalogue/items';
	import TrashIcon from 'lucide-svelte/icons/trash-2';

	// The owner's version of PosterGrid: the same grid, plus a Remove control per film.
	interface Props {
		items: PosterItem[];
		label: string;
		eagerCount?: number;
		/** Called when the last film is removed, so the page can place focus. */
		onemptied?: () => void;
	}

	let { items, label, eagerCount = 6, onemptied }: Props = $props();

	const sizes = '(min-width: 1024px) 200px, (min-width: 640px) 25vw, 45vw';
	const pending = new SvelteSet<string>();
	let grid = $state<HTMLUListElement | null>(null);

	// Removing a film drops its button from the page: move focus to the next one.
	async function focusAfter(index: number) {
		await tick();
		const buttons = grid?.querySelectorAll<HTMLButtonElement>('button[data-remove]') ?? [];
		if (buttons.length > 0) buttons[Math.min(index, buttons.length - 1)].focus();
		else onemptied?.();
	}

	// enhance keeps the first callback it gets, so the position is read when the form is sent.
	function remove(item: PosterItem): SubmitFunction {
		return () => {
			const index = items.findIndex((entry) => entry.id === item.id);
			pending.add(item.id);
			return async ({ result, update }) => {
				try {
					if (result.type === 'success') {
						await update();
						addToast(`Removed “${item.title}” from this list`, 'success');
						await focusAfter(index);
					} else if (result.type === 'redirect') {
						await update();
					} else {
						const reason =
							result.type === 'failure' && typeof result.data?.error === 'string'
								? result.data.error
								: null;
						addToast(
							reason ? `Could not remove “${item.title}”: ${reason}` : 'Could not remove the film.',
							'error'
						);
					}
				} finally {
					pending.delete(item.id);
				}
			};
		};
	}
</script>

<ul class="grid" aria-label={label} bind:this={grid}>
	{#each items as item, index (item.id)}
		<li>
			<PosterCard {...item} eager={index < eagerCount} {sizes} />
			<form method="POST" action="?/removeItem" class="remove" use:enhance={remove(item)}>
				<input type="hidden" name="movieId" value={item.id} />
				<Button
					type="submit"
					variant="ghost"
					loading={pending.has(item.id)}
					aria-label={`Remove ${item.title} from this list`}
					data-remove
				>
					{#if !pending.has(item.id)}<TrashIcon size={16} aria-hidden="true" />{/if}
					{pending.has(item.id) ? 'Removing' : 'Remove'}
				</Button>
			</form>
		</li>
	{/each}
</ul>

<style>
	/* Same layout as browse/poster-grid.svelte, so owners and visitors see one grid. */
	.grid {
		--min-column: 140px;
		--gap: var(--space-3);
		display: grid;
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
	li {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.grid :global(.card) {
		--card-width: 100%;
	}
	.remove :global(.btn) {
		width: 100%;
		justify-content: flex-start;
		padding-inline: var(--space-2);
		color: var(--content-secondary);
	}
	.remove :global(.btn:hover) {
		color: var(--content-primary);
	}
</style>
