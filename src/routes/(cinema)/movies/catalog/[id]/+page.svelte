<script lang="ts">
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import StreamPlayerContainer from '$lib/components/player/StreamPlayerContainer.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { addToast } from '$lib/stores/toast';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const movie = $derived(data.movie);
	const user = $derived(data.user);
	const userInteraction = $derived(data.userInteraction);

	const directors = $derived(movie.crew.filter((c: any) => c.job === 'Director'));

	const trailer = $derived(
		movie.videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || movie.videos[0]
	);

	const releaseYear = $derived(
		movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A'
	);

	// Optimistic UI state
	let watched = $state(false);
	let watchlist = $state(false);
	let rating = $state<number | null>(null);

	$effect(() => {
		watched = data.userInteraction?.watched || false;
		watchlist = data.userInteraction?.watchlist || false;
		rating = data.userInteraction?.rating ? Number(data.userInteraction.rating) : null;
	});
</script>

<!-- Backdrop Banner -->
<div class="movie-backdrop-hero">
	{#if movie.backdropPath && movie.backdropPath !== 'null'}
		<img
			src="https://image.tmdb.org/t/p/original{movie.backdropPath.startsWith('/')
				? ''
				: '/'}{movie.backdropPath}"
			alt="{movie.title} Backdrop"
			class="backdrop-img"
		/>
	{/if}
	<div class="backdrop-gradient"></div>
</div>

<div class="container movie-detail-content">
	<div class="movie-layout">
		<!-- Left Sidebar (Poster & Actions) -->
		<aside class="poster-column">
			<div class="sticky-poster">
				<MoviePoster path={movie.posterPath} title={movie.title} size="w500" />

				<div class="action-buttons">
					{#if user}
						<!-- Watched Button -->
						<form
							method="POST"
							action="?/logInteraction"
							use:enhance={() => {
								const previous = watched;
								watched = !watched;
								return async ({ result, update }) => {
									if (result.type === 'error' || result.type === 'failure') {
										watched = previous;
									}
									await update({ reset: false });
								};
							}}
						>
							<input type="hidden" name="movieId" value={movie.id} />
							<input type="hidden" name="type" value="watched" />
							<input type="hidden" name="value" value={(!watched).toString()} />
							<Button type="submit" variant={watched ? 'success' : 'outline'} class="w-full">
								{watched ? '✔ Watched' : 'Mark as Watched'}
							</Button>
						</form>

						<!-- Watchlist Button -->
						<form
							method="POST"
							action="?/logInteraction"
							use:enhance={() => {
								const previous = watchlist;
								watchlist = !watchlist;
								return async ({ result, update }) => {
									if (result.type === 'error' || result.type === 'failure') {
										watchlist = previous;
									}
									await update({ reset: false });
								};
							}}
						>
							<input type="hidden" name="movieId" value={movie.id} />
							<input type="hidden" name="type" value="watchlist" />
							<input type="hidden" name="value" value={(!watchlist).toString()} />
							<Button type="submit" variant={watchlist ? 'success' : 'outline'} class="w-full">
								{watchlist ? '✔ On Watchlist' : '+ Add to Watchlist'}
							</Button>
						</form>

						<!-- Share Movie Button -->
						<Button
							variant="ghost"
							class="w-full"
							onclick={() => {
								if (typeof navigator !== 'undefined') {
									navigator.clipboard.writeText(window.location.href);
									addToast('🔗 Movie link copied to clipboard!', 'success');
								}
							}}
						>
							🔗 Share Film
						</Button>

						<!-- Rate Button -->
						<div class="rate-container glass-card">
							<span class="rate-label">Your Rating</span>
							<form
								method="POST"
								action="?/logInteraction"
								use:enhance={({ formData }) => {
									rating = Number(formData.get('value'));
									return async ({ update }) => {
										await update({ reset: false });
									};
								}}
								class="stars-form"
							>
								<input type="hidden" name="movieId" value={movie.id} />
								<input type="hidden" name="type" value="rating" />
								<div class="star-rating">
									{#each [1, 2, 3, 4, 5] as star}
										<button
											type="submit"
											name="value"
											value={star}
											class="star-btn"
											class:active={rating !== null && rating >= star}
										>
											★
										</button>
									{/each}
								</div>
							</form>
						</div>

						<div class="lists-container glass-card mt-4">
							<span class="rate-label mb-2 block">Add to Lists</span>
							{#if data.userCustomLists.length === 0}
								<p class="text-sm text-gray-400 mb-3">You don't have any custom lists yet.</p>
								<Button href="/my/lists/create" variant="ghost" class="text-xs py-1"
									>Create a List</Button
								>
							{:else}
								<div class="list-toggles flex flex-col gap-2">
									{#each data.userCustomLists as list}
										{@const inList = list.items.some((i: any) => i.movieId === movie.id)}
										<form method="POST" action="?/toggleList" use:enhance>
											<input type="hidden" name="listId" value={list.id} />
											<input type="hidden" name="movieId" value={movie.id} />
											<label class="list-toggle-label cursor-pointer flex items-center gap-2">
												<input
													type="checkbox"
													checked={inList}
													onchange={(e) => e.currentTarget.form?.requestSubmit()}
													class="accent-emerald-500"
												/>
												<span class="text-sm text-gray-200">{list.name}</span>
											</label>
										</form>
									{/each}
								</div>
								<div class="mt-4 border-t border-white/10 pt-3 text-center">
									<a href="/my/lists" class="text-xs text-emerald-400 hover:underline"
										>Manage Lists</a
									>
								</div>
							{/if}
						</div>
					{:else}
						<div class="auth-prompt glass-card">
							<p>Log in to track this film.</p>
							<Button href="/auth/login" variant="primary" class="w-full">Sign In</Button>
						</div>
					{/if}
				</div>
			</div>
		</aside>

		<!-- Main Movie Info -->
		<main class="info-column">
			<!-- Header Title & Tagline -->
			<div class="header-group">
				<h1 class="movie-title">
					{movie.title}
					<span class="year">({releaseYear})</span>
				</h1>

				{#if movie.tagline}
					<p class="tagline">"{movie.tagline}"</p>
				{/if}

				<!-- Key Specs & Badges -->
				<div class="meta-pills">
					{#if movie.voteAverage}
						<Badge variant="gold">★ {Number(movie.voteAverage).toFixed(1)} / 10</Badge>
					{/if}

					{#if movie.runtime}
						<Badge variant="surface">⏱ {movie.runtime} min</Badge>
					{/if}

					{#if movie.originalLanguage}
						<Badge variant="outline">{movie.originalLanguage.toUpperCase()}</Badge>
					{/if}

					{#each movie.genres as g}
						<Badge variant="surface">{(g as any).genre?.name || ''}</Badge>
					{/each}
				</div>
			</div>

			<!-- Directors & Creators -->
			{#if directors.length > 0}
				<div class="director-block">
					<span class="label">Directed by</span>
					<div class="names">
						{#each directors as d}
							<span class="director-name">{d.person.name}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Synopsis / Overview -->
			<section class="info-section">
				<h2 class="section-heading">Overview</h2>
				<p class="overview-text">{movie.overview || 'No overview available.'}</p>
			</section>

			<!-- Top Cast -->
			{#if movie.cast.length > 0}
				<section class="info-section">
					<h2 class="section-heading">Top Cast</h2>
					<div class="cast-grid">
						{#each movie.cast as actor}
							<div class="cast-card">
								{#if actor.person.profilePath}
									<img
										src="https://image.tmdb.org/t/p/w185{actor.person.profilePath}"
										alt={actor.person.name}
										class="cast-img"
									/>
								{:else}
									<div class="cast-img-placeholder">👤</div>
								{/if}
								<div class="cast-info">
									<p class="actor-name">{actor.person.name}</p>
									<p class="character-name">{actor.character || ''}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Multi-Server HD Cinema Player -->
			<section class="info-section">
				<h2 class="section-heading">🎬 Watch Cinema Stream & Official Trailer</h2>
				<StreamPlayerContainer
					tmdbId={movie.tmdbId || movie.id}
					imdbId={movie.imdbId}
					title={movie.title}
					trailerKey={trailer?.key}
				/>
			</section>
		</main>
	</div>
</div>

<style>
	.movie-backdrop-hero {
		position: relative;
		height: 420px;
		width: 100%;
		overflow: hidden;
	}

	.backdrop-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.5) saturate(1.2);
	}

	.backdrop-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(7, 8, 11, 0.2) 0%,
			rgba(7, 8, 11, 0.8) 70%,
			var(--bg-primary) 100%
		);
	}

	.movie-detail-content {
		position: relative;
		z-index: 10;
		margin-top: -160px;
		padding-bottom: 5rem;
	}

	.movie-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.5rem;
	}

	@media (min-width: 840px) {
		.movie-layout {
			grid-template-columns: 280px 1fr;
			gap: 3.5rem;
		}
	}

	.sticky-poster {
		position: sticky;
		top: 90px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	:global(.w-full) {
		width: 100%;
	}

	.rate-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		border-radius: var(--radius-md);
		gap: 0.5rem;
	}

	.rate-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.star-rating {
		display: flex;
		gap: 0.25rem;
	}

	.star-btn {
		font-size: 1.5rem;
		color: var(--bg-surface-3);
		transition: all var(--transition-fast);
		cursor: pointer;
	}

	.star-btn.active,
	.star-btn:hover {
		color: var(--rating-star);
		transform: scale(1.1);
	}

	/* Keep rest of styles unchanged */

	.auth-prompt {
		padding: 1.5rem;
		border-radius: var(--radius-md);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.auth-prompt p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.movie-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.15;
		letter-spacing: -0.02em;
	}

	.year {
		color: var(--text-tertiary);
		font-weight: 400;
	}

	.tagline {
		font-size: 1.1rem;
		font-style: italic;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.meta-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}

	.director-block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.director-block .label {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.director-name {
		font-weight: 700;
		color: var(--accent-gold);
		font-size: 1.05rem;
	}

	.info-section {
		margin-top: 2.5rem;
	}

	.section-heading {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.85rem;
	}

	.overview-text {
		font-size: 1.05rem;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	/* Cast Grid */
	.cast-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 1rem;
	}

	.cast-card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.cast-img {
		width: 100%;
		height: 150px;
		object-fit: cover;
	}

	.cast-img-placeholder {
		width: 100%;
		height: 150px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface-2);
		font-size: 2rem;
	}

	.cast-info {
		padding: 0.5rem;
	}

	.actor-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.character-name {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}


</style>
