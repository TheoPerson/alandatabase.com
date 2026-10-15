<script lang="ts">
	import FilmIcon from 'lucide-svelte/icons/film';
	import { tmdbImageUrl } from '$lib/tmdb/images';

	let { posterPath }: { posterPath: string | null } = $props();

	const small = $derived(tmdbImageUrl(posterPath, 'w92'));
	const large = $derived(tmdbImageUrl(posterPath, 'w185'));
	// A broken artwork URL falls back to the icon instead of an empty frame.
	let failed = $state(false);
</script>

<!-- The frame is always 32x48, so rows never shift while artwork loads. -->
<span class="kit-palette-poster" aria-hidden="true">
	{#if small && !failed}
		<img
			src={small}
			srcset={large && large !== small ? `${small} 92w, ${large} 185w` : undefined}
			sizes="32px"
			width="32"
			height="48"
			alt=""
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{:else}
		<FilmIcon size={16} />
	{/if}
</span>

<style>
	:global(.kit-palette-poster) {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 3rem;
		overflow: hidden;
		border-radius: var(--radius-xs);
		background: var(--surface-interactive);
		color: var(--content-tertiary);
	}
	:global(.kit-palette-poster img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
