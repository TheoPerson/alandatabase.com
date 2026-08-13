<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import MovieCard from '$lib/components/movie/MovieCard.svelte';

	let { data } = $props();
	let activeTab = $state<'overview' | 'watched' | 'watchlist' | 'favorites'>('overview');

	const stats = $derived(data.stats);
	const watched = $derived(data.watched);
	const watchlist = $derived(data.watchlist);
	const favorites = $derived(data.favorites);

	const genreList = $derived(
		Object.entries(stats.genreCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
	);

	const heatmapDays = $derived.by(() => {
		const days = [];
		const today = new Date();
		for (let i = 363; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];
			
			const count = watched.filter((w: any) => {
				if (!w.updatedAt) return false;
				return new Date(w.updatedAt).toISOString().split('T')[0] === dateStr;
			}).length;

			days.push({
				date: dateStr,
				count,
				level: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3
			});
		}
		return days;
	});
</script>

<svelte:head>
	<title>My Films | CinemaDB</title>
	<meta name="description" content="Personal Cinema Archive" />
	<meta property="og:title" content="My Films | CinemaDB" />
	<meta property="og:description" content="Personal Cinema Archive" />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="container my-films-page">
	<!-- Profile Banner Header -->
	<header class="profile-header">
		<div class="user-info">
			<div class="avatar">🎬</div>
			<div>
				<h1 class="user-name">Personal Cinema Archive</h1>
				<p class="user-handle">@{data.user.username} • Personal Cinema Operating System</p>
			</div>
		</div>

		<div class="quick-stats">
			<div class="stat-pill">
				<span class="stat-num">{stats.watchedCount}</span>
				<span class="stat-label">Watched</span>
			</div>
			<div class="stat-pill">
				<span class="stat-num">{stats.watchlistCount}</span>
				<span class="stat-label">Watchlist</span>
			</div>
			<div class="stat-pill">
				<span class="stat-num">{stats.favoritesCount}</span>
				<span class="stat-label">Favorites</span>
			</div>
			<div class="stat-pill">
				<span class="stat-num">{stats.totalRuntimeHours}h</span>
				<span class="stat-label">Runtime</span>
			</div>
		</div>
	</header>

	<!-- Navigation Tabs -->
	<nav class="tab-nav">
		<button
			class="tab-btn"
			class:active={activeTab === 'overview'}
			onclick={() => (activeTab = 'overview')}
		>
			Analytics Overview
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'watched'}
			onclick={() => (activeTab = 'watched')}
		>
			Watched ({stats.watchedCount})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'watchlist'}
			onclick={() => (activeTab = 'watchlist')}
		>
			Watchlist ({stats.watchlistCount})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'favorites'}
			onclick={() => (activeTab = 'favorites')}
		>
			Favorites ({stats.favoritesCount})
		</button>
	</nav>

	<!-- Overview / Analytics -->
	{#if activeTab === 'overview'}
		<div class="dashboard-grid">
			<!-- Favorite Genres -->
			<div class="dash-card">
				<h3 class="card-title">🎭 Top Genres</h3>
				{#if genreList.length > 0}
					<div class="genre-bars">
						{#each genreList as [genreName, count]}
							<div class="bar-row">
								<span class="genre-name">{genreName}</span>
								<div class="bar-bg">
									<div
										class="bar-fill"
										style="width: {Math.min(
											100,
											(count / Math.max(1, stats.watchedCount)) * 100
										)}%;"
									></div>
								</div>
								<span class="count">{count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="empty-hint">Log films to discover your genre affinity breakdown.</p>
				{/if}
			</div>

			<!-- Quick Activity Summary -->
			<div class="dash-card">
				<h3 class="card-title">📊 Cinema Universe Stats</h3>
				<div class="stats-summary-grid">
					<div class="summary-box">
						<span class="box-num">{stats.watchedCount}</span>
						<span class="box-label">Films Logged</span>
					</div>
					<div class="summary-box">
						<span class="box-num">{stats.totalRuntimeHours} hrs</span>
						<span class="box-label">Total Screen Time</span>
					</div>
					<div class="summary-box">
						<span class="box-num">{stats.favoritesCount}</span>
						<span class="box-label">All-Time Favorites</span>
					</div>
				</div>
			</div>
		</div>

		<!-- 365-Day Cinema Activity Heatmap -->
		<div class="dash-card heatmap-card">
			<div class="heatmap-header">
				<h3 class="card-title">📅 365-Day Cinema Activity Heatmap</h3>
				<div class="heatmap-legend">
					<span class="legend-label">Less</span>
					<span class="heat-box lvl-0"></span>
					<span class="heat-box lvl-1"></span>
					<span class="heat-box lvl-2"></span>
					<span class="heat-box lvl-3"></span>
					<span class="legend-label">More</span>
				</div>
			</div>
			<div class="heatmap-grid">
				{#each heatmapDays as day}
					<div
						class="heat-square lvl-{day.level}"
						title="{day.date}: {day.count} {day.count === 1 ? 'film' : 'films'} logged"
					></div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Watched Tab -->
	{#if activeTab === 'watched'}
		{#if watched.length > 0}
			<div class="grid-movies">
				{#each watched as item}
					{#if item.movie}
						<MovieCard
							id={item.movie.id}
							title={item.movie.title}
							posterPath={item.movie.posterPath}
							releaseDate={item.movie.releaseDate}
							voteAverage={item.movie.voteAverage}
							genres={item.movie.genres?.map((g: any) => g.genre.name)}
						/>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="empty-tab">
				<p>🎥 Your watched history timeline will populate as you log films!</p>
				<Button href="/search" variant="primary">Explore Movies to Log</Button>
			</div>
		{/if}
	{/if}

	<!-- Watchlist Tab -->
	{#if activeTab === 'watchlist'}
		{#if watchlist.length > 0}
			<div class="grid-movies">
				{#each watchlist as item}
					{#if item.movie}
						<MovieCard
							id={item.movie.id}
							title={item.movie.title}
							posterPath={item.movie.posterPath}
							releaseDate={item.movie.releaseDate}
							voteAverage={item.movie.voteAverage}
							genres={item.movie.genres?.map((g: any) => g.genre.name)}
						/>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="empty-tab">
				<p>📌 Your watchlist is currently empty.</p>
				<Button href="/search" variant="primary">Find Movies to Watch</Button>
			</div>
		{/if}
	{/if}

	<!-- Favorites Tab -->
	{#if activeTab === 'favorites'}
		{#if favorites.length > 0}
			<div class="grid-movies">
				{#each favorites as item}
					{#if item.movie}
						<MovieCard
							id={item.movie.id}
							title={item.movie.title}
							posterPath={item.movie.posterPath}
							releaseDate={item.movie.releaseDate}
							voteAverage={item.movie.voteAverage}
							genres={item.movie.genres?.map((g: any) => g.genre.name)}
						/>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="empty-tab">
				<p>❤️ No favorite movies saved yet. Click the Favorite button on any movie detail page!</p>
				<Button href="/search" variant="primary">Explore Cinema</Button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.my-films-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
	}

	.profile-header {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		justify-content: space-between;
		padding: 2rem;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		margin-bottom: 2rem;
	}

	@media (min-width: 768px) {
		.profile-header {
			flex-direction: row;
			align-items: center;
		}
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--bg-surface-3);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		border: 2px solid var(--border-accent);
	}

	.user-name {
		font-size: 1.5rem;
		font-weight: 800;
		color: #ffffff;
	}

	.user-handle {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.quick-stats {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.stat-pill {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.6rem 1.25rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	.stat-num {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--accent-gold);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	/* Tabs */
	.tab-nav {
		display: flex;
		gap: 1rem;
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 2.5rem;
		overflow-x: auto;
	}

	.tab-btn {
		padding: 0.75rem 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-tertiary);
		border-bottom: 2px solid transparent;
		transition: all var(--transition-fast);
		white-space: nowrap;
		cursor: pointer;
		background: none;
		border-top: none;
		border-left: none;
		border-right: none;
	}

	.tab-btn:hover {
		color: var(--text-primary);
	}

	.tab-btn.active {
		color: var(--accent-gold);
		border-bottom-color: var(--accent-gold);
	}

	/* Dashboard Grid */
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.75rem;
	}

	.dash-card {
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		padding: 1.5rem;
	}

	.card-title {
		font-size: 1.1rem;
		font-weight: 700;
		margin-bottom: 1.25rem;
		color: var(--text-primary);
	}

	.genre-bars {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.genre-name {
		width: 100px;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.bar-bg {
		flex: 1;
		height: 8px;
		background: var(--bg-surface-3);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--accent-gold);
		border-radius: var(--radius-full);
	}

	.count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-tertiary);
	}

	.stats-summary-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.summary-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.box-num {
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--accent-gold);
	}

	.box-label {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.empty-hint {
		font-size: 0.9rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.empty-tab {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.heatmap-card {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.heatmap-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: #71717a;
	}

	.heat-box {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.heatmap-grid {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		grid-auto-flow: column;
		gap: 4px;
		overflow-x: auto;
		padding: 0.5rem 0;
	}

	.heat-square {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		transition: transform 100ms ease;
		cursor: pointer;
	}

	.heat-square:hover {
		transform: scale(1.3);
		z-index: 2;
	}

	.lvl-0 { background: rgba(255, 255, 255, 0.05); }
	.lvl-1 { background: rgba(16, 185, 129, 0.35); }
	.lvl-2 { background: rgba(16, 185, 129, 0.65); }
	.lvl-3 { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6); }
</style>
