<script lang="ts">
	import MoviePoster from './MoviePoster.svelte';

	interface Props {
		id: string | number;
		title: string;
		posterPath: string | null;
		releaseDate?: string | null;
		voteAverage?: number | string | null;
		genres?: string[];
	}

	let { id, title, posterPath, releaseDate, voteAverage, genres }: Props = $props();

	const year = $derived(
		releaseDate ? new Date(releaseDate).getFullYear() : null
	);

	const ratingFormatted = $derived(
		voteAverage ? Number(voteAverage).toFixed(1) : null
	);
</script>

<a href="/movies/{id}" class="movie-card">
	<div class="poster-wrapper">
		<MoviePoster path={posterPath} {title} />
		
		{#if ratingFormatted && ratingFormatted !== '0.0'}
			<div class="rating-badge" title="IMDb Rating">
				<span class="imdb-tag">IMDb</span>
				<span class="score">{ratingFormatted}</span>
			</div>
		{/if}
	</div>

	<div class="card-info">
		<h3 class="movie-title">{title}</h3>
		<div class="meta-row">
			{#if year}
				<span class="movie-year">{year}</span>
			{/if}
			{#if genres && genres.length > 0}
				<span class="dot">•</span>
				<span class="movie-genre">{genres[0]}</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.movie-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		transition: transform var(--transition-fast);
	}

	.movie-card:hover {
		transform: translateY(-4px);
	}

	.poster-wrapper {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: box-shadow var(--transition-fast);
	}

	.movie-card:hover .poster-wrapper {
		box-shadow: var(--shadow-md), 0 0 0 1px var(--border-accent);
	}

	.rating-badge {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.45rem;
		background: rgba(7, 8, 11, 0.85);
		backdrop-filter: blur(8px);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.imdb-tag {
		background: #f5c518;
		color: #000;
		font-weight: 900;
		font-size: 0.65rem;
		padding: 1px 4px;
		border-radius: 3px;
		letter-spacing: -0.02em;
	}

	.card-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.movie-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.3;
		display: -webkit-box;
		line-clamp: 1;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
		transition: color var(--transition-fast);
	}

	.movie-card:hover .movie-title {
		color: var(--accent-gold);
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.dot {
		opacity: 0.5;
	}

	.movie-genre {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
