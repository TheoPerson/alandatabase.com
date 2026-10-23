<script lang="ts">
	import Button from '$lib/components/ui/button';
	import { posterSrcSet } from '$lib/tmdb/images';
	import ListPlusIcon from 'lucide-svelte/icons/list-plus';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import { LIST_STARTERS } from './list-form';

	interface Props {
		/** A few posters from the viewer's own watchlist; the fan is left out when empty. */
		posters?: { id: string; title: string; posterPath: string }[];
	}

	let { posters = [] }: Props = $props();

	const fan = $derived(
		posters
			.map((poster) => ({ ...poster, image: posterSrcSet(poster.posterPath) }))
			.filter((poster) => poster.image)
	);
</script>

<section class="empty" aria-labelledby="lists-empty-title">
	{#if fan.length >= 3}
		<div class="fan" aria-hidden="true" style:--count={fan.length}>
			{#each fan as poster, index (poster.id)}
				<img
					class="poster"
					style:--i={index - (fan.length - 1) / 2}
					src={poster.image?.src}
					srcset={poster.image?.srcset || undefined}
					sizes="120px"
					alt=""
					loading="lazy"
					decoding="async"
				/>
			{/each}
		</div>
	{:else}
		<span class="mark" aria-hidden="true"><ListPlusIcon size={26} /></span>
	{/if}

	<h2 id="lists-empty-title">Your first list starts here</h2>
	<p>
		Group films your way: a director’s run, a rainy-Sunday shortlist, the ones to show a friend.
	</p>
	<Button href="/my/lists/create" size="lg">
		<PlusIcon size={18} aria-hidden="true" />
		Create list
	</Button>

	<div class="starters">
		<p class="starters-label" id="starters-label">Or start from an idea</p>
		<ul aria-labelledby="starters-label">
			{#each LIST_STARTERS as starter (starter.name)}
				<li><a class="starter" href={starter.href}>{starter.name}</a></li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.empty {
		position: relative;
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		max-width: var(--container-content);
		padding: var(--space-7) var(--space-5);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background:
			radial-gradient(80% 60% at 50% 0%, var(--brand-muted), transparent 70%), var(--surface-raised);
		text-align: center;
	}
	.fan {
		position: relative;
		width: 100%;
		height: 9.5rem;
		margin-bottom: var(--space-2);
	}
	.poster {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 6rem;
		aspect-ratio: 2 / 3;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--elevation-2);
		object-fit: cover;
		background: var(--surface-overlay);
		transform-origin: 50% 120%;
		transform: translateX(calc(-50% + var(--i) * 3.25rem)) rotate(calc(var(--i) * 7deg))
			translateY(calc(max(var(--i), -1 * var(--i)) * 0.4rem));
		z-index: calc(10 - max(var(--i), -1 * var(--i)));
		opacity: calc(1 - max(var(--i), -1 * var(--i)) * 0.22);
	}
	.mark {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	h2 {
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	p {
		max-width: 34rem;
		color: var(--content-secondary);
	}
	.starters {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
		width: min(100%, 34rem);
	}
	.starters-label {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		list-style: none;
	}
	.starter {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		padding: 0 var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		transition:
			color var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard);
	}
	.starter:hover {
		border-color: var(--brand-border);
		color: var(--content-primary);
	}
	@media (min-width: 768px) {
		.fan {
			height: 11rem;
		}
		.poster {
			width: 7rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.starter {
			transition: none;
		}
	}
</style>
