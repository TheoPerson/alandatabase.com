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
			<div class="logo-symbol-wrapper">
				<svg class="brand-logo-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="18" cy="18" r="15" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5" stroke-dasharray="3 2" class="pulse-ring" />
					<circle cx="18" cy="18" r="11" fill="#090d14" stroke="#10b981" stroke-width="2" />
					<circle cx="18" cy="18" r="3.5" fill="#10b981" />
					<circle cx="18" cy="11.5" r="1.5" fill="#10b981" />
					<circle cx="18" cy="24.5" r="1.5" fill="#10b981" />
					<circle cx="11.5" cy="18" r="1.5" fill="#10b981" />
					<circle cx="24.5" cy="18" r="1.5" fill="#10b981" />
					<line x1="18" y1="18" x2="28" y2="8" stroke="#34d399" stroke-width="2" stroke-linecap="round" class="radar-scan" />
				</svg>
			</div>
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
		gap: 0.65rem;
		font-family: var(--font-sans);
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	.logo-symbol-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
	}

	.brand-logo-svg {
		width: 100%;
		height: 100%;
		transition: transform 0.25s ease;
	}

	.brand-logo:hover .brand-logo-svg {
		transform: scale(1.12);
	}

	.radar-scan {
		transform-origin: 18px 18px;
		animation: radarSpin 5s linear infinite;
	}

	.pulse-ring {
		animation: pulseOpacity 2.5s ease-in-out infinite;
	}

	@keyframes radarSpin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulseOpacity {
		0%, 100% {
			opacity: 0.25;
		}
		50% {
			opacity: 0.7;
		}
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
