<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';

	let { data } = $props();

	let selectedGenreId = $state<number | null>(null);
	let sortBy = $state<'popularity' | 'rating' | 'release'>('popularity');

	// Infinite Scroll Reactive State
	let moviesList = $state<any[]>([]);
	let currentPage = $state(1);
	let hasMore = $state(true);
	let isLoading = $state(false);
	let sentinelEl = $state<HTMLDivElement | null>(null);
	let observer = $state<IntersectionObserver | null>(null);

	// Reset list when server-loaded data changes (e.g. genre/sort query change)
	$effect(() => {
		selectedGenreId = data.filters.genreId;
		sortBy = data.filters.sortBy as 'popularity' | 'rating' | 'release';
		moviesList = [...data.movies];
		currentPage = data.pagination.page;
		hasMore = data.pagination.page < data.pagination.totalPages;
	});

	async function loadMore() {
		if (isLoading || !hasMore) return;
		isLoading = true;

		const nextPage = currentPage + 1;
		const genreParam = selectedGenreId ? `&genre=${selectedGenreId}` : '';
		const decadeParam = $page.url.searchParams.get('decade') ? `&decade=${$page.url.searchParams.get('decade')}` : '';
		const sortParam = sortBy ? `&sort=${sortBy}` : '';

		try {
			const res = await fetch(`/api/movies/catalog?page=${nextPage}${genreParam}${decadeParam}${sortParam}`);
			if (!res.ok) throw new Error('Failed to load next page');

			const resData = await res.json();
			if (resData.movies && resData.movies.length > 0) {
				const existingIds = new Set(moviesList.map((m) => m.id || m.tmdbId));
				const newMovies = resData.movies.filter((m: any) => !existingIds.has(m.id || m.tmdbId));

				moviesList = [...moviesList, ...newMovies];
				currentPage = nextPage;
				hasMore = resData.hasMore;
			} else {
				hasMore = false;
			}
		} catch (err) {
			console.error('Error loading more movies:', err);
			hasMore = false;
		} finally {
			isLoading = false;
		}
	}

	function updateUrl(params: Record<string, string | null>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === null) {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, value);
			}
		}
		// Reset to page 1 on filter change
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, replaceState: true });
	}

	function setGenre(id: number | null) {
		selectedGenreId = id;
		updateUrl({ genre: id ? id.toString() : null });
	}

	function handleSortChange() {
		updateUrl({ sort: sortBy });
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					loadMore();
				}
			},
			{ rootMargin: '700px 0px' }
		);

		if (sentinelEl) {
			observer.observe(sentinelEl);
		}
	});

	onDestroy(() => {
		if (observer) {
			observer.disconnect();
		}
	});
</script>

<svelte:head>
	<title>Cinema Catalog — Endless Movies | CinemaDB</title>
	<meta
		name="description"
		content="Explore thousands of curated films, top-rated masterpieces, and blockbusters with smooth infinite scroll."
	/>
</svelte:head>

<div class="container movies-page">
	<header class="page-header">
		<h1 class="page-title">Cinema Catalog</h1>
		<p class="subtitle">Endless movie exploration with real-time genre filtering and sorting.</p>

		<!-- Filters Container -->
		<div class="filters-container">
			<!-- Genre Filters -->
			{#if data.genreList.length > 0}
				<div class="chip-row">
					<button 
						type="button" 
						class="filter-chip {selectedGenreId === null ? 'active' : ''}" 
						onclick={() => setGenre(null)}
					>
						All Genres
					</button>

					{#each data.genreList as g}
						<button 
							type="button" 
							class="filter-chip {selectedGenreId === g.id ? 'active' : ''}" 
							onclick={() => setGenre(g.id)}
						>
							{g.name}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Decade Filters -->
			<div class="chip-row mt-3">
				<button 
					type="button" 
					class="filter-chip {!$page.url.searchParams.get('decade') ? 'active' : ''}" 
					onclick={() => updateUrl({ decade: null })}
				>
					All Time
				</button>
				{#each [2020, 2010, 2000, 1990, 1980, 1970] as decade}
					<button 
						type="button" 
						class="filter-chip {$page.url.searchParams.get('decade') === decade.toString() ? 'active' : ''}" 
						onclick={() => updateUrl({ decade: decade.toString() })}
					>
						{decade}s
					</button>
				{/each}
			</div>
		</div>

		<!-- Sorting Controls -->
		<div class="toolbar">
			<span class="count-badge">Showing {moviesList.length} of {data.pagination.totalCount.toLocaleString()} films</span>

			<div class="sort-group">
				<span class="sort-label">Sort by:</span>
				<select bind:value={sortBy} onchange={handleSortChange} class="sort-select">
					<option value="popularity">🔥 Popularity</option>
					<option value="rating">⭐ Highest Rated</option>
					<option value="release">📅 Release Date</option>
				</select>
			</div>
		</div>
	</header>

	<!-- Movies Grid -->
	{#if moviesList.length > 0}
		<div class="grid-movies">
			{#each moviesList as movie (movie.id || movie.tmdbId)}
				<MovieCard
					id={movie.id || movie.tmdbId}
					title={movie.title}
					posterPath={movie.posterPath}
					releaseDate={movie.releaseDate}
					voteAverage={movie.voteAverage}
					genres={movie.genres?.map((g: any) => g.genre?.name || g.name || (typeof g === 'string' ? g : ''))}
				/>
			{/each}
		</div>

		<!-- Infinite Scroll Sentinel Trigger -->
		<div bind:this={sentinelEl} class="sentinel-trigger">
			{#if isLoading}
				<div class="infinite-loading-box">
					<span class="spinner-ring"></span>
					<span class="loading-label">Loading more masterpieces...</span>
				</div>
			{:else if !hasMore}
				<div class="end-of-catalog-box">
					<span class="end-dot">✨</span>
					<span>You've reached the end of the archive</span>
				</div>
			{/if}
		</div>
	{:else}
		<div class="empty-catalog">
			<p>🎬 No movies match the selected filter.</p>
		</div>
	{/if}
</div>

<style>
	.movies-page {
		padding-top: 2.5rem;
		padding-bottom: 5rem;
	}

	.page-header {
		margin-bottom: 2.5rem;
	}

	.page-title {
		font-size: 2.75rem;
		font-weight: 800;
		color: #f1f5f9;
		letter-spacing: -0.03em;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		font-size: 1.05rem;
		color: #94a3b8;
		margin: 0 0 1.5rem 0;
	}

	.filters-container {
		margin-bottom: 2rem;
		position: relative;
	}

	.chip-row {
		display: flex;
		overflow-x: auto;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
	}
	
	.chip-row::-webkit-scrollbar {
		display: none;
	}

	.filter-chip {
		white-space: nowrap;
		padding: 0.4rem 1.1rem;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #a1a1aa;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.filter-chip:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #f4f4f5;
	}

	.filter-chip.active {
		background: #f4f4f5;
		color: #09090b;
		border-color: #f4f4f5;
		font-weight: 600;
	}

	.mt-3 {
		margin-top: 0.75rem;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.count-badge {
		font-size: 0.85rem;
		font-weight: 700;
		color: #10b981;
		font-family: monospace;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
	}

	.sort-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.sort-label {
		font-size: 0.85rem;
		color: #94a3b8;
		font-weight: 600;
	}

	.sort-select {
		background: rgba(16, 22, 35, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #f1f5f9;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		outline: none;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.sort-select:focus {
		border-color: #10b981;
	}

	.grid-movies {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.grid-movies {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	.sentinel-trigger {
		width: 100%;
		padding: 3.5rem 0 2rem 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.infinite-loading-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #94a3b8;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.spinner-ring {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.end-of-catalog-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.empty-catalog {
		text-align: center;
		padding: 5rem 2rem;
		color: #94a3b8;
		font-size: 1.1rem;
	}
</style>
