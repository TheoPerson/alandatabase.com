<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	let selectedGenreId = $state<number | null>(
		$page.url.searchParams.has('genre') ? Number($page.url.searchParams.get('genre')) : null
	);
	let sortBy = $state<'popularity' | 'rating' | 'release'>('popularity');

	const filteredMovies = $derived.by(() => {
		let list = [...data.allMovies];

		if (selectedGenreId !== null) {
			list = list.filter((m) => m.genres?.some((g: any) => g.genreId === selectedGenreId));
		}

		if (sortBy === 'rating') {
			list.sort((a, b) => Number(b.voteAverage || 0) - Number(a.voteAverage || 0));
		} else if (sortBy === 'release') {
			list.sort(
				(a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime()
			);
		} else {
			list.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
		}

		return list;
	});

	function setGenre(id: number | null) {
		selectedGenreId = id;
		const url = new URL($page.url);
		if (id === null) {
			url.searchParams.delete('genre');
		} else {
			url.searchParams.set('genre', id.toString());
		}
		goto(url, { keepFocus: true, replaceState: true });
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
				<button
					type="button"
					class="genre-pill"
					class:active={selectedGenreId === null}
					onclick={() => setGenre(null)}
				>
					All Genres
				</button>

				{#each data.genreList as g}
					<button
						type="button"
						class="genre-pill"
						class:active={selectedGenreId === g.id}
						onclick={() => setGenre(g.id)}
					>
						{g.name}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Sorting Controls -->
		<div class="toolbar">
			<span class="count-badge">{filteredMovies.length} movies</span>

			<div class="sort-group">
				<span class="sort-label">Sort by:</span>
				<select bind:value={sortBy} class="sort-select">
					<option value="popularity">🔥 Popularity</option>
					<option value="rating">⭐ Highest Rated</option>
					<option value="release">📅 Release Date</option>
				</select>
			</div>
		</div>
	</header>

	<!-- Movies Grid -->
	{#if filteredMovies.length > 0}
		<div class="grid-movies">
			{#each filteredMovies as movie}
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

	.genre-pill {
		padding: 0.45rem 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.genre-pill:hover {
		background: var(--bg-surface-2);
		color: var(--text-primary);
	}

	.genre-pill.active {
		background: var(--accent-gold);
		color: #000;
		border-color: var(--accent-gold);
		font-weight: 700;
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
</style>
