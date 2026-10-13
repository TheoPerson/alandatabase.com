<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';

	interface Props {
		providerName: string;
		logoPath: string | null;
		/** The region's JustWatch page on TMDB; without it the tile is static. */
		href: string | null;
	}

	let { providerName, logoPath, href }: Props = $props();

	const src = $derived(tmdbImageUrl(logoPath, 'w92'));
	const initials = $derived(
		providerName
			.split(/\s+/u)
			.slice(0, 2)
			.map((part) => part[0] ?? '')
			.join('')
			.toUpperCase()
	);
	let failed = $state(false);
</script>

{#snippet tile()}
	{#if src && !failed}
		<img
			{src}
			alt={providerName}
			width="44"
			height="44"
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span class="initials" aria-hidden="true">{initials}</span>
		<span class="sr-only">{providerName}</span>
	{/if}
{/snippet}

{#if href}
	<a {href} class="provider" target="_blank" rel="noopener" title={providerName}>
		{@render tile()}
	</a>
{:else}
	<span class="provider" title={providerName}>{@render tile()}</span>
{/if}

<style>
	.provider {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		transition: transform var(--duration-fast) var(--ease-out);
	}
	a.provider:hover,
	a.provider:focus-visible {
		transform: translateY(-2px);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.initials {
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
	}
	@media (prefers-reduced-motion: reduce) {
		.provider {
			transition: none;
		}
	}
</style>
