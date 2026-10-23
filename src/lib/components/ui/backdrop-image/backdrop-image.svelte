<script lang="ts">
	import { backdropSrcSet } from '$lib/tmdb/images';

	interface Props {
		path: string | null | undefined;
		alt?: string;
		eager?: boolean;
		sizes?: string;
		/** Blur-up fade and settle on load; off when something else must be the first paint. */
		animate?: boolean;
		/** `auto` follows `eager`; `low` yields the network to another LCP candidate. */
		priority?: 'auto' | 'high' | 'low';
		class?: string;
	}

	let {
		path,
		alt = '',
		eager = false,
		sizes = '100vw',
		animate = true,
		priority = 'auto',
		class: className = ''
	}: Props = $props();

	const image = $derived(backdropSrcSet(path));
	const fetchPriority = $derived(priority === 'auto' ? (eager ? 'high' : undefined) : priority);
	let loaded = $state(false);
</script>

{#if image}
	{#key image.src}
		<div class="backdrop {className}" style:background-image={`url(${image.placeholder})`}>
			<img
				src={image.src}
				srcset={image.srcset || undefined}
				{sizes}
				{alt}
				loading={eager ? 'eager' : 'lazy'}
				fetchpriority={fetchPriority}
				decoding="async"
				class:loaded
				class:static={!animate}
				onload={() => (loaded = true)}
			/>
		</div>
	{/key}
{/if}

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--surface-subtle) center / cover no-repeat;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transform: scale(1.04);
		transition:
			opacity var(--duration-slow) var(--ease-out),
			transform 1.2s var(--ease-out);
	}
	img.loaded {
		opacity: 1;
		transform: scale(1);
	}
	img.static {
		opacity: 1;
		transform: none;
		transition: none;
	}
</style>
