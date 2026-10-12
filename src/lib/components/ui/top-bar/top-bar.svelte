<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import SearchIcon from 'lucide-svelte/icons/search';
	import { isActivePath, PRIMARY_LINKS } from '$lib/navigation/links';
	import Button from '../button/button.svelte';

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

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		if (trimmed) goto(`/search?q=${encodeURIComponent(trimmed)}`);
	}
</script>

<header class="bar" class:scrolled>
	<div class="inner">
		<a href="/" class="brand" aria-label="Alan's Database home">
			<span class="mark" aria-hidden="true"></span>
			<span class="word">ALAN<span class="accent">DB</span></span>
		</a>

		<nav class="primary" aria-label="Primary">
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
			<form class="search" role="search" onsubmit={submit}>
				<SearchIcon size={18} aria-hidden="true" />
				<input
					type="search"
					name="q"
					placeholder="Search titles"
					aria-label="Search the catalogue"
					autocomplete="off"
					bind:value={query}
				/>
				<kbd aria-hidden="true">⌘K</kbd>
			</form>
			<a href="/search" class="search-icon" aria-label="Search">
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
	.mark {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--brand-primary);
		box-shadow: var(--shadow-glow-emerald);
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
		gap: var(--space-2);
		margin-left: auto;
	}
	.search {
		display: none;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		padding-inline: 0.9rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.06);
		color: var(--content-tertiary);
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
		color: var(--content-tertiary);
	}
	.search kbd {
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-xs);
		border: 1px solid var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 0.65rem;
	}
	.search-icon {
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
		.search-icon {
			display: none;
		}
		.right :global(.account) {
			display: inline-flex;
		}
	}
</style>
