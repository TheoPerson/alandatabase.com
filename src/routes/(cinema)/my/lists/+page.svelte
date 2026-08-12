<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();
	const lists = data.lists;
</script>

<div class="container lists-page">
	<header class="page-header">
		<div>
			<h1 class="title">My Lists</h1>
			<p class="subtitle">Create and manage your custom movie collections.</p>
		</div>
		<Button href="/my/lists/create" variant="primary">+ Create List</Button>
	</header>

	{#if lists.length === 0}
		<div class="empty-state glass-panel">
			<div class="icon">📋</div>
			<h3>No lists yet</h3>
			<p>Create a custom list to organize your favorite films.</p>
			<Button href="/my/lists/create" variant="primary" class="mt-4">Create First List</Button>
		</div>
	{:else}
		<div class="lists-grid">
			{#each lists as list}
				<a href="/my/lists/{list.id}" class="list-card glass-panel">
					<div class="covers">
						{#if list.items.length === 0}
							<div class="empty-cover">Empty</div>
						{:else}
							{#each list.items as item, i}
								{#if item.movie.posterPath}
									<img
										src="https://image.tmdb.org/t/p/w154{item.movie.posterPath}"
										alt="Cover"
										class="cover-img"
										style="z-index: {4 - i}; transform: translateX({i * 10}px);"
									/>
								{/if}
							{/each}
						{/if}
					</div>
					<div class="list-info">
						<h3 class="list-title">{list.name}</h3>
						<p class="list-meta">
							{list.items.length} films • {list.isPublic ? 'Public' : 'Private'}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lists-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 3rem;
	}

	.title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.subtitle {
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.empty-state {
		padding: 4rem 2rem;
		text-align: center;
		border-radius: var(--radius-lg);
	}

	.empty-state .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.empty-state p {
		color: var(--text-secondary);
	}

	.lists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 2rem;
	}

	.list-card {
		display: block;
		padding: 1.5rem;
		border-radius: var(--radius-lg);
		text-decoration: none;
		transition:
			transform var(--transition-fast),
			border-color var(--transition-fast);
	}

	.list-card:hover {
		transform: translateY(-4px);
		border-color: var(--border-accent);
	}

	.covers {
		position: relative;
		height: 140px;
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
	}

	.cover-img {
		position: absolute;
		width: 90px;
		height: 135px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.empty-cover {
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.05);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.9rem;
		border: 1px dashed rgba(255, 255, 255, 0.1);
	}

	.list-info {
		text-align: center;
	}

	.list-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.list-meta {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}
</style>
