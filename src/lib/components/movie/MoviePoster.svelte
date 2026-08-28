<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		path: string | null;
		title: string;
		size?: 'w185' | 'w342' | 'w500' | 'original';
		aspectRatio?: string;
		class?: string;
	}

	let {
		path,
		title,
		size = 'w342',
		aspectRatio = '2 / 3',
		class: customClass = ''
	}: Props = $props();

	let loaded = $state(false);
	let error = $state(false);
	let imageElement = $state<HTMLImageElement>();

	const imageUrl = $derived(
		path
			? path.startsWith('http')
				? path
				: `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? '' : '/'}${path}`
			: null
	);

	$effect(() => {
		const currentUrl = imageUrl;
		loaded = false;
		error = false;
		if (!currentUrl) return;

		tick().then(() => {
			if (imageElement?.complete) {
				loaded = imageElement.naturalWidth > 0;
				error = imageElement.naturalWidth === 0;
			}
		});
	});
</script>

<div class="poster-container {customClass}" style="aspect-ratio: {aspectRatio}">
	{#if imageUrl && !error}
		<img
			bind:this={imageElement}
			src={imageUrl}
			alt="{title} Poster"
			loading="lazy"
			decoding="async"
			width="500"
			height="750"
			class="poster-img"
			class:loaded
			onload={() => (loaded = true)}
			onerror={() => (error = true)}
		/>
	{/if}

	{#if !loaded || !imageUrl || error}
		<div class="poster-fallback">
			<span class="fallback-icon">🎬</span>
			<span class="fallback-title">{title}</span>
		</div>
	{/if}
</div>

<style>
	.poster-container {
		position: relative;
		width: 100%;
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}

	.poster-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--transition-normal);
	}

	.poster-img.loaded {
		opacity: 1;
	}

	.poster-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		text-align: center;
		background: linear-gradient(145deg, var(--bg-surface-2), var(--bg-surface-1));
		color: var(--text-tertiary);
	}

	.fallback-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		opacity: 0.6;
	}

	.fallback-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
