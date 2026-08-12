<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();
	let searchInput = $state('');

	$effect(() => {
		searchInput = data.query || '';
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (searchInput.trim()) {
			goto(`/search?q=${encodeURIComponent(searchInput.trim())}`);
		}
	}
</script>

<svelte:head>
  <title>{data.query ? `Search: ${data.query} | CinemaDB` : 'Discover Cinema | CinemaDB'}</title>
  <meta name="description" content="Search by title, director, actor, or genre keywords" />
  <meta property="og:title" content={data.query ? `Search: ${data.query} | CinemaDB` : 'Discover Cinema | CinemaDB'} />
  <meta property="og:description" content="Search by title, director, actor, or genre keywords" />
  <meta property="og:type" content="website" />
</svelte:head>

<div class="container search-page">
	<div class="search-hero">
		<h1 class="page-title">Discover Cinema</h1>
		<p class="subtitle">Search by title, director, actor, or genre keywords</p>

		<form onsubmit={handleSubmit} class="main-search-form">
			<input
				type="search"
				placeholder="Type a movie title (e.g. Inception, Godfather, Parasite)..."
				bind:value={searchInput}
				class="hero-search-input"
			/>
			<Button type="submit" variant="primary" size="lg">
				Search
			</Button>
		</form>
	</div>

	{#if data.query}
		<div class="results-header">
			<h2>Results for <span class="query-text">"{data.query}"</span></h2>
			<span class="count">{data.results.length} movies found</span>
		</div>

		{#if data.results.length > 0}
			<div class="grid-movies">
				{#each data.results as movie}
					<MovieCard
						id={movie.id}
						title={movie.title}
						posterPath={movie.posterPath}
						releaseDate={movie.releaseDate}
						voteAverage={movie.voteAverage}
						genres={movie.genres?.map((g: any) => g.genre.name)}
					/>
				{/each}
			</div>
		{:else}
			<div class="no-results">
				<p class="emoji">🔍</p>
				<h3>No movies found for "{data.query}"</h3>
				<p class="hint">Try searching for another movie title or populate more films via the worker CLI.</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.search-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
	}

	.search-hero {
		text-align: center;
		max-width: 700px;
		margin: 0 auto 4rem auto;
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

	.main-search-form {
		display: flex;
		gap: 0.75rem;
	}

	.hero-search-input {
		flex: 1;
		padding: 0.85rem 1.25rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all var(--transition-fast);
	}

	.hero-search-input:focus {
		outline: none;
		border-color: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
	}

	.results-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.results-header h2 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.query-text {
		color: #10b981;
	}

	.count {
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.grid-movies {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1.5rem;
	}

	.no-results {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
	}

	.emoji {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.no-results h3 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.hint {
		color: var(--text-tertiary);
		font-size: 0.95rem;
	}
</style>
