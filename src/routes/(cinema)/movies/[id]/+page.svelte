<script lang="ts">
	import { fade } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import PlayIcon from 'lucide-svelte/icons/play';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import PlayerSheet from '$lib/components/movie/PlayerSheet.svelte';
	import AlanScorePanel from '$lib/components/movie/AlanScorePanel.svelte';

	let { data, form } = $props();
	const movie = $derived(data.movie);

	let isPlayerOpen = $state(false);

	const metadata = $derived.by(() => {
		const values: string[] = [];
		const releaseDate = movie.releaseDate ? new Date(movie.releaseDate) : null;
		if (releaseDate && !Number.isNaN(releaseDate.getTime())) {
			values.push(String(releaseDate.getFullYear()));
		}

		const runtime = Number(movie.runtime);
		if (Number.isFinite(runtime) && runtime > 0) {
			const hours = Math.floor(runtime / 60);
			const minutes = runtime % 60;
			values.push(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
		}

		const rating = Number(movie.voteAverage);
		if (Number.isFinite(rating) && rating > 0) {
			values.push(`${rating.toFixed(1)} / 10`);
		}

		return values;
	});

	const displayGenres = $derived(
		(movie.genres ?? [])
			.map((relation: { genre?: { name?: string }; name?: string }) => relation.genre ?? relation)
			.filter((genre: { name?: string }) => genre.name)
			.slice(0, 3)
	);

	const backdropPath = $derived(movie.backdropPath || movie.posterPath || null);
	const canonicalUrl = $derived(`https://alandatabase.com/movies/${movie.id}`);
	const metaDescription = $derived(
		(movie.overview || `Explore ${movie.title} on Alan Database.`).slice(0, 155)
	);
	const socialImage = $derived(
		backdropPath ? getImageUrl(backdropPath, movie.backdropPath ? 'w1280' : 'w780') : null
	);
	const structuredMovie = $derived.by(() => {
		const value: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'Movie',
			name: movie.title,
			url: canonicalUrl,
			description: movie.overview || undefined,
			image: socialImage || undefined,
			dateCreated: movie.releaseDate || undefined,
			actor: (movie.cast ?? []).slice(0, 10).map((credit: any) => ({
				'@type': 'Person',
				name: credit.person.name,
				url: `https://alandatabase.com/people/${credit.person.id}`
			})),
			director: (movie.crew ?? [])
				.filter((credit: any) => credit.job === 'Director')
				.map((credit: any) => ({
					'@type': 'Person',
					name: credit.person.name,
					url: `https://alandatabase.com/people/${credit.person.id}`
				}))
		};
		const runtime = Number(movie.runtime);
		if (Number.isFinite(runtime) && runtime > 0) value.duration = `PT${Math.trunc(runtime)}M`;
		const rating = Number(movie.voteAverage);
		const ratingCount = Number(movie.voteCount);
		if (Number.isFinite(rating) && rating > 0 && Number.isFinite(ratingCount) && ratingCount > 0) {
			value.aggregateRating = {
				'@type': 'AggregateRating',
				ratingValue: rating,
				bestRating: 10,
				ratingCount
			};
		}
		return value;
	});
	const structuredMovieJson = $derived(JSON.stringify(structuredMovie).replaceAll('<', '\\u003c'));

	function getImageUrl(path: string | null, size = 'w1280') {
		if (!path) return '';
		if (path.startsWith('http://') || path.startsWith('https://')) return path;
		return `https://image.tmdb.org/t/p/${size}${path}`;
	}
</script>

<svelte:head>
	<title>{movie.title} | Alan Database</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={`${movie.title} | Alan Database`} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="video.movie" />
	<meta property="og:url" content={canonicalUrl} />
	{#if socialImage}<meta property="og:image" content={socialImage} />{/if}
	<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
	<svelte:element this={"script"} type="application/ld+json">{structuredMovieJson}</svelte:element>
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
		{#if backdropPath}
			<img src={getImageUrl(backdropPath)} alt="" class="backdrop-img" />
		{/if}
		<div class="backdrop-gradient"></div>
	</div>

	<!-- Content Layer -->
	<div class="content-layer">
		<div class="title-section">
			<h1 class="movie-title">{movie.title}</h1>
			{#if metadata.length > 0}
				<div class="meta-row">
					{#each metadata as value, index (value)}
						{#if index > 0}<span class="dot" aria-hidden="true">•</span>{/if}
						<span>{value}</span>
					{/each}
				</div>
			{/if}

			<div class="genres">
				{#each displayGenres as genre (genre.name)}
					<span class="genre-tag">{genre.name}</span>
				{/each}
			</div>
		</div>

		<div class="actions-row">
			<Button
				variant="primary"
				size="lg"
				class="play-btn w-full"
				onclick={() => (isPlayerOpen = true)}
			>
				<PlayIcon size={20} class="mr-2" />
				Playback status
			</Button>
		</div>

		<div class="synopsis-section">
			<p class="overview">{movie.overview}</p>
		</div>

		{#if data.personal}
			<AlanScorePanel
				movieId={movie.id}
				score={data.personal.alanScore}
				legacyRating={data.personal.legacyRating}
				{form}
			/>
		{/if}

		{#if data.credits && data.credits.length > 0}
			<div class="cast-section">
				<h2 class="section-title">Top Cast</h2>
				<div class="cast-scroll">
					{#each data.credits as actor}
						<a class="cast-card" href={`/people/${actor.id}`}>
							{#if actor.profilePath}
								<img
									src={getImageUrl(actor.profilePath, 'w185')}
									alt={actor.name}
									loading="lazy"
									class="actor-img"
								/>
							{:else}
								<div class="actor-img actor-fallback" aria-hidden="true">?</div>
							{/if}
							<span class="actor-name">{actor.name}</span>
							<span class="character-name">{actor.character}</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if isPlayerOpen}
	<PlayerSheet {movie} onClose={() => (isPlayerOpen = false)} />
{/if}

<style>
	.movie-detail-container {
		position: relative;
		min-height: 100dvh;
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
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
	}

	.back-btn {
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		width: 44px;
		height: 44px;
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
		height: 65svh;
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
		background: linear-gradient(to top, #000 0%, rgba(0, 0, 0, 0.5) 40%, transparent 100%);
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
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
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
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.05);
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

	.actor-fallback {
		display: grid;
		place-items: center;
		color: #a1a1aa;
		font-size: 1.5rem;
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
