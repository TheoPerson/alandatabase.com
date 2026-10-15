<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import SearchIcon from 'lucide-svelte/icons/search';
	import CompassIcon from 'lucide-svelte/icons/compass';
	import SparklesIcon from 'lucide-svelte/icons/sparkles';
	import { isActivePath, PRIMARY_LINKS } from '$lib/navigation/links';
	import { palette } from '$lib/search/palette-state.svelte';
	import { normalizeQuery, searchHref } from '$lib/search/query';
	import { saveRecentSearch } from '$lib/search/recent-searches';
	import Button from '../button/button.svelte';
	import Logo from '../logo/logo.svelte';

	interface Props {
		user: { username: string } | null;
	}

	let { user }: Props = $props();

	let scrolled = $state(false);
	let query = $state('');

	$effect(() => {
		const update = () => (scrolled = window.scrollY > 24);
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	});

	// Without JavaScript the form still submits to /search; with it, navigate in place.
	function submit(event: SubmitEvent) {
		event.preventDefault();
		const normalized = normalizeQuery(query);
		if (!normalized) return;
		saveRecentSearch(normalized);
		goto(searchHref(normalized));
	}

	// A plain tap opens the palette; modified clicks keep the link's own behaviour.
	function openPalette(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		palette.open();
	}
</script>

<header class="bar" class:scrolled>
	<div class="inner">
		<a href="/" class="brand">
			<Logo size={28} />
			<span class="word">ALAN<span class="accent">DB</span></span>
			<span class="sr-only">home</span>
		</a>

		<nav class="primary" aria-label="Primary" data-sveltekit-preload-code="eager">
			{#each PRIMARY_LINKS as link (link.href)}
				<a
					href={link.href}
					class="link"
					aria-current={isActivePath(page.url.pathname, link.href) ? 'page' : undefined}
					>{link.label}</a
				>
			{/each}
		</nav>

		<div class="right">
			<form
				class="search"
				role="search"
				aria-label="Site search"
				action="/search"
				method="get"
				onsubmit={submit}
			>
				<SearchIcon size={18} aria-hidden="true" />
				<input
					type="search"
					name="q"
					placeholder="Search titles"
					aria-label="Search the catalogue"
					autocomplete="off"
					maxlength="120"
					bind:value={query}
				/>
				<!-- Opens the palette. The visible text is the shortcut, so the name repeats it. -->
				<button
					type="button"
					class="shortcut"
					aria-haspopup="dialog"
					aria-keyshortcuts="Control+K Meta+K"
					aria-label="Quick search, {palette.shortcut}"
					onclick={() => palette.open()}
				>
					{palette.shortcut}
				</button>
			</form>
			<!-- Phones have no primary nav: Discover and Picker stay one tap away here. -->
			<a href="/discover" class="icon-link" aria-label="Discover">
				<CompassIcon size={22} aria-hidden="true" />
			</a>
			<a href="/cinema/picker" class="icon-link" aria-label="Picker">
				<SparklesIcon size={22} aria-hidden="true" />
			</a>
			<a
				href="/search"
				class="icon-link"
				aria-label="Search"
				aria-haspopup="dialog"
				onclick={openPalette}
			>
				<SearchIcon size={22} aria-hidden="true" />
			</a>
			{#if user}
				<Button href="/my/films" variant="outline" size="sm" class="account">{user.username}</Button
				>
			{:else}
				<Button href="/auth/login" variant="primary" size="sm" class="account">Sign in</Button>
			{/if}
		</div>
	</div>
</header>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: var(--z-bar);
		padding-top: var(--safe-top);
		background: linear-gradient(to bottom, rgba(8, 9, 11, 0.85), transparent);
		transition: background-color var(--duration-slow) var(--ease-out);
	}
	.scrolled {
		background: rgba(8, 9, 11, 0.82);
		backdrop-filter: blur(16px) saturate(140%);
		-webkit-backdrop-filter: blur(16px) saturate(140%);
		box-shadow: 0 1px 0 var(--border-subtle);
	}
	.inner {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		max-width: var(--container-wide);
		height: var(--top-bar-height);
		margin: 0 auto;
		padding-inline: var(--page-gutter);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		font-weight: 900;
		letter-spacing: 0.04em;
	}
	.accent {
		color: var(--brand-primary);
	}
	.primary {
		display: none;
		gap: 0.25rem;
	}
	.link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		padding-inline: 0.75rem;
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 700;
		transition:
			color var(--duration-base) var(--ease-out),
			background-color var(--duration-base) var(--ease-out);
	}
	.link:hover {
		color: var(--content-primary);
		background: rgba(255, 255, 255, 0.06);
	}
	.link[aria-current='page'] {
		color: var(--content-primary);
		background: rgba(255, 255, 255, 0.1);
	}
	.right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}
	.search {
		display: none;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		margin-right: var(--space-2);
		padding-inline: 0.9rem 0.6rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-strong);
		/* Opaque on purpose: text contrast must not depend on the hero behind a transparent bar. */
		background: var(--surface-raised);
		color: var(--content-secondary);
		transition: border-color var(--duration-base) var(--ease-out);
	}
	.search:focus-within {
		border-color: var(--brand-border);
		color: var(--content-primary);
	}
	.search input {
		width: 11rem;
		background: transparent;
		border: 0;
		color: var(--content-primary);
		outline: none;
	}
	.search input::placeholder {
		color: var(--content-secondary);
	}
	/* AA on both bar states: secondary text on a solid raised key cap (about 8:1). */
	.shortcut {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		min-height: 1.75rem;
		padding: 0 0.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xs);
		background: var(--surface-interactive);
		color: var(--content-secondary);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		white-space: nowrap;
		transition:
			color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}
	.shortcut:hover {
		color: var(--content-primary);
		border-color: var(--brand-border);
	}
	.icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-primary);
	}
	.right :global(.account) {
		display: none;
	}
	@media (min-width: 1024px) {
		.primary,
		.search {
			display: flex;
		}
		.icon-link {
			display: none;
		}
		.right :global(.account) {
			display: inline-flex;
		}
	}
</style>
