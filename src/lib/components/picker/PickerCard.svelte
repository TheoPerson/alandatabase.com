<script lang="ts">
	import type { PickerRecommendationResponse } from '$lib/server/picker/types';

	interface Props {
		recommendation: PickerRecommendationResponse;
		isFavorited: boolean;
		isWatchlisted: boolean;
		isWatched: boolean;
		loading: boolean;
		onAnother: () => void;
		onNotTonight: () => void;
		onToggleFavorite: () => void;
		onToggleWatchlist: () => void;
		onToggleWatched: () => void;
	}

	let {
		recommendation,
		isFavorited,
		isWatchlisted,
		isWatched,
		loading,
		onAnother,
		onNotTonight,
		onToggleFavorite,
		onToggleWatchlist,
		onToggleWatched
	}: Props = $props();

	const movie = $derived(recommendation.movie);
	const signals = $derived(recommendation.signals);

	const year = $derived(movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null);

	const formattedRuntime = $derived(
		movie.runtime
			? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60 ? `${movie.runtime % 60}m` : ''}`.trim()
			: null
	);

	const posterUrl = $derived(
		movie.posterPath
			? movie.posterPath.startsWith('http')
				? movie.posterPath
				: `https://image.tmdb.org/t/p/w780${movie.posterPath}`
			: '/placeholder-poster.jpg'
	);

	const backdropUrl = $derived(
		movie.backdropPath
			? movie.backdropPath.startsWith('http')
				? movie.backdropPath
				: `https://image.tmdb.org/t/p/w1280${movie.backdropPath}`
			: null
	);

	function formatVoteCount(count: number | null): string {
		if (!count) return '';
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${Math.round(count / 1000)}k`;
		return String(count);
	}
</script>

<article class="picker-card" class:loading>
	{#if backdropUrl}
		<div class="backdrop-glow" style="background-image: url('{backdropUrl}');"></div>
	{/if}

	<div class="card-inner">
		<!-- Left: Movie Poster -->
		<div class="poster-container">
			<img src={posterUrl} alt={movie.title} class="movie-poster" loading="eager" />

			<!-- Quick-Action floating buttons -->
			<div class="quick-actions-overlay">
				<button
					type="button"
					class="quick-action-btn"
					class:active={isFavorited}
					onclick={onToggleFavorite}
					title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
					aria-label="Toggle Favorite"
				>
					{isFavorited ? '❤️' : '🤍'}
				</button>
				<button
					type="button"
					class="quick-action-btn"
					class:active={isWatchlisted}
					onclick={onToggleWatchlist}
					title={isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
					aria-label="Toggle Watchlist"
				>
					{isWatchlisted ? '🔖' : '📑'}
				</button>
				<button
					type="button"
					class="quick-action-btn"
					class:active={isWatched}
					onclick={onToggleWatched}
					title={isWatched ? 'Watched' : 'Mark as Watched'}
					aria-label="Toggle Watched"
				>
					{isWatched ? '✔️' : '👁️'}
				</button>
			</div>
		</div>

		<!-- Right: Details & Decision Area -->
		<div class="details-container">
			<!-- Header: Title & Meta -->
			<div class="movie-header">
				<div class="badge-row">
					{#if recommendation.mode === 'discovery'}
						<span class="mode-badge discovery">✨ DISCOVERY PICK</span>
					{:else}
						<span class="mode-badge safe">🎯 CURATED MATCH</span>
					{/if}

					{#if year}
						<span class="meta-pill">{year}</span>
					{/if}
					{#if formattedRuntime}
						<span class="meta-pill">{formattedRuntime}</span>
					{/if}
				</div>

				<h2 class="movie-title">{movie.title}</h2>

				{#if movie.originalTitle && movie.originalTitle !== movie.title}
					<p class="movie-original-title">{movie.originalTitle}</p>
				{/if}

				{#if movie.genres && movie.genres.length > 0}
					<div class="genres-row">
						{#each movie.genres as g}
							<span class="genre-tag">{g}</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Ratings Bar -->
			<div class="ratings-row">
				{#if signals.imdbRating}
					<div class="rating-box imdb-box" title="Authentic IMDb Rating">
						<span class="imdb-logo">IMDb</span>
						<span class="rating-score">★ {signals.imdbRating.toFixed(1)}</span>
						{#if movie.imdbVoteCount}
							<span class="vote-volume">({formatVoteCount(movie.imdbVoteCount)})</span>
						{/if}
					</div>
				{/if}

				{#if signals.tmdbRating && signals.tmdbRating > 0}
					<div class="rating-box tmdb-box" title="TMDB Community Rating">
						<span class="tmdb-label">TMDB</span>
						<span class="rating-score">{signals.tmdbRating.toFixed(1)}</span>
						{#if movie.tmdbVoteCount}
							<span class="vote-volume">({formatVoteCount(movie.tmdbVoteCount)})</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Synopsis -->
			<p class="movie-overview">{movie.overview}</p>

			<!-- Cast & Crew -->
			<div class="crew-meta">
				{#if movie.director}
					<div class="crew-item">
						<span class="crew-label">Director:</span>
						<span class="crew-value">{movie.director}</span>
					</div>
				{/if}
				{#if movie.topCast && movie.topCast.length > 0}
					<div class="crew-item">
						<span class="crew-label">Cast:</span>
						<span class="crew-value">{movie.topCast.join(', ')}</span>
					</div>
				{/if}
			</div>

			<!-- "WHY THIS PICK" Card -->
			<div class="why-card">
				<div class="why-header">
					<span class="why-spark">💡</span>
					<span class="why-title">WHY THIS PICK</span>
				</div>
				<p class="why-body">{recommendation.reason}</p>
			</div>

			<!-- Primary Actions -->
			<div class="actions-group">
				<a href="/movies/{movie.id}" class="btn-primary-watch">
					<span>🎬 OPEN / WATCH MOVIE</span>
				</a>

				<div class="secondary-actions">
					<button
						type="button"
						class="btn-decision btn-skip"
						onclick={onNotTonight}
						disabled={loading}
					>
						<span>✕ Not Tonight</span>
					</button>

					<button
						type="button"
						class="btn-decision btn-another"
						onclick={onAnother}
						disabled={loading}
					>
						<span>↻ Another</span>
					</button>
				</div>
			</div>
		</div>
	</div>
</article>

<style>
	.picker-card {
		position: relative;
		width: 100%;
		max-width: 960px;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xl);
		overflow: hidden;
		box-shadow: var(--shadow-lg);
		transition: opacity var(--transition-fast), transform var(--transition-fast);
	}

	.picker-card.loading {
		opacity: 0.6;
		pointer-events: none;
	}

	.backdrop-glow {
		position: absolute;
		top: -20%;
		right: -10%;
		width: 80%;
		height: 80%;
		background-size: cover;
		background-position: center;
		filter: blur(80px);
		opacity: 0.18;
		pointer-events: none;
		z-index: 0;
	}

	.card-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		gap: 2rem;
	}

	@media (min-width: 768px) {
		.card-inner {
			flex-direction: row;
			padding: 2.5rem;
			gap: 3rem;
		}
	}

	/* Poster */
	.poster-container {
		position: relative;
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		flex-shrink: 0;
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-2);
		aspect-ratio: 2 / 3;
	}

	.movie-poster {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform var(--transition-normal);
	}

	.poster-container:hover .movie-poster {
		transform: scale(1.02);
	}

	.quick-actions-overlay {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.quick-action-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(10, 14, 23, 0.85);
		backdrop-filter: blur(10px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		font-size: 0.95rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.quick-action-btn:hover {
		background: rgba(22, 30, 48, 0.95);
		transform: scale(1.1);
	}

	/* Details */
	.details-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.badge-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.mode-badge {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-sm);
	}

	.mode-badge.safe {
		background: var(--accent-emerald-subtle);
		border: 1px solid var(--accent-emerald);
		color: var(--accent-emerald);
	}

	.mode-badge.discovery {
		background: rgba(139, 92, 246, 0.15);
		border: 1px solid #8b5cf6;
		color: #a78bfa;
	}

	.meta-pill {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		font-weight: 600;
	}

	.movie-title {
		font-size: 1.85rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.2;
		letter-spacing: -0.02em;
	}

	@media (min-width: 768px) {
		.movie-title {
			font-size: 2.2rem;
		}
	}

	.movie-original-title {
		font-size: 0.9rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.genres-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.genre-tag {
		padding: 0.2rem 0.6rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	/* Ratings */
	.ratings-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.rating-box {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.imdb-box {
		background: rgba(245, 197, 24, 0.12);
		border: 1px solid rgba(245, 197, 24, 0.4);
		color: #f5c518;
	}

	.imdb-logo {
		background: #f5c518;
		color: #000;
		font-size: 0.65rem;
		font-weight: 900;
		padding: 1px 4px;
		border-radius: 3px;
	}

	.tmdb-box {
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
	}

	.tmdb-label {
		color: var(--text-tertiary);
		font-size: 0.7rem;
		font-weight: 800;
	}

	.vote-volume {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		font-weight: 500;
	}

	/* Synopsis */
	.movie-overview {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-secondary);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.crew-meta {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
	}

	.crew-label {
		color: var(--text-tertiary);
		font-weight: 600;
		margin-right: 0.4rem;
	}

	.crew-value {
		color: var(--text-primary);
	}

	/* Why Card */
	.why-card {
		background: rgba(16, 22, 35, 0.9);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: var(--radius-md);
		padding: 1rem 1.25rem;
	}

	.why-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.35rem;
	}

	.why-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		color: var(--accent-emerald);
	}

	.why-body {
		font-size: 0.88rem;
		color: var(--text-primary);
		line-height: 1.45;
	}

	/* Actions */
	.actions-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.btn-primary-watch {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.95rem 1.5rem;
		background: var(--accent-emerald);
		border-radius: var(--radius-md);
		color: #000;
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: -0.01em;
		text-decoration: none;
		box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);
		transition: all var(--transition-fast);
	}

	.btn-primary-watch:hover {
		background: var(--accent-emerald-hover);
		transform: translateY(-2px);
		box-shadow: 0 6px 25px rgba(16, 185, 129, 0.45);
	}

	.secondary-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-decision {
		flex: 1;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-skip {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
	}

	.btn-skip:hover {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.4);
		color: #f87171;
	}

	.btn-another {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
	}

	.btn-another:hover {
		background: var(--bg-surface-3);
		border-color: var(--border-strong);
		color: var(--accent-emerald);
	}
</style>
