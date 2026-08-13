<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	
	let { data } = $props();
</script>

<svelte:head>
	<title>Discover | CinemaDB</title>
</svelte:head>

<div class="discover-page">
	<header class="hero-banner">
		<div class="hero-content">
			<h1 class="hero-title">Discover</h1>
			<p class="hero-subtitle">
				Premium recommendations tailored for your Personal OS.
			</p>
		</div>
		<div class="hero-overlay"></div>
	</header>

	<div class="container sections-container">
		<!-- Section: Trending -->
		{#if data.trending && data.trending.length > 0}
			<section class="movie-section">
				<h2 class="section-title">🔥 Trending & Popular</h2>
				<div class="horizontal-scroller">
					{#each data.trending as movie}
						<div class="scroller-item">
							<MovieCard
								id={movie.id}
								title={movie.title}
								posterPath={movie.posterPath}
								releaseDate={movie.releaseDate}
								voteAverage={movie.voteAverage}
								genres={movie.genres?.map((g: any) => g.genre?.name)}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Section: Top Rated -->
		{#if data.topRated && data.topRated.length > 0}
			<section class="movie-section">
				<h2 class="section-title">🏆 Top Rated Masterpieces</h2>
				<div class="horizontal-scroller">
					{#each data.topRated as movie}
						<div class="scroller-item">
							<MovieCard
								id={movie.id}
								title={movie.title}
								posterPath={movie.posterPath}
								releaseDate={movie.releaseDate}
								voteAverage={movie.voteAverage}
								genres={movie.genres?.map((g: any) => g.genre?.name)}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Section: Custom / Adult Cinema -->
		{#if data.customCinema && data.customCinema.length > 0}
			<section class="movie-section">
				<h2 class="section-title text-emerald-400">🔒 Private Archive & Custom Sources</h2>
				<div class="horizontal-scroller">
					{#each data.customCinema as movie}
						<div class="scroller-item">
							<MovieCard
								id={movie.id}
								title={movie.title}
								posterPath={movie.posterPath}
								releaseDate={movie.releaseDate}
								voteAverage={movie.voteAverage}
								genres={movie.genres?.map((g: any) => g.genre?.name)}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Section: Recent Releases -->
		{#if data.recentReleases && data.recentReleases.length > 0}
			<section class="movie-section">
				<h2 class="section-title">🆕 Recent Additions</h2>
				<div class="horizontal-scroller">
					{#each data.recentReleases as movie}
						<div class="scroller-item">
							<MovieCard
								id={movie.id}
								title={movie.title}
								posterPath={movie.posterPath}
								releaseDate={movie.releaseDate}
								voteAverage={movie.voteAverage}
								genres={movie.genres?.map((g: any) => g.genre?.name)}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.discover-page {
		padding-bottom: 6rem;
	}

	.hero-banner {
		position: relative;
		height: 35vh;
		min-height: 250px;
		display: flex;
		align-items: flex-end;
		padding: 2rem 0;
		background: linear-gradient(
			to right,
			var(--bg-surface-2),
			var(--bg-primary)
		);
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 3rem;
	}

	.hero-content {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	.hero-title {
		font-size: 3.5rem;
		font-weight: 900;
		color: #ffffff;
		letter-spacing: -0.03em;
		margin-bottom: 0.5rem;
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--text-secondary);
		max-width: 600px;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.08), transparent 50%);
		pointer-events: none;
	}

	.sections-container {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.movie-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.01em;
		padding-left: 0.5rem;
		border-left: 4px solid var(--accent-emerald);
	}

	.horizontal-scroller {
		display: flex;
		overflow-x: auto;
		gap: 1.25rem;
		padding: 0.5rem;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}

	.horizontal-scroller::-webkit-scrollbar {
		display: none; /* Safari and Chrome */
	}

	.scroller-item {
		flex: 0 0 160px;
		scroll-snap-align: start;
	}

	@media (min-width: 640px) {
		.scroller-item {
			flex: 0 0 180px;
		}
	}

	@media (min-width: 1024px) {
		.scroller-item {
			flex: 0 0 200px;
		}
	}
</style>
