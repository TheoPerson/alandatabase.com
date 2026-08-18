<script lang="ts">
	import { fade } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import PlayIcon from 'lucide-svelte/icons/play';
	import InfoIcon from 'lucide-svelte/icons/info';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import PlayerSheet from '$lib/components/movie/PlayerSheet.svelte';

	let { data } = $props();
	const movie = $derived(data.movie);
	
	let isPlayerOpen = $state(false);
	
	function formatRuntime(minutes: number) {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return `${h}h ${m}m`;
	}
	
	function getImageUrl(path: string | null, size = 'w1280') {
		if (!path) return '';
		return `https://image.tmdb.org/t/p/${size}${path}`;
	}
</script>

<svelte:head>
	<title>{movie.title} • CinemaDB</title>
</svelte:head>

<div class="movie-detail-container" in:fade={{ duration: 200 }}>
	<!-- Top Navigation Bar -->
	<header class="top-nav">
		<button class="back-btn" onclick={() => window.history.back()} aria-label="Go back">
			<ChevronLeftIcon size={24} />
		</button>
	</header>

	<!-- Cinematic Hero Background -->
	<div class="hero-backdrop">
		<img 
			src={getImageUrl(movie.backdrop_path)} 
			alt={movie.title}
			class="backdrop-img"
		/>
		<div class="backdrop-gradient"></div>
	</div>

	<!-- Content Layer -->
	<div class="content-layer">
		<div class="title-section">
			<h1 class="movie-title">{movie.title}</h1>
			<div class="meta-row">
				<span>{new Date(movie.release_date).getFullYear()}</span>
				<span class="dot">•</span>
				<span>{formatRuntime(movie.runtime)}</span>
				<span class="dot">•</span>
				<span>{movie.vote_average.toFixed(1)} / 10</span>
			</div>
			
			<div class="genres">
				{#each movie.genres.slice(0, 3) as genre}
					<span class="genre-tag">{genre.name}</span>
				{/each}
			</div>
		</div>

		<div class="actions-row">
			<Button variant="primary" size="lg" class="play-btn w-full" onclick={() => isPlayerOpen = true}>
				<PlayIcon size={20} class="mr-2" />
				Play Movie
			</Button>
		</div>

		<div class="synopsis-section">
			<p class="overview">{movie.overview}</p>
		</div>
		
		{#if data.credits && data.credits.length > 0}
			<div class="cast-section">
				<h2 class="section-title">Top Cast</h2>
				<div class="cast-scroll">
					{#each data.credits as actor}
						<div class="cast-card">
							<img src={getImageUrl(actor.profile_path, 'w185')} alt={actor.name} class="actor-img" />
							<span class="actor-name">{actor.name}</span>
							<span class="character-name">{actor.character}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if isPlayerOpen}
	<PlayerSheet 
		{movie} 
		onClose={() => isPlayerOpen = false} 
	/>
{/if}

<style>
	.movie-detail-container {
		position: relative;
		min-height: 100vh;
		background: #000;
		color: #fff;
		padding-bottom: 4rem;
	}

	.top-nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 64px;
		display: flex;
		align-items: center;
		padding: 0 1rem;
		z-index: 40;
		background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%);
	}

	.back-btn {
		background: rgba(0,0,0,0.4);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 50%;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.back-btn:active {
		transform: scale(0.95);
	}

	.hero-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 65vh;
		z-index: 10;
	}

	.backdrop-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top;
	}

	.backdrop-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, #000 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
	}

	.content-layer {
		position: relative;
		z-index: 20;
		padding: 0 1.25rem;
		padding-top: calc(65vh - 120px);
	}

	.title-section {
		margin-bottom: 1.5rem;
	}

	.movie-title {
		font-size: 2.25rem;
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 8px rgba(0,0,0,0.8);
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #a1a1aa;
		margin-bottom: 1rem;
	}

	.dot {
		font-size: 0.5rem;
		opacity: 0.5;
	}

	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.genre-tag {
		background: rgba(255,255,255,0.1);
		border: 1px solid rgba(255,255,255,0.05);
		padding: 0.25rem 0.75rem;
		border-radius: 99px;
		font-size: 0.75rem;
		font-weight: 500;
		backdrop-filter: blur(4px);
	}

	.actions-row {
		margin-bottom: 2rem;
	}
	
	:global(.play-btn) {
		font-size: 1.05rem;
		font-weight: 600;
		padding: 1.5rem 1rem;
		border-radius: 0.75rem;
		background: #fff;
		color: #000;
	}
	
	:global(.play-btn:active) {
		transform: scale(0.98);
	}

	.synopsis-section {
		margin-bottom: 2.5rem;
	}

	.overview {
		font-size: 0.95rem;
		line-height: 1.6;
		color: #d4d4d8;
	}
	
	.cast-section {
		margin-bottom: 2rem;
	}
	
	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #fff;
	}
	
	.cast-scroll {
		display: flex;
		overflow-x: auto;
		gap: 1rem;
		padding-bottom: 1rem;
		scrollbar-width: none; /* Firefox */
	}
	
	.cast-scroll::-webkit-scrollbar {
		display: none; /* Chrome/Safari */
	}
	
	.cast-card {
		flex: 0 0 100px;
		display: flex;
		flex-direction: column;
	}
	
	.actor-img {
		width: 100px;
		height: 140px;
		border-radius: 0.5rem;
		object-fit: cover;
		background: #1a1a1a;
		margin-bottom: 0.5rem;
	}
	
	.actor-name {
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.character-name {
		font-size: 0.7rem;
		color: #a1a1aa;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
