<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toast';

	let { data } = $props();

	const heroMovie = $derived(data.trending[0] || null);

	const btnColorTest = $derived(data.abTests?.cta_button_color || 'control');
	const ctaVariant = $derived(btnColorTest === 'test_green' ? 'success' : 'primary');
</script>

<svelte:head>
	<title>CinemaDB — Your Personal Cinema Archive</title>
	<meta
		name="description"
		content="Explore millions of movies, track your personal cinema history, and discover film as art."
	/>
	<meta property="og:title" content="CinemaDB — Your Personal Cinema Archive" />
	<meta
		property="og:description"
		content="Explore millions of movies, track your personal cinema history, and discover film as art."
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<!-- Hero Section -->
<section class="hero-section">
	{#if heroMovie?.backdropPath && heroMovie.backdropPath !== 'null'}
		<div class="hero-backdrop">
			<img
				src={heroMovie.backdropPath.startsWith('http') 
					? heroMovie.backdropPath 
					: `https://image.tmdb.org/t/p/w1280${heroMovie.backdropPath.startsWith('/') ? '' : '/'}${heroMovie.backdropPath}`}
				alt="{heroMovie.title} Backdrop"
				class="backdrop-img"
			/>
			<div class="backdrop-overlay"></div>
		</div>
	{:else}
		<div class="hero-backdrop fallback-bg"></div>
	{/if}

	<div class="container hero-content">
		<div class="hero-badge">
			<Badge variant="gold">✨ 2026 CINEMA OPERATING SYSTEM</Badge>
		</div>

		{#if heroMovie}
			<h1 class="hero-title">{heroMovie.title}</h1>
			<p class="hero-overview">{heroMovie.overview}</p>

			<div class="hero-actions">
				<Button href="/movies/{heroMovie.id}" variant={ctaVariant} size="lg">▶ View Details</Button>
				<form
					action="?/toggleWatchlist"
					method="POST"
					use:enhance={() => {
						addToast(`Added "${heroMovie.title}" to watchlist ✓`, 'success');
					}}
				>
					<input type="hidden" name="movieId" value={heroMovie.id} />
					<Button type="submit" variant="secondary" size="lg">+ Add to Watchlist</Button>
				</form>
			</div>
		{:else}
			<h1 class="hero-title">The Next Generation Cinema Database</h1>
			<p class="hero-overview">
				Explore millions of movies, track your personal cinema history, and discover film as art.
				Self-hosted, private, and open-source.
			</p>
			<div class="hero-actions">
				<Button href="/search" variant="primary" size="lg">🔍 Start Exploring</Button>
			</div>
		{/if}
	</div>
</section>

<!-- Main Feed -->
<div class="container page-feed">
	<!-- Trending Movies -->
	<section class="section-block">
		<div class="section-header">
			<h2 class="section-title">🔥 Trending Movies</h2>
			<a href="/search" class="see-all">See All →</a>
		</div>

		{#if data.trending.length > 0}
			<div class="grid-movies">
				{#each data.trending as movie}
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
			<div class="empty-state">
				<p>🎬 Database is initializing...</p>
				{#if data.error}
					<p class="subtext" style="color: var(--accent-red); margin-top: 1rem;">
						<strong>Error:</strong>
						{data.error}
					</p>
				{/if}
				<p class="subtext">
					Run <code>pnpm --filter cinema-worker ingest:popular</code> to populate movies!
				</p>
			</div>
		{/if}
	</section>

	<!-- Top Rated Movies -->
	{#if data.topRated.length > 0}
		<section class="section-block">
			<div class="section-header">
				<h2 class="section-title">⭐ Highest Rated</h2>
				<a href="/search" class="see-all">See All →</a>
			</div>

			<div class="grid-movies">
				{#each data.topRated as movie}
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
		</section>
	{/if}
</div>

<style>
	/* Hero Section */
	.hero-section {
		position: relative;
		min-height: 520px;
		display: flex;
		align-items: flex-end;
		padding-bottom: 4rem;
		padding-top: 6rem;
		overflow: hidden;
	}

	.hero-backdrop {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.backdrop-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.65) saturate(1.2);
	}

	.backdrop-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(7, 8, 11, 0.4) 0%,
			rgba(7, 8, 11, 0.8) 70%,
			var(--bg-primary) 100%
		);
	}

	.fallback-bg {
		background: radial-gradient(circle at 50% 30%, var(--bg-surface-3), var(--bg-primary));
	}

	.hero-content {
		position: relative;
		z-index: 10;
		max-width: 800px;
	}

	.hero-badge {
		margin-bottom: 1rem;
	}

	.hero-title {
		font-size: 2.75rem;
		font-weight: 800;
		line-height: 1.15;
		color: #ffffff;
		margin-bottom: 1rem;
		letter-spacing: -0.02em;
		word-break: break-word;
	}

	@media (min-width: 768px) {
		.hero-title {
			font-size: 3.75rem;
		}
	}

	.hero-overview {
		font-size: 1.05rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 2rem;
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 680px;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	/* Sections */
	.page-feed {
		padding-top: 2rem;
	}

	.section-block {
		margin-bottom: 3.5rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.see-all {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--accent-gold);
		transition: opacity var(--transition-fast);
	}

	.see-all:hover {
		opacity: 0.8;
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
	}

	.subtext {
		font-size: 0.9rem;
		color: var(--text-tertiary);
		margin-top: 0.5rem;
	}

	code {
		background: var(--bg-surface-3);
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-sm);
		color: var(--accent-gold);
		font-size: 0.85rem;
	}
</style>
