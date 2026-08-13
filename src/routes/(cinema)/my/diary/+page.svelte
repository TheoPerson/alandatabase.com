<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	let { data } = $props();

	const ACTION_LABELS: Record<string, { icon: string; label: string; color: string }> = {
		rated: { icon: '★', label: 'Rated', color: '#f59e0b' },
		watched: { icon: '✓', label: 'Watched', color: '#10b981' },
		favorited: { icon: '♥', label: 'Favorited', color: '#ec4899' },
		watchlisted: { icon: '⊕', label: 'Watchlisted', color: '#6366f1' },
		reviewed: { icon: '✎', label: 'Reviewed', color: '#3b82f6' }
	};

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTime(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
	}

	function groupByDay(entries: typeof data.diary) {
		const groups = new SvelteMap<string, typeof data.diary>();
		for (const entry of entries) {
			const day = new Date(entry.createdAt).toDateString();
			if (!groups.has(day)) groups.set(day, []);
			groups.get(day)!.push(entry);
		}
		return groups;
	}

	const grouped = $derived(groupByDay(data.diary));
</script>

<svelte:head>
	<title>My Diary — The Alan's Database</title>
</svelte:head>

<div class="diary-page container">
	<header class="page-header">
		<div class="header-icon">📖</div>
		<div>
			<h1 class="page-title">My Diary</h1>
			<p class="page-subtitle">
				{data.diary.length} action{data.diary.length !== 1 ? 's' : ''} logged
			</p>
		</div>
	</header>

	{#if data.diary.length === 0}
		<div class="empty-state glass-card">
			<p class="empty-icon">🎬</p>
			<h3>Nothing here yet</h3>
			<p>Start watching, rating, and favoriting films — your diary will build itself.</p>
			<a href="/" class="cta-link">Browse Films →</a>
		</div>
	{:else}
		<div class="timeline">
			{#each grouped as [day, entries]}
				<div class="day-group">
					<div class="day-label">
						<span class="day-dot"></span>
						<span class="day-text">{formatDate(entries[0].createdAt.toString())}</span>
					</div>

					<div class="day-entries">
						{#each entries as entry}
							{@const action = ACTION_LABELS[entry.actionType] ?? {
								icon: '•',
								label: entry.actionType,
								color: '#71717a'
							}}
							<div class="diary-entry glass-card glass-card-hover">
								<div class="entry-time">{formatTime(entry.createdAt.toString())}</div>

								<div
									class="action-badge"
									style="color: {action.color}; border-color: {action.color}33; background: {action.color}0f;"
								>
									<span class="action-icon">{action.icon}</span>
									<span class="action-label">{action.label}</span>
									{#if (entry.metadata as any)?.rating}
										<span class="action-meta">{(entry.metadata as any).rating}★</span>
									{/if}
								</div>

								{#if entry.movie}
									<a href="/movies/{entry.movie.id}" class="entry-movie">
										{#if entry.movie.posterPath}
											<img
												src="https://image.tmdb.org/t/p/w92{entry.movie.posterPath}"
												alt={entry.movie.title}
												class="movie-thumb"
											/>
										{/if}
										<div class="movie-info">
											<span class="movie-title">{entry.movie.title}</span>
											{#if entry.movie.releaseDate}
												<span class="movie-year">{entry.movie.releaseDate.substring(0, 4)}</span>
											{/if}
										</div>
									</a>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.diary-page {
		padding-top: 3rem;
		padding-bottom: 6rem;
		max-width: 720px;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 3rem;
	}

	.header-icon {
		font-size: 2.5rem;
	}

	.page-title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 0.25rem;
	}

	.page-subtitle {
		font-size: 0.9rem;
		color: var(--text-tertiary);
		margin: 0;
	}

	/* Empty state */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		border-radius: var(--radius-lg);
	}

	.empty-icon {
		font-size: 3rem;
		margin: 0 0 1rem;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.5rem;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin: 0 0 1.5rem;
	}

	.cta-link {
		color: var(--color-accent);
		font-weight: 600;
		text-decoration: none;
	}

	/* Timeline */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.day-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.day-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: sticky;
		top: 0;
		z-index: 10;
		padding: 0.4rem 0;
		background: var(--bg-base);
	}

	.day-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		flex-shrink: 0;
	}

	.day-text {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* Entries */
	.day-entries {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-left: 1.2rem;
		border-left: 1px solid rgba(255, 255, 255, 0.06);
	}

	.diary-entry {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		cursor: default;
	}

	.entry-time {
		font-size: 0.72rem;
		color: var(--text-tertiary);
		font-variant-numeric: tabular-nums;
		min-width: 42px;
		flex-shrink: 0;
	}

	.action-badge {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.65rem;
		border-radius: 99px;
		border: 1px solid;
		font-size: 0.78rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.action-icon {
		font-size: 0.85rem;
	}

	.action-meta {
		opacity: 0.75;
	}

	.entry-movie {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		min-width: 0;
		flex: 1;
		transition: opacity 0.15s;
	}

	.entry-movie:hover {
		opacity: 0.75;
	}

	.movie-thumb {
		width: 28px;
		height: 42px;
		object-fit: cover;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.movie-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.movie-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.movie-year {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}
</style>
