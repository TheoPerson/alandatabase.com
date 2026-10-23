<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import PlayIcon from 'lucide-svelte/icons/play';
	import type { ContinueCardItem } from './types';

	interface Props {
		item: ContinueCardItem;
		eager?: boolean;
		class?: string;
	}

	let { item, eager = false, class: className = '' }: Props = $props();

	// w780 is crisp at DPR 3 for a phone-width card (about 260 CSS px wide).
	const image = $derived(tmdbImageUrl(item.stillPath, 'w780'));
	let loaded = $state(false);
	let failed = $state(false);
</script>

<!-- One link for the whole card: the accessible name says what resumes and how much is left. -->
<a
	href={item.href}
	class="card {className}"
	aria-label={item.ariaLabel}
	data-sveltekit-preload-data="hover"
>
	<span class="frame">
		{#if image && !failed}
			<img
				src={image}
				alt=""
				width="780"
				height="439"
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				class:loaded
				onload={() => (loaded = true)}
				onerror={() => (failed = true)}
			/>
		{:else}
			<span class="fallback" aria-hidden="true">{item.title}</span>
		{/if}
		<span class="shade" aria-hidden="true"></span>
		<span class="play" aria-hidden="true"><PlayIcon size={18} fill="currentColor" /></span>
		<span class="track" aria-hidden="true">
			<span class="fill" style:transform={`scaleX(${item.progress})`}></span>
		</span>
	</span>
	<span class="text" aria-hidden="true">
		<span class="eyebrow">{item.eyebrow}</span>
		<span class="title">{item.title}</span>
		<span class="left">{item.remainingLabel}</span>
	</span>
</a>

<style>
	.card {
		--card-width: clamp(232px, 68vw, 300px);
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: var(--card-width);
		border-radius: var(--radius-md);
		outline-offset: 4px;
		-webkit-tap-highlight-color: transparent;
	}
	.frame {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
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
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(8, 9, 11, 0.7), transparent 55%);
	}
	.play {
		position: absolute;
		left: 0.6rem;
		bottom: 0.85rem;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.92);
		color: var(--surface-canvas);
		box-shadow: var(--elevation-2);
		transition: transform var(--duration-base) var(--ease-spring);
	}
	.play :global(svg) {
		margin-left: 2px;
	}
	/* Thin emerald bar on the bottom edge; scale only, so it never triggers layout. */
	.track {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 3px;
		background: rgba(255, 255, 255, 0.22);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--brand-primary);
		transform-origin: left;
	}
	.text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.eyebrow,
	.title,
	.left {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eyebrow {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.title {
		font-size: var(--text-sm);
		font-weight: 800;
	}
	.left {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	@media (hover: hover) {
		.card:hover .frame,
		.card:focus-visible .frame {
			transform: translateY(-4px) scale(1.02);
			box-shadow: var(--elevation-3);
		}
		.card:hover .play,
		.card:focus-visible .play {
			transform: scale(1.08);
		}
	}
	.card:active .frame {
		transform: scale(0.98);
	}
	@media (prefers-reduced-motion: reduce) {
		.frame,
		.play,
		img {
			transition: none;
		}
		.card:hover .frame,
		.card:focus-visible .frame,
		.card:active .frame,
		.card:hover .play,
		.card:focus-visible .play {
			transform: none;
		}
	}
</style>
