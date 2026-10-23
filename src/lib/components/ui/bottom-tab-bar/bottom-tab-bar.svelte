<script lang="ts">
	import { page } from '$app/state';
	import HomeIcon from 'lucide-svelte/icons/house';
	import FilmIcon from 'lucide-svelte/icons/film';
	import TvIcon from 'lucide-svelte/icons/tv';
	import SearchIcon from 'lucide-svelte/icons/search';
	import LibraryIcon from 'lucide-svelte/icons/library';
	import CompassIcon from 'lucide-svelte/icons/compass';
	import SparklesIcon from 'lucide-svelte/icons/sparkles';
	import { isActivePath, TAB_LINKS, type NavIcon } from '$lib/navigation/links';

	const ICONS: Record<NavIcon, typeof HomeIcon> = {
		home: HomeIcon,
		film: FilmIcon,
		tv: TvIcon,
		search: SearchIcon,
		library: LibraryIcon,
		compass: CompassIcon,
		sparkles: SparklesIcon
	};
</script>

<!-- Only the main sections are preloaded eagerly; film pages (and the player) load on hover or tap. -->
<nav class="tabs" aria-label="Primary" data-sveltekit-preload-code="eager">
	{#each TAB_LINKS as link (link.href)}
		{@const Icon = ICONS[link.icon]}
		{@const active = isActivePath(page.url.pathname, link.href)}
		<a href={link.href} class="tab" class:active aria-current={active ? 'page' : undefined}>
			<Icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 1.8} />
			<span>{link.label}</span>
		</a>
	{/each}
</nav>

<style>
	.tabs {
		position: fixed;
		inset: auto 0 0 0;
		z-index: var(--z-bar);
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		height: calc(var(--bottom-bar-height) + var(--tab-bar-inset));
		/* Symmetric side insets keep the edge tabs clear of the island in landscape. */
		padding: 0 var(--chrome-inset-x) var(--tab-bar-inset);
		background: color-mix(in srgb, var(--surface-canvas) 96%, transparent);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		border-top: 1px solid var(--border-subtle);
	}
	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		min-height: var(--bottom-bar-height);
		color: var(--content-secondary);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		transition: color var(--duration-base) var(--ease-out);
	}
	.tab:active {
		transform: scale(0.95);
	}
	.active {
		color: var(--brand-primary);
	}
	/* Landscape phones: the iOS compact tab bar, icon beside its label on one short row. */
	@media (max-height: 500px) and (orientation: landscape) {
		.tab {
			flex-direction: row;
			gap: var(--space-2);
			font-size: var(--text-xs);
		}
	}
	@media (min-width: 1024px) {
		.tabs {
			display: none;
		}
	}
	/* The full-screen trailer player owns the viewport: the bar yields while it is open. */
	:global(html[data-player-open]) .tabs {
		display: none;
	}
</style>
