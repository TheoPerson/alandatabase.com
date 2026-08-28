<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();
	let searchInput = $state('');
	let sortBy = $state<'relevance' | 'rating' | 'recent'>('relevance');

	$effect(() => {
		searchInput = data.query || '';
	});

	const sortedResults = $derived.by(() => {
		const list = [...(data.results || [])];
		if (sortBy === 'rating') {
			return list.sort((a, b) => Number(b.voteAverage || 0) - Number(a.voteAverage || 0));
		}
		if (sortBy === 'recent') {
			return list.sort((a, b) => {
				const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
				const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
				return dateB - dateA;
			});
		}
		return list;
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (searchInput.trim()) {
			goto(`/search?q=${encodeURIComponent(searchInput.trim())}`);
		}
	}
</script>

<svelte:head>
	<title>{data.query ? `Search: ${data.query} | Alan Database` : 'Search | Alan Database'}</title>
	<meta name="description" content="Search the Alan Database local movie catalogue by title." />
	<meta name="robots" content="noindex,follow" />
	<link rel="canonical" href="https://alandatabase.com/search" />
	<meta
		property="og:title"
		content={data.query ? `Search: ${data.query} | Alan Database` : 'Search | Alan Database'}
	/>
	<meta property="og:description" content="Search by title, director, actor, or genre keywords" />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="container search-page">
	<div class="search-hero">
		<h1 class="page-title">Discover Cinema</h1>
		<p class="subtitle">Search the reviewed local catalogue by movie title.</p>

		<form onsubmit={handleSubmit} class="main-search-form">
			<label class="sr-only" for="catalog-search">Movie title</label>
			<input
				id="catalog-search"
				name="q"
				type="search"
				placeholder="Search by movie title"
				bind:value={searchInput}
				class="hero-search-input"
				autocomplete="off"
			/>
			<Button type="submit" variant="primary" size="lg">Search</Button>
		</form>
	</div>

	{#if data.query}
		<div class="results-header">
			<div class="results-title-group">
				<h2>Results for <span class="query-text">"{data.query}"</span></h2>
				<span class="count"
					>{data.results.length} movie{data.results.length === 1 ? '' : 's'} found</span
				>
			</div>

			{#if data.results.length > 0}
				<div class="sort-controls">
					<span class="sort-label">Sort:</span>
					<div class="sort-pills">
						<button
							type="button"
							class="sort-pill"
							class:active={sortBy === 'relevance'}
							onclick={() => (sortBy = 'relevance')}
							aria-pressed={sortBy === 'relevance'}
						>
							Best match
						</button>
						<button
							type="button"
							class="sort-pill"
							class:active={sortBy === 'rating'}
							onclick={() => (sortBy = 'rating')}
							aria-pressed={sortBy === 'rating'}
						>
							Rating
						</button>
						<button
							type="button"
							class="sort-pill"
							class:active={sortBy === 'recent'}
							onclick={() => (sortBy = 'recent')}
							aria-pressed={sortBy === 'recent'}
						>
							Newest
						</button>
					</div>
				</div>
			{/if}
		</div>

		{#if data.searchError}
			<ErrorState
				title="Search is temporarily unavailable"
				description="The local catalogue could not be queried. Nothing was changed; try the request again."
			>
				{#snippet action()}
					<Button href={`/search?q=${encodeURIComponent(data.query)}`} variant="outline"
						>Try again</Button
					>
				{/snippet}
			</ErrorState>
		{:else if sortedResults.length > 0}
			<div class="grid-movies">
				{#each sortedResults as movie (movie.id || movie.tmdbId)}
					<MovieCard
						id={movie.id || movie.tmdbId}
						title={movie.title}
						posterPath={movie.posterPath}
						releaseDate={movie.releaseDate}
						voteAverage={movie.voteAverage}
						genres={movie.genres?.map(
							(g: any) => g?.genre?.name || g?.name || (typeof g === 'string' ? g : '')
						)}
					/>
				{/each}
			</div>
		{:else}
			<EmptyState
				title={`No movies found for "${data.query}"`}
				description="Try another title or browse the complete reviewed catalogue."
			>
				{#snippet action()}
					<Button href="/movies/catalog" variant="outline">Browse catalogue</Button>
				{/snippet}
			</EmptyState>
		{/if}
	{/if}
</div>

<style>
	.search-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		min-height: 70dvh;
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
		min-height: var(--touch-target);
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.hero-search-input:focus-visible {
		outline: none;
		border-color: var(--brand-primary);
		box-shadow: 0 0 0 3px var(--brand-muted);
	}

	.results-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	@media (min-width: 768px) {
		.results-header {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.results-title-group {
		display: flex;
		align-items: baseline;
		gap: 1rem;
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

	.sort-controls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.sort-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
	}

	.sort-pills {
		display: flex;
		align-items: center;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: 9999px;
		padding: 3px;
		gap: 2px;
		flex-wrap: wrap;
	}

	.sort-pill {
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.78rem;
		font-weight: 600;
		min-height: var(--touch-target);
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 150ms ease;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		user-select: none;
	}

	.sort-pill:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
	}

	.sort-pill.active {
		background: rgba(16, 185, 129, 0.15);
		color: var(--accent-emerald);
		border-color: rgba(16, 185, 129, 0.4);
		font-weight: 700;
	}

	.grid-movies {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1.5rem;
	}

	@media (max-width: 640px) {
		.search-page {
			padding-top: 1.5rem;
			padding-bottom: calc(5rem + env(safe-area-inset-bottom));
		}

		.search-hero {
			margin-bottom: 2.5rem;
			text-align: left;
		}

		.page-title {
			font-size: clamp(2rem, 12vw, 2.75rem);
		}

		.main-search-form {
			flex-direction: column;
		}

		.main-search-form :global(.btn) {
			width: 100%;
		}

		.results-title-group,
		.sort-controls {
			align-items: flex-start;
			flex-direction: column;
		}

		.sort-pills {
			width: 100%;
			border-radius: var(--radius-md);
		}

		.sort-pill {
			flex: 1;
		}
	}
</style>
