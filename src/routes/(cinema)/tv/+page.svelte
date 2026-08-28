<script lang="ts">
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	const hero = $derived(data.featuredHero);

	let searchQuery = $state('');
	let selectedGenre = $state('All');

	const allGenres = $derived.by(() => {
		const genres = data.shows.flatMap((show: any) => show.genres ?? []) as string[];
		return ['All', ...genres.filter((genre, index) => genres.indexOf(genre) === index).sort()];
	});

	const filteredShows = $derived(
		data.shows.filter((show: any) => {
			const matchesQuery =
				!searchQuery.trim() ||
				show.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
				show.overview.toLowerCase().includes(searchQuery.trim().toLowerCase());

			const matchesGenre = selectedGenre === 'All' || show.genres?.includes(selectedGenre);

			return matchesQuery && matchesGenre;
		})
	);
</script>

<svelte:head>
	<title>Top 50 IMDb TV Shows & Series | CinemaDB</title>
	<meta
		name="description"
		content="The 50 Greatest Television Series of All Time, ranked by IMDb user ratings. Browse and organise the highest-rated TV shows."
	/>
</svelte:head>

<div class="tv-portal-root">
	<!-- 4K IMMERSIVE TV HERO STAGE (REACHER) -->
	{#if hero}
		<section class="tv-hero-stage">
			<div class="hero-stage-bg">
				<img src={hero.backdropPath} alt="{hero.title} 4K Backdrop" class="hero-4k-image" />
				<div class="vignette-left"></div>
				<div class="vignette-bottom"></div>
				<div class="vignette-top"></div>
				<div class="vignette-ambient"></div>
			</div>

			<div class="container hero-container">
				<div class="hero-text-block">
					<div class="hero-tag-wrap">
						<span class="imdb-pill">IMDb</span>
						<span class="hero-tag">FEATURED SERIES</span>
					</div>
					<h1 class="hero-main-title">{hero.title}</h1>

					<div class="hero-meta-row">
						<span class="imdb-score-badge">
							<span class="star">★</span>
							<span>{hero.voteAverage}</span>
						</span>
						<span class="meta-item">{hero.year}</span>
						<span class="meta-dot">•</span>
						<span class="meta-genres">{hero.genres?.join(' • ')}</span>
					</div>

					<p class="hero-synopsis">{hero.overview}</p>

					<div class="hero-btn-row">
						<a href="/tv/{hero.tmdbId}" class="cineby-play-btn">
							<span class="play-icon">ⓘ</span>
							<span>View Series</span>
						</a>

						<a href="/tv/{hero.tmdbId}" class="cineby-info-btn">
							<span class="info-icon">ⓘ</span>
							<span>Episodes & playback status</span>
						</a>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- TOP 50 TV CHART CONTAINER -->
	<div class="container tv-chart-wrap">
		<header class="chart-header-bar">
			<div class="chart-title-box">
				<div class="imdb-badge-wrap">
					<span class="imdb-icon">IMDb</span>
					<span class="chart-tag">TOP 50 ALL-TIME TELEVISION CHART</span>
				</div>
				<h2 class="chart-main-title">Top 50 Ranked Television Masterpieces</h2>
				<p class="chart-subtitle">
					Ranked strictly by millions of verified IMDb reviews from #1 to #50.
				</p>
			</div>

			<!-- Search & Filter Controls -->
			<div class="controls-bar glass-card">
				<div class="search-wrap">
					<span class="search-icon">🔍</span>
					<input
						type="search"
						aria-label="Search Top 50 TV shows"
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
							aria-pressed={selectedGenre === genre}
							onclick={() => (selectedGenre = genre)}
						>
							{genre}
						</button>
					{/each}
				</div>
			</div>
		</header>

		<!-- TV Shows Grid -->
		<section class="tv-grid">
			{#if filteredShows.length === 0}
				<div class="empty-state glass-card">
					<p class="empty-emoji">📺</p>
					<h3>No TV shows match your filter</h3>
					<p class="empty-hint">Try clearing your search query or selecting a different genre.</p>
					<Button
						variant="outline"
						onclick={() => {
							searchQuery = '';
							selectedGenre = 'All';
						}}>Reset Filters</Button
					>
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
								<span class="star">★</span>
								<span class="score">{show.imdbRating}</span>
							</div>
						</div>

						<!-- Show Info -->
						<div class="tv-info">
							<div class="tv-header">
								<h3 class="tv-title">{show.title}</h3>
								<div class="tv-meta">
									<span class="meta-year">{show.year}</span>
									<span class="meta-dot">•</span>
									<span class="meta-seasons"
										>{show.seasonsCount || 1}
										{(show.seasonsCount || 1) === 1 ? 'Season' : 'Seasons'}</span
									>
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
									<span>View series</span>
								</a>
							</div>
						</div>
					</article>
				{/each}
			{/if}
		</section>
	</div>
</div>

<style>
	.tv-portal-root {
		background: transparent;
		color: #f1f5f9;
		min-height: 100vh;
	}

	/* 4K IMMERSIVE TV HERO */
	.tv-hero-stage {
		position: relative;
		width: 100%;
		height: 75vh;
		min-height: 520px;
		max-height: 800px;
		display: flex;
		align-items: center;
		overflow: hidden;
		margin-bottom: 2rem;
	}

	.hero-stage-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
	}

	.hero-4k-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 15%;
	}

	.vignette-left {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			#0a0e17 0%,
			rgba(10, 14, 23, 0.9) 32%,
			rgba(10, 14, 23, 0.3) 65%,
			transparent 100%
		);
	}

	.vignette-bottom {
		position: absolute;
		inset: 0;
		background: linear-gradient(0deg, #0a0e17 0%, rgba(10, 14, 23, 0.8) 25%, transparent 60%);
	}

	.vignette-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 120px;
		background: linear-gradient(180deg, rgba(10, 14, 23, 0.5) 0%, transparent 100%);
	}

	.vignette-ambient {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 60%);
	}

	.hero-container {
		position: relative;
		z-index: 2;
		width: 100%;
	}

	.hero-text-block {
		max-width: 620px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hero-tag-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.imdb-pill {
		background: #f5c518;
		color: #000000;
		font-weight: 900;
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.hero-tag {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.15rem 0.6rem;
		border-radius: 9999px;
		font-family: monospace;
	}

	.hero-main-title {
		font-size: 3.8rem;
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1.05;
		color: #ffffff;
		text-transform: uppercase;
		margin: 0;
	}

	@media (max-width: 768px) {
		.hero-main-title {
			font-size: 2.4rem;
		}
	}

	.hero-meta-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.imdb-score-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: #f59e0b;
		font-weight: 800;
	}

	.imdb-score-badge .star {
		color: #f59e0b;
	}

	.meta-dot {
		color: #64748b;
	}

	.hero-synopsis {
		font-size: 0.95rem;
		line-height: 1.6;
		color: #94a3b8;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0;
	}

	.hero-btn-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-top: 0.5rem;
	}

	@media (max-width: 420px) {
		.cineby-play-btn,
		.cineby-info-btn {
			flex: 1 1 100%;
			justify-content: center;
		}
	}

	.cineby-play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #ffffff;
		color: #0a0e17;
		font-size: 0.95rem;
		font-weight: 800;
		padding: 0.75rem 1.6rem;
		border-radius: 9999px;
		text-decoration: none;
		box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
		transition: all 0.2s ease;
	}

	.cineby-play-btn:hover {
		background: #10b981;
		transform: scale(1.04);
	}

	.cineby-info-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.75rem 1.4rem;
		border-radius: 9999px;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(12px);
		transition: all 0.2s ease;
	}

	.cineby-info-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.04);
	}

	/* TOP 50 TV CHART SECTION */
	.tv-chart-wrap {
		padding-bottom: 5rem;
	}

	.chart-header-bar {
		margin-bottom: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.imdb-badge-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.imdb-icon {
		background: #f5c518;
		color: #000000;
		font-weight: 900;
		font-size: 0.78rem;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
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

	.chart-main-title {
		font-size: 2.2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: #f1f5f9;
		margin: 0 0 0.5rem 0;
	}

	.chart-subtitle {
		font-size: 0.95rem;
		color: #94a3b8;
		margin: 0;
	}

	.controls-bar {
		padding: 1rem 1.25rem;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: rgba(16, 22, 35, 0.85);
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
		color: #f1f5f9;
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
		color: #94a3b8;
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
		color: #0a0e17;
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
		background: rgba(16, 22, 35, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition:
			transform 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.tv-card:hover {
		transform: translateY(-4px);
		border-color: rgba(16, 185, 129, 0.35);
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
	}

	.rank-badge {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 10;
		background: rgba(10, 14, 23, 0.9);
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
	}

	.rank-badge.silver {
		background: #94a3b8;
		color: #000000;
	}

	.rank-badge.bronze {
		background: #b45309;
		color: #ffffff;
	}

	.poster-box {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		overflow: hidden;
		background: #090d16;
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
		color: #f1f5f9;
		letter-spacing: -0.01em;
		margin: 0 0 0.25rem 0;
	}

	.tv-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.tv-overview {
		font-size: 0.82rem;
		color: #64748b;
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
		color: #94a3b8;
		font-size: 0.68rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.watch-tv-btn {
		background: #10b981;
		color: #0a0e17;
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.watch-tv-btn:hover {
		background: #34d399;
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
