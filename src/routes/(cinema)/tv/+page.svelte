<script lang="ts">
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	let { data } = $props();

	let searchQuery = $state('');
	let selectedGenre = $state('All');

	const allGenres = $derived.by(() => {
		const set = new Set<string>();
		data.shows.forEach((show: any) => {
			show.genres?.forEach((g: string) => set.add(g));
		});
		return ['All', ...Array.from(set).sort()];
	});

	const filteredShows = $derived(
		data.shows.filter((show: any) => {
			const matchesQuery =
				!searchQuery.trim() ||
				show.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
				show.overview.toLowerCase().includes(searchQuery.trim().toLowerCase());

			const matchesGenre =
				selectedGenre === 'All' || show.genres?.includes(selectedGenre);

			return matchesQuery && matchesGenre;
		})
	);
</script>

<svelte:head>
	<title>Top 50 IMDb TV Shows | CinemaDB</title>
	<meta
		name="description"
		content="The 50 Greatest Television Series of All Time, ranked by IMDb user ratings. Stream and discover the highest-rated TV shows."
	/>
</svelte:head>

<div class="tv-top50-page container">
	<!-- Hero Section -->
	<header class="tv-hero">
		<div class="imdb-badge-wrap">
			<span class="imdb-icon">IMDb</span>
			<span class="chart-tag">TOP 50 TELEVISION CHART</span>
		</div>
		<h1 class="hero-title">Top 50 Ranked TV Shows</h1>
		<p class="hero-desc">
			The 50 highest-rated television masterpieces in history according to millions of IMDb reviews. Explore, stream, and archive the greatest series ever made.
		</p>

		<!-- Search & Filter Controls -->
		<div class="controls-bar glass-card">
			<div class="search-wrap">
				<span class="search-icon">🔍</span>
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search Top 50 shows (e.g. Breaking Bad, Chernobyl, Arcane)..."
					class="tv-search-input"
				/>
			</div>

			<div class="genre-pills-scroll">
				{#each allGenres as genre}
					<button
						type="button"
						class="genre-chip"
						class:active={selectedGenre === genre}
						onclick={() => (selectedGenre = genre)}
					>
						{genre}
					</button>
				{/each}
			</div>
		</div>
	</header>

	<!-- TV Shows Grid / List -->
	<section class="tv-grid">
		{#if filteredShows.length === 0}
			<div class="empty-state glass-card">
				<p class="empty-emoji">📺</p>
				<h3>No TV shows match your filter</h3>
				<p class="empty-hint">Try clearing your search query or selecting a different genre.</p>
				<Button variant="outline" onclick={() => { searchQuery = ''; selectedGenre = 'All'; }}>Reset Filters</Button>
			</div>
		{:else}
			{#each filteredShows as show (show.tmdbId)}
				<article class="tv-card glass-card" class:top-3={show.rank <= 3}>
					<!-- Rank Number Badge -->
					<div
						class="rank-badge"
						class:gold={show.rank === 1}
						class:silver={show.rank === 2}
						class:bronze={show.rank === 3}
					>
						#{show.rank}
					</div>

					<!-- Poster Container -->
					<div class="poster-box">
						<MoviePoster path={show.posterPath} title={show.title} />
						<div class="rating-overlay">
							<span class="star">⭐</span>
							<span class="score">{show.imdbRating}</span>
						</div>
					</div>

					<!-- Show Info -->
					<div class="tv-info">
						<div class="tv-header">
							<h2 class="tv-title">{show.title}</h2>
							<div class="tv-meta">
								<span class="meta-year">{show.year}</span>
								<span class="meta-dot">•</span>
								<span class="meta-seasons">{show.seasonsCount} {show.seasonsCount === 1 ? 'Season' : 'Seasons'}</span>
							</div>
						</div>

						<p class="tv-overview">{show.overview}</p>

						<div class="tv-footer">
							<div class="genre-tags">
								{#each (show.genres || []).slice(0, 2) as g}
									<span class="genre-tag">{g}</span>
								{/each}
							</div>

							<a href="/tv/{show.tmdbId}" class="watch-tv-btn">
								<span>▶ Watch Series</span>
							</a>
						</div>
					</div>
				</article>
			{/each}
		{/if}
	</section>
</div>

<style>
	.tv-top50-page {
		padding-top: 2rem;
		padding-bottom: 5rem;
	}

	/* Hero */
	.tv-hero {
		text-align: center;
		max-width: 860px;
		margin: 0 auto 3rem auto;
	}

	.imdb-badge-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.imdb-icon {
		background: #f5c518;
		color: #000000;
		font-weight: 900;
		font-size: 0.78rem;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		letter-spacing: -0.02em;
	}

	.chart-tag {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #10b981;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.15rem 0.6rem;
		border-radius: 9999px;
		font-family: monospace;
	}

	.hero-title {
		font-size: 2.75rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: #ffffff;
		margin: 0 0 1rem 0;
	}

	.hero-desc {
		font-size: 1.05rem;
		color: #a1a1aa;
		line-height: 1.6;
		margin: 0 0 2rem 0;
	}

	/* Controls Bar */
	.controls-bar {
		padding: 1rem 1.25rem;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: rgba(12, 16, 24, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		font-size: 0.9rem;
		opacity: 0.5;
	}

	.tv-search-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		padding: 0.65rem 1rem 0.65rem 2.5rem;
		color: #ffffff;
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.tv-search-input:focus {
		border-color: #10b981;
		box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
	}

	.genre-pills-scroll {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: none;
	}

	.genre-chip {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.genre-chip:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.1);
	}

	.genre-chip.active {
		background: #10b981;
		color: #050507;
		border-color: #10b981;
		font-weight: 700;
	}

	/* Grid & Cards */
	.tv-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.tv-grid {
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}

	.tv-card {
		position: relative;
		border-radius: 16px;
		background: rgba(10, 13, 20, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.07);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.tv-card:hover {
		transform: translateY(-4px);
		border-color: rgba(16, 185, 129, 0.35);
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(16, 185, 129, 0.1);
	}

	.tv-card:active {
		transform: scale(0.98);
	}

	/* Rank Badge */
	.rank-badge {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 10;
		background: rgba(9, 13, 20, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-family: monospace;
		font-weight: 800;
		font-size: 0.85rem;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		backdrop-filter: blur(8px);
	}

	.rank-badge.gold {
		background: #f59e0b;
		color: #000000;
		border-color: #fbbf24;
		box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
	}

	.rank-badge.silver {
		background: #94a3b8;
		color: #000000;
		border-color: #cbd5e1;
	}

	.rank-badge.bronze {
		background: #b45309;
		color: #ffffff;
		border-color: #d97706;
	}

	.poster-box {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		overflow: hidden;
		background: #06090e;
	}

	.rating-overlay {
		position: absolute;
		bottom: 0.6rem;
		right: 0.6rem;
		background: rgba(0, 0, 0, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 800;
		font-size: 0.78rem;
		color: #f5c518;
		backdrop-filter: blur(8px);
	}

	.tv-info {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.75rem;
	}

	.tv-title {
		font-size: 1.15rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.01em;
		margin: 0 0 0.25rem 0;
	}

	.tv-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #a1a1aa;
	}

	.tv-overview {
		font-size: 0.82rem;
		color: #71717a;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		flex: 1;
	}

	.tv-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.genre-tags {
		display: flex;
		gap: 0.35rem;
	}

	.genre-tag {
		background: rgba(255, 255, 255, 0.05);
		color: #a1a1aa;
		font-size: 0.68rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.watch-tv-btn {
		background: #10b981;
		color: #050507;
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.watch-tv-btn:hover {
		background: #34d399;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
	}

	.empty-state {
		grid-column: 1 / -1;
		padding: 4rem 2rem;
		text-align: center;
		border-radius: 20px;
	}

	.empty-emoji {
		font-size: 3rem;
		margin: 0 0 1rem 0;
	}
</style>
