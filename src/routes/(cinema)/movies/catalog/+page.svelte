<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	let selectedGenreId = $state<number | null>(data.filters.genreId);
	let sortBy = $state<'popularity' | 'rating' | 'release'>(data.filters.sortBy as 'popularity' | 'rating' | 'release');

	function updateUrl(params: Record<string, string | null>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === null) {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, value);
			}
		}
		// Reset to page 1 on filter change, unless we are explicitly changing page
		if (!('page' in params)) {
			url.searchParams.set('page', '1');
		}
		goto(url, { keepFocus: true, replaceState: true });
	}

	function setGenre(id: number | null) {
		selectedGenreId = id;
		updateUrl({ genre: id ? id.toString() : null });
	}

	function handleSortChange() {
		updateUrl({ sort: sortBy });
	}
	
	function changePage(newPage: number) {
		updateUrl({ page: newPage.toString() });
	}
</script>

<svelte:head>
	<title>Cinema Catalog | CinemaDB</title>
	<meta
		name="description"
		content="Explore curated films, top-rated masterpieces, and upcoming releases."
	/>
	<meta property="og:title" content="Cinema Catalog | CinemaDB" />
	<meta
		property="og:description"
		content="Explore curated films, top-rated masterpieces, and upcoming releases."
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<div class="container movies-page">
	<header class="page-header">
		<h1 class="page-title">All Movies</h1>
		<p class="subtitle">Explore the entire database, filter by genre, and sort by IMDb ratings.</p>

		<!-- Genre Filter Pills -->
		{#if data.genreList.length > 0}
			<div class="genre-pills">
				<button type="button" onclick={() => setGenre(null)}>
					<Badge variant={selectedGenreId === null ? "default" : "outline"} class="cursor-pointer">
						All Genres
					</Badge>
				</button>

				{#each data.genreList as g}
					<button type="button" onclick={() => setGenre(g.id)}>
						<Badge variant={selectedGenreId === g.id ? "default" : "outline"} class="cursor-pointer">
							{g.name}
						</Badge>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Decade Filters -->
		<div class="genre-pills" style="margin-top: 1rem; margin-bottom: 2rem;">
			<button type="button" onclick={() => updateUrl({ decade: null })}>
				<Badge variant={!$page.url.searchParams.get('decade') ? "default" : "outline"} class="cursor-pointer">
					All Time
				</Badge>
			</button>
			{#each [2020, 2010, 2000, 1990, 1980, 1970] as decade}
				<button type="button" onclick={() => updateUrl({ decade: decade.toString() })}>
					<Badge variant={$page.url.searchParams.get('decade') === decade.toString() ? "default" : "outline"} class="cursor-pointer">
						{decade}s
					</Badge>
				</button>
			{/each}
		</div>

		<!-- Sorting Controls -->
		<div class="toolbar">
			<span class="count-badge">{data.pagination.totalCount} movies</span>

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
	{#if data.movies.length > 0}
		<div class="grid-movies">
			{#each data.movies as movie}
				<MovieCard
					id={movie.id}
					title={movie.title}
					posterPath={movie.posterPath}
					releaseDate={movie.releaseDate}
					voteAverage={movie.voteAverage}
					genres={movie.genres?.map((g: any) => g.genre?.name)}
				/>
			{/each}
		</div>
		
		<!-- Pagination -->
		{#if data.pagination.totalPages > 1}
			<div class="pagination">
				<Button 
					variant="outline"
					disabled={data.pagination.page === 1}
					onclick={() => changePage(data.pagination.page - 1)}
				>
					Previous
				</Button>
				<span class="page-info">Page {data.pagination.page} of {data.pagination.totalPages}</span>
				<Button 
					variant="outline"
					disabled={data.pagination.page === data.pagination.totalPages}
					onclick={() => changePage(data.pagination.page + 1)}
				>
					Next
				</Button>
			</div>
		{/if}
	{:else}
		<div class="empty-catalog">
			<p>🎬 No movies match the selected filter.</p>
		</div>
	{/if}
</div>

<style>
	.movies-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
	}

	.page-header {
		margin-bottom: 2.5rem;
	}

	.page-title {
		font-size: 2.75rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
		margin-bottom: 2rem;
	}

	.genre-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.75rem;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.count-badge {
		font-size: 0.9rem;
		color: var(--text-tertiary);
		font-weight: 600;
	}

	.sort-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-label {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.sort-select {
		padding: 0.4rem 0.75rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.empty-catalog {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
	}
	
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 4rem;
	}
	
	.page-info {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
</style>
