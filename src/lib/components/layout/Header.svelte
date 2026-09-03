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
		<a href="/cinema/movies" class="brand-logo" onclick={() => (menuOpen = false)}>
			<div class="logo-symbol-wrapper">
				<svg
					class="brand-logo-svg"
					viewBox="0 0 36 36"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<circle
						cx="18"
						cy="18"
						r="15"
						stroke="rgba(16, 185, 129, 0.3)"
						stroke-width="1.5"
						stroke-dasharray="3 2"
						class="pulse-ring"
					/>
					<circle cx="18" cy="18" r="11" fill="#090d14" stroke="#10b981" stroke-width="2" />
					<circle cx="18" cy="18" r="3.5" fill="#10b981" />
					<circle cx="18" cy="11.5" r="1.5" fill="#10b981" />
					<circle cx="18" cy="24.5" r="1.5" fill="#10b981" />
					<circle cx="11.5" cy="18" r="1.5" fill="#10b981" />
					<circle cx="24.5" cy="18" r="1.5" fill="#10b981" />
					<line
						x1="18"
						y1="18"
						x2="28"
						y2="8"
						stroke="#34d399"
						stroke-width="2"
						stroke-linecap="round"
						class="radar-scan"
					/>
				</svg>
			</div>
			<span class="logo-text">CINEMA<span class="logo-accent">DB</span></span>
		</a>

		<!-- Main Nav Navigation Links -->
		<nav class="main-nav">
			<a href="/cinema/movies" class="nav-link">Movies</a>
			<a href="/tvshows" class="nav-link">TV Shows</a>
			<a href="/cinema/picker" class="nav-link picker-nav-link">
				<span>Picker</span>
				<span class="picker-pill">✨ New</span>
			</a>
			<a href="/movies/catalog" class="nav-link">Catalog</a>
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

			<div class="desktop-only flex items-center gap-2">
				<a
					href="https://github.com/TheoPerson/the-alans-data-base"
					target="_blank"
					rel="noreferrer"
					class="header-repo-icon"
					title="GitHub Repository"
					aria-label="GitHub Repository"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
				</a>
				<a
					href="https://gitlab.com/TheoPerson/the-alans-data-base"
					target="_blank"
					rel="noreferrer"
					class="header-repo-icon gitlab"
					title="GitLab Mirror"
					aria-label="GitLab Mirror"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="#fc6d26">
						<path
							d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.918 1.263c-.136-.423-.731-.423-.867 0L1.387 9.452.045 13.587c-.121.375.014.787.331 1.023L12 23.054l11.624-8.444c.317-.236.452-.648.331-1.023z"
						/>
					</svg>
				</a>
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
				<a href="/cinema/movies" class="mobile-nav-link" onclick={() => (menuOpen = false)}
					>Movies</a
				>
				<a href="/tvshows" class="mobile-nav-link" onclick={() => (menuOpen = false)}>TV Shows</a>
				<a href="/cinema/picker" class="mobile-nav-link" onclick={() => (menuOpen = false)}
					>🎬 Daily Movie Picker</a
				>
				<a href="/movies/catalog" class="mobile-nav-link" onclick={() => (menuOpen = false)}
					>Catalog</a
				>
				<a href="/my/films" class="mobile-nav-link" onclick={() => (menuOpen = false)}
					>Personal OS</a
				>
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

	.glass-header {
		background: rgba(10, 14, 23, 0.82);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
		0%,
		100% {
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

	.picker-nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.picker-pill {
		font-size: 0.65rem;
		font-weight: 800;
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 1px 5px;
		border-radius: 999px;
		letter-spacing: 0.02em;
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

	.header-repo-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md, 8px);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		transition: all 0.2s ease;
	}

	.header-repo-icon:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.header-repo-icon.gitlab:hover {
		background: rgba(252, 109, 38, 0.15);
		border-color: rgba(252, 109, 38, 0.4);
	}

	@media (min-width: 768px) {
		.desktop-only {
			display: flex;
			align-items: center;
			gap: 0.5rem;
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
