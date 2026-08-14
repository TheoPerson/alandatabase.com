<script lang="ts">
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { addToast } from '$lib/stores/toast';

	let { data } = $props();
	const show = $derived(data.show);

	let selectedSeason = $state(1);
	let selectedEpisode = $state(1);
	let selectedServer = $state('vidsrc-pro');

	const currentSeasonObj = $derived(
		show.seasons?.find((s: any) => s.season_number === selectedSeason) || show.seasons?.[0]
	);

	const episodeCount = $derived(currentSeasonObj?.episode_count || 10);

	const trailer = $derived(
		show.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ||
		show.videos?.results?.[0]
	);

	const servers = $derived([
		{
			id: 'vidsrc-pro',
			name: '⚡ VidSrc Pro HD',
			badge: 'Multi-Sub',
			url: `https://vidsrc.pro/embed/tv/${show.id}/${selectedSeason}/${selectedEpisode}`
		},
		{
			id: 'vidsrc-me',
			name: '🇬🇧 VidSrc ME',
			badge: 'VOSTFR',
			url: `https://vidsrc.me/embed/tv?tmdb=${show.id}&season=${selectedSeason}&episode=${selectedEpisode}`
		},
		{
			id: 'super-embed',
			name: '🎥 SuperEmbed TV',
			badge: 'HD Mirror',
			url: `https://autoembed.to/tv/tmdb/${show.id}-${selectedSeason}-${selectedEpisode}`
		},
		...(trailer
			? [
					{
						id: 'youtube-trailer',
						name: '▶ Official Trailer',
						badge: '4K',
						url: `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`
					}
			  ]
			: [])
	]);

	const activeServerUrl = $derived(
		servers.find((s) => s.id === selectedServer)?.url || servers[0]?.url
	);

	function shareShow() {
		if (typeof navigator !== 'undefined') {
			navigator.clipboard.writeText(window.location.href);
			addToast('🔗 Series link copied to clipboard!', 'success');
		}
	}
</script>

<svelte:head>
	<title>{show.name} ({show.first_air_date ? new Date(show.first_air_date).getFullYear() : ''}) | CinemaDB TV</title>
	<meta name="description" content={show.overview} />
</svelte:head>

<div class="tv-detail-page">
	<!-- Hero Backdrop -->
	{#if show.backdrop_path}
		<div class="backdrop-wrapper">
			<img
				src="https://image.tmdb.org/t/p/original{show.backdrop_path}"
				alt={show.name}
				class="backdrop-img"
			/>
			<div class="backdrop-gradient"></div>
		</div>
	{/if}

	<div class="container content-wrap">
		<div class="layout-grid">
			<!-- Left Column: Poster & Quick Info -->
			<aside class="left-col">
				<div class="sticky-sidebar">
					<div class="poster-frame">
						<MoviePoster path={show.poster_path} title={show.name} size="w500" />
					</div>

					<div class="sidebar-actions">
						<Button variant="outline" class="w-full" onclick={shareShow}>
							🔗 Share Series
						</Button>
						<a href="/tv" class="back-link">
							← Back to Top 50 Chart
						</a>
					</div>
				</div>
			</aside>

			<!-- Right Column: Player & Series Details -->
			<main class="right-col">
				<!-- Title & Badges -->
				<header class="show-header">
					<div class="tag-row">
						<Badge variant="gold">IMDb {Number(show.vote_average || 8.9).toFixed(1)}</Badge>
						<span class="meta-year">{show.first_air_date ? new Date(show.first_air_date).getFullYear() : ''}</span>
						<span class="meta-dot">•</span>
						<span class="meta-seasons">{show.number_of_seasons} Seasons ({show.number_of_episodes} Episodes)</span>
					</div>
					<h1 class="show-title">{show.name}</h1>
					{#if show.tagline}
						<p class="show-tagline">« {show.tagline} »</p>
					{/if}
				</header>

				<!-- Multi-Server TV Player Console -->
				<section class="tv-player-card glass-card">
					<!-- Episode & Season Selector Header -->
					<div class="player-controls-bar">
						<div class="selector-group">
							<label for="season-select" class="selector-label">Season</label>
							<select id="season-select" bind:value={selectedSeason} class="custom-select">
								{#each (show.seasons || []).filter((s: any) => s.season_number > 0) as s}
									<option value={s.season_number}>Season {s.season_number} ({s.episode_count} eps)</option>
								{/each}
							</select>
						</div>

						<div class="selector-group">
							<label for="episode-select" class="selector-label">Episode</label>
							<select id="episode-select" bind:value={selectedEpisode} class="custom-select">
								{#each Array.from({ length: episodeCount }, (_, i) => i + 1) as ep}
									<option value={ep}>Episode {ep}</option>
								{/each}
							</select>
						</div>

						<!-- Server Mirrors -->
						<div class="mirrors-group">
							{#each servers as s}
								<button
									type="button"
									class="mirror-pill"
									class:active={selectedServer === s.id}
									onclick={() => (selectedServer = s.id)}
								>
									{s.name}
								</button>
							{/each}
						</div>
					</div>

					<!-- Video Iframe -->
					<div class="player-aspect-box">
						<iframe
							src={activeServerUrl}
							title="{show.name} Season {selectedSeason} Episode {selectedEpisode}"
							class="video-iframe"
							allowfullscreen
							allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
							referrerpolicy="no-referrer"
						></iframe>
					</div>
				</section>

				<!-- Show Overview & Genres -->
				<section class="show-meta-section glass-card">
					<h2 class="section-heading">Series Synopsis</h2>
					<p class="synopsis-text">{show.overview}</p>

					<div class="genres-row">
						{#each (show.genres || []) as g}
							<span class="genre-pill">{g.name}</span>
						{/each}
					</div>
				</section>
			</main>
		</div>
	</div>
</div>

<style>
	.tv-detail-page {
		position: relative;
		min-height: 100vh;
		padding-bottom: 5rem;
	}

	.backdrop-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 480px;
		overflow: hidden;
		z-index: 0;
	}

	.backdrop-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.25;
		filter: blur(2px);
	}

	.backdrop-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(5, 5, 7, 0.4) 0%, rgba(5, 5, 7, 1) 100%);
	}

	.content-wrap {
		position: relative;
		z-index: 1;
		padding-top: 2rem;
	}

	.layout-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 900px) {
		.layout-grid {
			grid-template-columns: 280px 1fr;
		}
	}

	.sticky-sidebar {
		position: sticky;
		top: 5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.poster-frame {
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.8);
	}

	.sidebar-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.back-link {
		color: #a1a1aa;
		font-size: 0.82rem;
		text-align: center;
		text-decoration: none;
		padding: 0.4rem;
		transition: color 0.15s ease;
	}

	.back-link:hover {
		color: #10b981;
	}

	/* Show Header */
	.show-header {
		margin-bottom: 1.5rem;
	}

	.tag-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
		color: #a1a1aa;
	}

	.show-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.03em;
		margin: 0 0 0.25rem 0;
	}

	.show-tagline {
		font-size: 1rem;
		font-style: italic;
		color: #10b981;
		margin: 0;
	}

	/* TV Player Card */
	.tv-player-card {
		border-radius: 18px;
		background: rgba(8, 12, 18, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
		margin-bottom: 2rem;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(16, 185, 129, 0.05);
	}

	.player-controls-bar {
		padding: 0.85rem 1.25rem;
		background: rgba(12, 16, 26, 0.95);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}

	.selector-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.selector-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #a1a1aa;
		font-family: monospace;
	}

	.custom-select {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.35rem 0.6rem;
		border-radius: 8px;
		outline: none;
		cursor: pointer;
	}

	.custom-select:focus {
		border-color: #10b981;
	}

	.mirrors-group {
		display: flex;
		gap: 0.35rem;
		margin-left: auto;
		flex-wrap: wrap;
	}

	.mirror-pill {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.mirror-pill:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.1);
	}

	.mirror-pill.active {
		background: #10b981;
		color: #050507;
		border-color: #10b981;
	}

	.player-aspect-box {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		background: #000000;
	}

	.video-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	/* Show Meta Section */
	.show-meta-section {
		padding: 1.5rem 2rem;
		border-radius: 18px;
		background: rgba(10, 13, 20, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	.section-heading {
		font-size: 1.2rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0 0 0.75rem 0;
	}

	.synopsis-text {
		font-size: 0.95rem;
		color: #d4d4d8;
		line-height: 1.6;
		margin: 0 0 1.25rem 0;
	}

	.genres-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.genre-pill {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.2);
		font-size: 0.78rem;
		font-weight: 700;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
	}
</style>
