<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { onMount } from 'svelte';

	let open = $state(false);
	let query = $state('');
	let movies = $state<any[]>([]);
	let isSearching = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const navigationLinks = [
		{ label: '⚡ Hub', href: '/', category: 'Navigation' },
		{ label: '🎬 Cinema Movies', href: '/cinema/movies', category: 'Navigation' },
		{ label: '📺 Top 50 TV Shows', href: '/tvshows', category: 'Navigation' },
		{ label: '🍿 All Movies Catalog', href: '/movies/catalog', category: 'Navigation' },
		{ label: '🔍 Advanced Search', href: '/search', category: 'Navigation' },
		{ label: '📽️ My Personal Archive', href: '/my/films', category: 'Personal OS' },
		{ label: '📖 My Diary', href: '/my/diary', category: 'Personal OS' },
		{ label: '✨ AI Curator', href: '/discover/ai', category: 'Personal OS' },
		{ label: '📡 Live Telemetry & Radar', href: '/status', category: 'System Radar' },
		{
			label: '🚨 Sentry Test & Error Verify',
			href: '/sentry-example-page',
			category: 'System Radar'
		},
		{
			label: '🐙 GitHub Repository',
			href: 'https://github.com/TheoPerson/the-alans-data-base',
			category: 'Source Code'
		},
		{
			label: '🦊 GitLab Mirror Repository',
			href: 'https://gitlab.com/TheoPerson/the-alans-data-base',
			category: 'Source Code'
		}
	];

	const filteredLinks = $derived(
		query.trim()
			? navigationLinks.filter((item) =>
					item.label.toLowerCase().includes(query.trim().toLowerCase())
				)
			: navigationLinks
	);

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
		} else if (e.key === 'Escape' && open) {
			open = false;
		}
	}

	function navigate(href: string) {
		open = false;
		query = '';
		movies = [];
		if (href.startsWith('http')) {
			if (typeof window !== 'undefined') {
				window.open(href, '_blank', 'noopener,noreferrer');
			}
		} else {
			goto(href);
		}
	}

	function handlePaletteKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const items = Array.from(document.querySelectorAll('.palette-item')) as HTMLElement[];
			if (!items.length) return;
			const currentIndex = items.indexOf(document.activeElement as HTMLElement);
			let nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
			if (nextIndex < 0) nextIndex = items.length - 1;
			if (nextIndex >= items.length) nextIndex = 0;
			items[nextIndex].focus();
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	async function searchApi(q: string) {
		if (!q.trim()) {
			movies = [];
			return;
		}
		isSearching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=4`);
			if (res.ok) {
				const data = await res.json();
				movies = data.results || [];
			}
		} catch {
			movies = [];
		} finally {
			isSearching = false;
		}
	}

	$effect(() => {
		if (query) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				searchApi(query);
			}, 300);
		} else {
			movies = [];
		}
	});

	// When palette closes, reset state
	$effect(() => {
		if (!open) {
			query = '';
			movies = [];
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="palette-backdrop"
		transition:fade={{ duration: 120 }}
		role="presentation"
		onclick={() => (open = false)}
	>
		<div
			class="palette-card"
			transition:scale={{ duration: 120, start: 0.96 }}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label="Command Palette"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handlePaletteKeydown}
		>
			<div class="palette-header">
				<span class="search-icon">🔍</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					autofocus
					placeholder="Search movies, commands, pages..."
					bind:value={query}
					class="palette-input"
				/>
				<span class="shortcut-badge">ESC</span>
			</div>

			<div class="palette-results">
				<!-- Movies Section -->
				{#if query.trim() && (movies.length > 0 || isSearching)}
					<div class="result-section">
						<div class="section-title">Movies {isSearching ? '...' : ''}</div>
						{#each movies as movie}
							<button
								type="button"
								class="palette-item movie-item"
								onclick={() => navigate(`/movies/${movie.id}`)}
							>
								{#if movie.posterPath}
									<img
										src="https://image.tmdb.org/t/p/w92{movie.posterPath}"
										alt={movie.title}
										class="item-poster"
									/>
								{:else}
									<div class="item-poster fallback">?</div>
								{/if}
								<div class="movie-meta">
									<span class="item-label">{movie.title}</span>
									<span class="item-year"
										>{movie.releaseDate ? movie.releaseDate.substring(0, 4) : 'N/A'}</span
									>
								</div>
								{#if movie.voteAverage}
									<span class="item-rating">★ {Number(movie.voteAverage).toFixed(1)}</span>
								{/if}
							</button>
						{/each}
						{#if !isSearching && movies.length === 0}
							<div class="empty-state">No movies found.</div>
						{/if}
					</div>
				{/if}

				<!-- Commands Section -->
				{#if filteredLinks.length > 0}
					<div class="result-section">
						<div class="section-title">Navigation</div>
						{#each filteredLinks as link}
							<button type="button" class="palette-item" onclick={() => navigate(link.href)}>
								<span class="item-label">{link.label}</span>
								<span class="item-category">{link.category}</span>
							</button>
						{/each}
					</div>
				{/if}

				{#if filteredLinks.length === 0 && !query.trim()}
					<div class="empty-state">
						<p>Type to search...</p>
					</div>
				{/if}
			</div>

			<div class="palette-footer">
				<span>Press <kbd>Cmd+K</kbd> or <kbd>Ctrl+K</kbd> anytime</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: 300;
		background: rgba(7, 8, 11, 0.85);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 15vh;
		padding-left: 1rem;
		padding-right: 1rem;
	}

	.palette-card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 580px;
		box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 70vh;
	}

	.palette-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.search-icon {
		font-size: 1.1rem;
		opacity: 0.7;
	}

	.palette-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.05rem;
		outline: none;
	}

	.shortcut-badge {
		font-size: 0.7rem;
		font-weight: 700;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		color: var(--text-tertiary);
	}

	.palette-results {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.result-section {
		margin-bottom: 0.5rem;
	}

	.section-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-tertiary);
		padding: 0.5rem 1.25rem;
		letter-spacing: 0.05em;
	}

	.palette-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		padding: 0.75rem 1.25rem;
		cursor: pointer;
		color: var(--text-primary);
		transition: background 0.15s;
		text-align: left;
	}

	.palette-item:hover,
	.palette-item:focus {
		background: rgba(255, 255, 255, 0.06);
		outline: none;
	}

	.movie-item {
		justify-content: flex-start;
		gap: 0.75rem;
	}

	.item-poster {
		width: 32px;
		height: 48px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.item-poster.fallback {
		background: rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.movie-meta {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.item-label {
		font-size: 0.95rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-category {
		font-size: 0.75rem;
		color: var(--text-secondary);
		padding: 0.2rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 99px;
	}

	.item-year {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.item-rating {
		font-size: 0.8rem;
		color: #f59e0b;
		font-weight: 700;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.palette-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-align: right;
		flex-shrink: 0;
	}

	kbd {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		padding: 0.15rem 0.3rem;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.7rem;
	}
</style>
