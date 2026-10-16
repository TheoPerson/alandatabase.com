<script lang="ts">
	import type { PosterItem } from '$lib/catalogue/items';
	import { posterSrcSet } from '$lib/tmdb/images';
	import { formatRating, formatYear } from '$lib/format';
	import RatingBadge from '../rating-badge/rating-badge.svelte';

	// Without `href` the card is a plain frame (the detail header's poster).
	interface Props extends Omit<PosterItem, 'href'> {
		href?: string;
		rank?: number | null;
		eager?: boolean;
		sizes?: string;
		class?: string;
	}

	let {
		href = undefined,
		title,
		posterPath,
		releaseDate = null,
		rating = null,
		genre = null,
		ratingSource = 'TMDB',
		rank = null,
		eager = false,
		sizes = '(min-width: 1024px) 180px, (min-width: 640px) 160px, 140px',
		class: className = ''
	}: Props = $props();

	const image = $derived(posterSrcSet(posterPath));
	const year = $derived(formatYear(releaseDate));
	const score = $derived(formatRating(rating));
	let loaded = $state(false);
	// A broken artwork URL shows the titled fallback instead of an empty frame.
	let failed = $state(false);
</script>

{#snippet body()}
	{#if rank !== null}<span class="rank" aria-hidden="true">{rank}</span>{/if}
	<div
		class="frame"
		style:background-image={image && !failed ? `url(${image.placeholder})` : undefined}
	>
		{#key image?.src}
			{#if image && !failed}
				<img
					src={image.src}
					srcset={image.srcset || undefined}
					{sizes}
					alt=""
					width="342"
					height="513"
					loading={eager ? 'eager' : 'lazy'}
					fetchpriority={eager ? 'high' : undefined}
					decoding="async"
					class:loaded
					onload={() => (loaded = true)}
					onerror={() => (failed = true)}
				/>
			{:else}
				<span class="fallback" aria-hidden="true">{title}</span>
			{/if}
		{/key}
		{#if score}<RatingBadge value={score} source={ratingSource} class="badge" />{/if}
		{#if href}
			<div class="overlay" aria-hidden="true">
				<span class="overlay-title">{title}</span>
				{#if year || genre}<span class="overlay-meta"
						>{[year, genre].filter(Boolean).join(' · ')}</span
					>{/if}
			</div>
		{/if}
	</div>
	{#if href}
		<span class="title">{title}</span>
		{#if year}<span class="meta">{year}</span>{/if}
	{/if}
	{#if rank !== null}<span class="sr-only">Rank {rank}</span>{/if}
{/snippet}

{#if href}
	<a
		{href}
		class="card {className}"
		class:ranked={rank !== null}
		class:wide={rank !== null && rank >= 10}
		data-sveltekit-preload-data="hover"
	>
		{@render body()}
	</a>
{:else}
	<div class="card frame-only {className}" role="img" aria-label={`Poster: ${title}`}>
		{@render body()}
	</div>
{/if}

<style>
	.card {
		--card-width: clamp(140px, 42vw, 180px);
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: var(--card-width);
		border-radius: var(--radius-md);
		outline-offset: 4px;
	}
	/* The rank numeral lives in extra padding so the poster keeps its full width. */
	.ranked {
		--rank-gutter: 2.6rem;
		padding-left: var(--rank-gutter);
		width: calc(var(--card-width) + var(--rank-gutter));
	}
	.wide {
		--rank-gutter: 4.4rem;
	}
	.wide .rank {
		font-size: clamp(3.4rem, 9vw, 4.6rem);
		letter-spacing: -0.12em;
	}
	.rank {
		position: absolute;
		left: -0.1rem;
		bottom: 2.6rem;
		z-index: 1;
		font-size: clamp(4.5rem, 12vw, 6.5rem);
		font-weight: 900;
		line-height: 0.8;
		letter-spacing: -0.08em;
		color: var(--surface-canvas);
		-webkit-text-stroke: 2px var(--content-secondary);
		pointer-events: none;
	}
	.frame {
		position: relative;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised) center / cover no-repeat;
		box-shadow: var(--elevation-1);
		transition:
			transform var(--duration-base) var(--ease-spring),
			box-shadow var(--duration-base) var(--ease-out);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--duration-slow) var(--ease-out);
	}
	img.loaded {
		opacity: 1;
	}
	.fallback {
		display: grid;
		place-items: center;
		height: 100%;
		padding: var(--space-3);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 700;
		text-align: center;
	}
	.frame :global(.badge) {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
	}
	.overlay {
		position: absolute;
		inset: auto 0 0 0;
		padding: 2.5rem 0.75rem 0.75rem;
		background: linear-gradient(to top, rgba(8, 9, 11, 0.92), transparent);
		opacity: 0;
		transform: translateY(8px);
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}
	.overlay-title {
		display: block;
		font-weight: 800;
		font-size: var(--text-sm);
		line-height: 1.2;
	}
	.overlay-meta {
		display: block;
		margin-top: 0.2rem;
		color: var(--content-secondary);
		font-size: var(--text-xs);
	}
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.meta {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	/* A link-less frame fills whatever width its parent gives it and never lifts. */
	.frame-only {
		--card-width: 100%;
	}
	.frame-only .frame {
		box-shadow: var(--elevation-3);
	}
	@media (hover: hover) {
		a.card:hover .frame,
		a.card:focus-visible .frame {
			transform: translateY(-6px) scale(1.03);
			box-shadow: var(--elevation-3);
		}
		a.card:hover .overlay,
		a.card:focus-visible .overlay {
			opacity: 1;
			transform: translateY(0);
		}
	}
	a.card:active .frame {
		transform: scale(0.98);
	}
</style>
