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

<nav class="tabs" aria-label="Primary">
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
		height: calc(var(--bottom-bar-height) + var(--safe-bottom));
		padding-bottom: var(--safe-bottom);
		background: rgba(8, 9, 11, 0.9);
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
		color: var(--content-tertiary);
		font-size: 0.65rem;
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
	@media (min-width: 1024px) {
		.tabs {
			display: none;
		}
	}
</style>
