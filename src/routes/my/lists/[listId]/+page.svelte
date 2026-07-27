<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();
	const list = data.list;
	const isOwner = data.isOwner;
</script>

<div class="container list-page">
	<header class="page-header">
		<div>
			<h1 class="title">{list.name}</h1>
			<p class="subtitle">
				By {list.user.displayName || list.user.username} • {list.items.length} films • {list.isPublic ? 'Public' : 'Private'}
			</p>
			{#if list.description}
				<p class="description">{list.description}</p>
			{/if}
		</div>
		<div class="actions">
			{#if isOwner}
				<form method="POST" action="?/deleteList" use:enhance>
					<Button type="submit" variant="ghost" class="text-red-400">🗑️ Delete List</Button>
				</form>
			{/if}
		</div>
	</header>

	<div class="items-grid">
		{#if list.items.length === 0}
			<div class="empty-state glass-panel">
				<div class="icon">🎬</div>
				<h3>List is empty</h3>
				<p>Search for movies and add them to this list.</p>
			</div>
		{:else}
			{#each list.items as item (item.movieId)}
				<div class="item-card glass-panel">
					<a href="/movies/{item.movie.id}" class="poster-link">
						{#if item.movie.posterPath}
							<img src="https://image.tmdb.org/t/p/w342{item.movie.posterPath}" alt={item.movie.title} />
						{:else}
							<div class="placeholder">No Image</div>
						{/if}
					</a>
					<div class="item-info">
						<h3 class="movie-title"><a href="/movies/{item.movie.id}">{item.movie.title}</a></h3>
						{#if item.movie.releaseDate}
							<p class="movie-year">{item.movie.releaseDate.substring(0, 4)}</p>
						{/if}
					</div>
					{#if isOwner}
						<form method="POST" action="?/removeItem" use:enhance class="remove-action">
							<input type="hidden" name="movieId" value={item.movieId} />
							<button class="remove-btn" title="Remove from list">✕</button>
						</form>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.list-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 3rem;
	}

	.title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--text-tertiary);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.description {
		margin-top: 1.5rem;
		color: var(--text-secondary);
		max-width: 800px;
		line-height: 1.6;
	}

	.empty-state {
		grid-column: 1 / -1;
		padding: 4rem 2rem;
		text-align: center;
		border-radius: var(--radius-lg);
	}

	.empty-state .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 2rem;
	}

	.item-card {
		display: flex;
		flex-direction: column;
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
	}

	.item-card:hover {
		transform: translateY(-4px);
		border-color: var(--border-accent);
	}

	.item-card:hover .remove-btn {
		opacity: 1;
	}

	.poster-link {
		display: block;
		aspect-ratio: 2 / 3;
		background: var(--bg-surface-2);
	}

	.poster-link img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.9rem;
	}

	.item-info {
		padding: 1rem;
	}

	.movie-title {
		font-weight: 700;
		font-size: 1rem;
		line-height: 1.3;
		margin-bottom: 0.25rem;
	}

	.movie-title a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.movie-year {
		color: var(--text-tertiary);
		font-size: 0.85rem;
	}

	.remove-action {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
	}

	.remove-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(0,0,0,0.6);
		color: white;
		border: 1px solid rgba(255,255,255,0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
		backdrop-filter: blur(4px);
	}

	.remove-btn:hover {
		background: rgba(239, 68, 68, 0.9);
		border-color: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	/* Always show remove button on touch devices */
	@media (hover: none) {
		.remove-btn {
			opacity: 1;
		}
	}
</style>
