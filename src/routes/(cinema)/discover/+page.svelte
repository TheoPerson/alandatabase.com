<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Discover | CinemaDB</title>
</svelte:head>

<div class="discover-page">
	<header class="hero-banner">
		{#if data.dailyMasterpiece?.backdropPath}
			<img
				src={data.dailyMasterpiece.backdropPath.startsWith('http')
					? data.dailyMasterpiece.backdropPath
					: `https://image.tmdb.org/t/p/w1280${data.dailyMasterpiece.backdropPath.startsWith('/') ? '' : '/'}${data.dailyMasterpiece.backdropPath}`}
				alt="Masterpiece"
				class="hero-bg"
			/>
		{/if}
		<div class="hero-overlay"></div>
		<div class="hero-content">
			<span class="eyebrow">Daily Masterpiece</span>
			<h1 class="hero-title">{data.dailyMasterpiece?.title || 'Discover'}</h1>
			<p class="hero-subtitle">
				{data.dailyMasterpiece?.tagline || 'Premium recommendations tailored for your Personal OS.'}
			</p>
			<div class="hero-actions">
				{#if data.dailyMasterpiece}
					<a href="/movies/{data.dailyMasterpiece.id}" class="btn-primary">View Details</a>
				{/if}
				<a href="/movies/catalog" class="btn-secondary">Browse All Movies</a>
			</div>
		</div>
	</header>

	<div class="container sections-container">
		{#if data.degraded}
			<p class="degraded-notice" role="status">
				Some discovery collections are temporarily unavailable. The available collections are shown
				below.
			</p>
		{/if}
		<!-- Vibe Clusters -->
		{#each data.vibes as vibe}
			{#if vibe.movies.length > 0}
				<section class="movie-section">
					<h2 class="section-title">{vibe.title}</h2>
					<div class="horizontal-scroller">
						{#each vibe.movies as movie}
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
		{/each}

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
	</div>
</div>

<style>
	.discover-page {
		padding-bottom: 6rem;
	}

	.hero-banner {
		position: relative;
		height: 60vh;
		min-height: 400px;
		display: flex;
		align-items: flex-end;
		padding: 4rem 0;
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 3rem;
		overflow: hidden;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.4) saturate(1.2);
		z-index: 0;
	}

	.hero-content {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	.eyebrow {
		display: inline-block;
		color: var(--accent-gold);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	.hero-title {
		font-size: 4rem;
		font-weight: 900;
		color: #ffffff;
		letter-spacing: -0.03em;
		margin-bottom: 0.5rem;
		line-height: 1.1;
		max-width: 800px;
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--text-secondary);
		max-width: 600px;
		margin-bottom: 2rem;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: var(--accent-gold);
		color: #000;
		font-weight: 700;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
	}

	.btn-primary:hover {
		filter: brightness(1.1);
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		background: var(--bg-surface-glass);
		border: 1px solid var(--border-subtle);
		color: #fff;
		font-weight: 600;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
		backdrop-filter: blur(10px);
	}

	.btn-secondary:hover {
		background: var(--bg-surface-2);
		border-color: var(--border-strong);
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--bg-primary) 0%, transparent 60%);
		z-index: 1;
		pointer-events: none;
	}

	.sections-container {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.degraded-notice {
		padding: 1rem 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		background: var(--bg-secondary);
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
