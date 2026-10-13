<script lang="ts">
	import { RatingGroup } from 'bits-ui';
	import StarIcon from 'lucide-svelte/icons/star';

	interface Props {
		/** 0.5–5 in half steps, or null when unrated. */
		value: number | null;
		onchange?: (value: number | null) => void;
		name?: string;
		class?: string;
	}

	let {
		value = $bindable(null),
		onchange,
		name = 'Rating',
		class: className = ''
	}: Props = $props();

	// bits-ui counts "no rating" as 0; the app stores null.
	const current = $derived(value ?? 0);

	function update(next: number) {
		const normalized = next > 0 ? Math.round(next * 2) / 2 : null;
		if (normalized === value) return;
		value = normalized;
		onchange?.(normalized);
	}
</script>

<div class="rating {className}">
	<RatingGroup.Root
		value={current}
		onValueChange={update}
		min={0}
		max={5}
		allowHalf
		hoverPreview
		aria-label={name}
		aria-valuetext={(rated) => (rated > 0 ? `${rated} of 5 stars` : 'Not rated')}
		class="kit-rating"
	>
		{#snippet children({ items })}
			{#each items as item (item.index)}
				<RatingGroup.Item index={item.index} class="kit-rating-item">
					{#snippet children({ state })}
						<span class="star" data-state={state}>
							<StarIcon size={28} aria-hidden="true" />
							<span class="fill" aria-hidden="true"
								><StarIcon size={28} fill="currentColor" aria-hidden="true" /></span
							>
						</span>
					{/snippet}
				</RatingGroup.Item>
			{/each}
		{/snippet}
	</RatingGroup.Root>
	<span class="label" aria-live="polite">{value === null ? 'Not rated' : `${value} / 5`}</span>
	{#if value !== null}
		<button type="button" class="clear" onclick={() => update(0)}>Clear</button>
	{/if}
</div>

<style>
	.rating {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
	:global(.kit-rating) {
		display: inline-flex;
		border-radius: var(--radius-md);
		outline-offset: 2px;
	}
	:global(.kit-rating:focus-visible) {
		outline: 2px solid var(--brand-primary);
	}
	:global(.kit-rating-item) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		cursor: pointer;
	}
	.star {
		position: relative;
		display: inline-flex;
		color: var(--content-tertiary);
		transition: transform var(--duration-fast) var(--ease-spring);
	}
	.fill {
		position: absolute;
		inset: 0;
		display: inline-flex;
		color: var(--rating-star);
		clip-path: inset(0 100% 0 0);
		transition: clip-path var(--duration-fast) var(--ease-out);
	}
	.star[data-state='active'] .fill {
		clip-path: inset(0 0 0 0);
	}
	.star[data-state='partial'] .fill {
		clip-path: inset(0 50% 0 0);
	}
	:global(.kit-rating-item:hover) .star {
		transform: scale(1.12);
	}
	.label {
		min-width: 5.5rem;
		margin-left: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.clear {
		min-height: var(--touch-target);
		padding-inline: var(--space-3);
		border-radius: var(--radius-full);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.clear:hover,
	.clear:focus-visible {
		color: var(--content-primary);
	}
	@media (prefers-reduced-motion: reduce) {
		.star,
		.fill {
			transition: none;
		}
	}
</style>
