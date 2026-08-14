<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toast';
	import { onMount, onDestroy } from 'svelte';

	let { data } = $props();

	let heroIndex = $state(0);
	let carouselInterval: any = null;

	const featuredMovies = $derived(
		(data.top10 || [])
			.filter((m: any) => m.backdropPath && m.backdropPath !== 'null')
			.slice(0, 5)
	);

	const currentHero = $derived(featuredMovies[heroIndex] || data.top10?.[0] || data.trending?.[0] || null);

	const heroHref = $derived(
		currentHero ? `/cinema/movies/${currentHero.id || currentHero.tmdbId}` : '/movies/catalog'
	);

	const top10Today = $derived(data.top10 || []);

	function nextHero() {
		if (featuredMovies.length > 1) {
			heroIndex = (heroIndex + 1) % featuredMovies.length;
		}
	}

	function setHero(idx: number) {
		heroIndex = idx;
		resetTimer();
	}

	function resetTimer() {
		if (carouselInterval) clearInterval(carouselInterval);
		carouselInterval = setInterval(nextHero, 8000);
	}

	onMount(() => {
		resetTimer();
	});

	onDestroy(() => {
		if (carouselInterval) clearInterval(carouselInterval);
	});
</script>

<svelte:head>
	<title>CinemaDB — Next-Gen 4K Movies & Cinema Archive</title>
	<meta
		name="description"
		content="Discover, stream, and archive the greatest films in cinematic history with seamless 4K backdrops."
	/>
</svelte:head>

<div class="cineby-home-root">
	<!-- 4K IMMERSIVE HERO STAGE -->
	<section class="cineby-hero">
		{#if currentHero}
			<!-- Full-Bleed 4K Backdrop with Seamless Multi-Stop Vignette -->
			<div class="hero-stage-bg">
				<img
					src={currentHero.backdropPath?.startsWith('http')
						? currentHero.backdropPath
						: `https://image.tmdb.org/t/p/original${currentHero.backdropPath?.startsWith('/') ? '' : '/'}${currentHero.backdropPath}`}
					alt="{currentHero.title} 4K Backdrop"
					class="hero-4k-image"
				/>
				<div class="vignette-left"></div>
				<div class="vignette-bottom"></div>
				<div class="vignette-top"></div>
				<div class="vignette-ambient"></div>
			</div>

			<!-- Left-Aligned Cinematic Information Card -->
			<div class="container hero-container">
				<div class="hero-text-block">
					<h1 class="hero-main-title">{currentHero.title}</h1>

					<!-- Rating & Meta Row -->
					<div class="hero-meta-row">
						<span class="imdb-score-badge">
							<span class="star">★</span>
							<span>{Number(currentHero.voteAverage || 8.0).toFixed(1)}</span>
						</span>

						{#if currentHero.releaseDate}
							<span class="meta-item">{new Date(currentHero.releaseDate).getFullYear()}</span>
						{/if}

						{#if currentHero.genres && currentHero.genres.length > 0}
							<span class="meta-dot">•</span>
							<span class="meta-genres">
								{currentHero.genres
									.slice(0, 3)
									.map((g: any) => g.genre?.name || g.name || (typeof g === 'string' ? g : ''))
									.filter(Boolean)
									.join(' • ')}
							</span>
						{/if}
					</div>

					<!-- Crisp Overview -->
					<p class="hero-synopsis">{currentHero.overview}</p>

					<!-- Action Buttons -->
					<div class="hero-btn-row">
						<a href={heroHref} class="cineby-play-btn">
							<span class="play-icon">▶</span>
							<span>Play</span>
						</a>

						<a href={heroHref} class="cineby-info-btn">
							<span class="info-icon">ⓘ</span>
							<span>See More</span>
						</a>

						<form
							action="?/toggleWatchlist"
							method="POST"
							use:enhance={() => {
								addToast(`Updated watchlist for ${currentHero.title}`, 'success');
							}}
							class="inline-block"
						>
							<input type="hidden" name="movieId" value={currentHero.id} />
							<button type="submit" class="cineby-watchlist-btn" title="Add to Watchlist">
								<span>+</span>
							</button>
						</form>
					</div>

					<!-- Featured Carousel Dots -->
					{#if featuredMovies.length > 1}
						<div class="carousel-dots-row">
							{#each featuredMovies as _, idx}
								<button
									type="button"
									class="carousel-dot"
									class:active={heroIndex === idx}
									onclick={() => setHero(idx)}
									aria-label="Slide {idx + 1}"
								></button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	<!-- CONTENT CATALOG SECTIONS -->
	<div class="container content-sections-wrap">
		<!-- 1. TOP 10 TODAY (With Rank Numbers) -->
		<section class="catalog-section">
			<div class="section-title-bar">
				<span class="title-accent-bar"></span>
				<h2 class="section-heading">TOP 10 Today</h2>
			</div>

			<div class="top10-horizontal-grid">
				{#each top10Today as movie, idx (movie.id || movie.tmdbId)}
					<a
						href="/cinema/movies/{movie.id || movie.tmdbId}"
						class="top10-card"
						data-sveltekit-preload-data="hover"
					>
						<span class="top10-rank-num">{idx + 1}</span>
						<div class="top10-poster-wrap">
							<MoviePoster path={movie.posterPath} title={movie.title} />
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- 2. TRENDING MOVIES -->
		<section class="catalog-section">
			<div class="section-title-bar">
				<span class="title-accent-bar emerald"></span>
				<h2 class="section-heading">Trending Movies</h2>
				<a href="/movies/catalog" class="view-all-link">Browse All Catalog →</a>
			</div>

			<div class="movies-media-grid">
				{#each (data.trending || []).slice(0, 12) as movie (movie.id || movie.tmdbId)}
					<MovieCard
						id={movie.id || movie.tmdbId}
						title={movie.title}
						posterPath={movie.posterPath}
						releaseDate={movie.releaseDate}
						voteAverage={movie.voteAverage}
						genres={movie.genres?.map(
							(g: any) => g.genre?.name || g.name || (typeof g === 'string' ? g : '')
						)}
					/>
				{/each}
			</div>
		</section>

		<!-- 3. TV SERIES DISCOVERY BANNER (Cross-Navigation) -->
		<section class="tv-crossover-banner glass-card">
			<div class="crossover-content">
				<span class="crossover-badge">📺 TELEVISION ARCHIVE</span>
				<h3 class="crossover-title">Explore the Top 50 IMDb-Ranked TV Series</h3>
				<p class="crossover-desc">
					Stream Breaking Bad, Reacher, Planet Earth, Chernobyl, Arcane, and the greatest television sagas in history.
				</p>
			</div>
			<a href="/tvshows" class="crossover-btn">
				<span>Explore TV Shows Chart →</span>
			</a>
		</section>

		<!-- 4. HIGHEST RATED CINEMA MASTERPIECES -->
		<section class="catalog-section">
			<div class="section-title-bar">
				<span class="title-accent-bar"></span>
				<h2 class="section-heading">Top Rated Cinema Masterpieces</h2>
				<a href="/movies/catalog?sort=rating" class="view-all-link">Explore Top Rated →</a>
			</div>

			<div class="movies-media-grid">
				{#each (data.topRated || []).slice(0, 12) as movie (movie.id || movie.tmdbId)}
					<MovieCard
						id={movie.id || movie.tmdbId}
						title={movie.title}
						posterPath={movie.posterPath}
						releaseDate={movie.releaseDate}
						voteAverage={movie.voteAverage}
						genres={movie.genres?.map(
							(g: any) => g.genre?.name || g.name || (typeof g === 'string' ? g : '')
						)}
					/>
				{/each}
			</div>
		</section>
	</div>
</div>

<style>
	.cineby-home-root {
		background: transparent;
		color: #f1f5f9;
		min-height: 100vh;
	}

	/* 4K IMMERSIVE HERO STAGE */
	.cineby-hero {
		position: relative;
		width: 100%;
		height: 80vh;
		min-height: 560px;
		max-height: 860px;
		display: flex;
		align-items: center;
		overflow: hidden;
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
		object-position: center 20%;
		animation: heroFadeIn 0.8s ease-out;
	}

	@keyframes heroFadeIn {
		from { opacity: 0; transform: scale(1.02); }
		to { opacity: 1; transform: scale(1); }
	}

	/* 4-Way Vignette Masking for Ultra-Seamless Blending (Soft Midnight Slate) */
	.vignette-left {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, #0a0e17 0%, rgba(10, 14, 23, 0.9) 32%, rgba(10, 14, 23, 0.3) 65%, transparent 100%);
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

	/* Hero Text & Controls */
	.hero-container {
		position: relative;
		z-index: 2;
		width: 100%;
		display: flex;
		align-items: center;
	}

	.hero-text-block {
		max-width: 620px;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		animation: textSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes textSlideUp {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.hero-main-title {
		font-size: 3.5rem;
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1.05;
		color: #ffffff;
		text-transform: uppercase;
		text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
		margin: 0;
	}

	@media (max-width: 768px) {
		.hero-main-title {
			font-size: 2.25rem;
		}
	}

	.hero-meta-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
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
		color: #cbd5e1;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
	}

	/* Hero Button Row */
	.hero-btn-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		margin-top: 0.5rem;
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
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.cineby-play-btn:hover {
		background: #10b981;
		color: #0a0e17;
		transform: scale(1.04);
		box-shadow: 0 6px 25px rgba(16, 185, 129, 0.4);
	}

	.cineby-info-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.75rem 1.4rem;
		border-radius: 9999px;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(12px);
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.cineby-info-btn:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: rgba(255, 255, 255, 0.3);
		transform: scale(1.04);
	}

	.cineby-watchlist-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-size: 1.3rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(12px);
		transition: all 0.2s ease;
	}

	.cineby-watchlist-btn:hover {
		background: #10b981;
		color: #0a0e17;
		border-color: #10b981;
		transform: scale(1.08);
	}

	.carousel-dots-row {
		display: flex;
		gap: 0.45rem;
		margin-top: 0.5rem;
	}

	.carousel-dot {
		width: 24px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.2);
		border: none;
		cursor: pointer;
		transition: all 0.25s ease;
	}

	.carousel-dot.active {
		width: 38px;
		background: #10b981;
		box-shadow: 0 0 8px #10b981;
	}

	/* CONTENT CATALOG SECTIONS */
	.content-sections-wrap {
		display: flex;
		flex-direction: column;
		gap: 3.5rem;
		padding-bottom: 5rem;
	}

	.catalog-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-title-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.title-accent-bar {
		width: 4px;
		height: 22px;
		border-radius: 2px;
		background: #ef4444;
	}

	.title-accent-bar.emerald {
		background: #10b981;
	}

	.section-heading {
		font-size: 1.4rem;
		font-weight: 800;
		color: #f1f5f9;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.view-all-link {
		margin-left: auto;
		font-size: 0.85rem;
		font-weight: 700;
		color: #10b981;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.view-all-link:hover {
		text-decoration: underline;
	}

	/* TOP 10 HORIZONTAL GRID */
	.top10-horizontal-grid {
		display: flex;
		gap: 1.25rem;
		overflow-x: auto;
		padding: 0.5rem 0 1rem 0;
		scrollbar-width: none;
	}

	.top10-card {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-width: 200px;
		text-decoration: none;
		transition: transform 0.2s ease;
	}

	.top10-card:hover {
		transform: translateY(-6px);
	}

	.top10-rank-num {
		font-size: 6.5rem;
		font-weight: 900;
		line-height: 0.8;
		color: #0a0e17;
		-webkit-text-stroke: 3px rgba(255, 255, 255, 0.25);
		font-family: 'Plus Jakarta Sans', sans-serif;
		margin-right: -25px;
		z-index: 2;
		pointer-events: none;
		user-select: none;
		transition: -webkit-text-stroke 0.2s ease;
	}

	.top10-card:hover .top10-rank-num {
		-webkit-text-stroke: 3px #ef4444;
	}

	.top10-poster-wrap {
		position: relative;
		z-index: 1;
		width: 140px;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* MOVIES MEDIA GRID */
	.movies-media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 1.25rem;
	}

	@media (min-width: 1024px) {
		.movies-media-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	/* CROSSOVER BANNER */
	.tv-crossover-banner {
		padding: 2rem 2.5rem;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: flex-start;
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 22, 35, 0.95) 100%);
		border: 1px solid rgba(245, 158, 11, 0.25);
	}

	@media (min-width: 768px) {
		.tv-crossover-banner {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.crossover-content {
		max-width: 680px;
	}

	.crossover-badge {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #f59e0b;
		margin-bottom: 0.5rem;
		display: block;
		font-family: monospace;
	}

	.crossover-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #f1f5f9;
		margin: 0 0 0.5rem 0;
	}

	.crossover-desc {
		font-size: 0.9rem;
		color: #94a3b8;
		line-height: 1.5;
		margin: 0;
	}

	.crossover-btn {
		background: #f59e0b;
		color: #000000;
		font-size: 0.88rem;
		font-weight: 800;
		padding: 0.75rem 1.4rem;
		border-radius: 12px;
		text-decoration: none;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.crossover-btn:hover {
		background: #fbbf24;
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
	}
</style>
