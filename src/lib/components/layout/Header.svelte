<script lang="ts">
	import Button from '../ui/Button.svelte';
	import { goto } from '$app/navigation';

	let searchQuery = $state('');
	let menuOpen = $state(false);

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		if (searchQuery.trim()) {
			goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
			menuOpen = false;
		}
	}
</script>

<header class="glass-header sticky-header">
	<div class="container header-content">
		<!-- Brand Logo -->
		<a href="/movies" class="brand-logo" onclick={() => (menuOpen = false)}>
			<span class="logo-icon">🎬</span>
			<span class="logo-text">CINEMA<span class="logo-accent">DB</span></span>
		</a>

		<!-- Main Nav Navigation Links -->
		<nav class="main-nav">
			<a href="/discover" class="nav-link">Discover</a>
			<a href="/movies/catalog" class="nav-link">All Movies</a>
			<a href="/my/films" class="nav-link">Personal OS</a>
		</nav>

		<!-- Search Bar & User Actions -->
		<div class="header-right">
			<form onsubmit={handleSearch} class="search-form">
				<input
					type="search"
					placeholder="Search movies, directors, actors..."
					bind:value={searchQuery}
					class="search-input"
				/>
				<button type="submit" aria-label="Search" class="search-btn"> 🔍 </button>
			</form>

			<div class="desktop-only">
				<Button href="/my/films" variant="outline" size="sm">Personal OS</Button>
			</div>

			<button
				class="mobile-menu-btn"
				aria-label="Toggle menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				☰
			</button>
		</div>
	</div>

	{#if menuOpen}
		<div class="mobile-menu">
			<nav class="mobile-nav">
				<a href="/discover" class="mobile-nav-link" onclick={() => (menuOpen = false)}>Discover</a>
				<a href="/movies/catalog" class="mobile-nav-link" onclick={() => (menuOpen = false)}>All Movies</a>
				<a href="/my/films" class="mobile-nav-link" onclick={() => (menuOpen = false)}>Personal OS</a>
			</nav>
		</div>
	{/if}
</header>

<style>
	.sticky-header {
		position: sticky;
		top: 0;
		z-index: 50;
		width: 100%;
		height: 70px;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
		gap: 2rem;
	}

	.brand-logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-sans);
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.logo-icon {
		font-size: 1.4rem;
	}

	.logo-accent {
		color: #10b981;
		margin-left: 2px;
	}

	.main-nav {
		display: none;
		align-items: center;
		gap: 1.75rem;
	}

	@media (min-width: 768px) {
		.main-nav {
			display: flex;
		}
	}

	.nav-link {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-secondary);
		transition: color var(--transition-fast);
	}

	.nav-link:hover {
		color: #10b981;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.search-form {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input {
		width: 220px;
		padding: 0.45rem 2.2rem 0.45rem 0.85rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-primary);
		font-size: 0.85rem;
		transition: all var(--transition-fast);
	}

	@media (min-width: 1024px) {
		.search-input {
			width: 280px;
		}
	}

	.search-input:focus {
		outline: none;
		border-color: var(--border-accent);
		box-shadow: 0 0 0 3px var(--accent-gold-subtle);
		width: 320px;
	}

	.search-btn {
		position: absolute;
		right: 0.6rem;
		font-size: 0.85rem;
		opacity: 0.6;
		transition: opacity var(--transition-fast);
	}

	.search-btn:hover {
		opacity: 1;
	}

	.desktop-only {
		display: none;
	}

	@media (min-width: 768px) {
		.desktop-only {
			display: block;
		}
	}

	.mobile-menu-btn {
		display: block;
		font-size: 1.5rem;
		color: var(--text-primary);
		padding: 0.25rem;
	}

	@media (min-width: 768px) {
		.mobile-menu-btn {
			display: none;
		}
	}

	.mobile-menu {
		position: absolute;
		top: 70px;
		left: 0;
		right: 0;
		background: rgba(7, 8, 11, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid var(--border-subtle);
		padding: 1rem 1.5rem;
		display: flex;
		flex-direction: column;
	}

	.mobile-nav {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mobile-nav-link {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}
</style>
