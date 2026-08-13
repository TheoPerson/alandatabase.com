<script lang="ts">
	let {
		tmdbId,
		imdbId,
		title,
		trailerKey
	} = $props<{
		tmdbId: number | string;
		imdbId?: string | null;
		title: string;
		trailerKey?: string | null;
	}>();

	// Premium 2026 Movie Mirror Pipeline
	const servers = $derived([
		{
			id: 'vidlink-pro',
			name: '💎 VidLink Pro',
			badge: 'Ultra HD',
			url: `https://vidlink.pro/movie/${tmdbId}?primaryColor=10b981&secondaryColor=050507`
		},
		{
			id: 'vidsrc-vip',
			name: '⚡ VidSrc VIP',
			badge: 'Fast',
			url: `https://vidsrc.vip/embed/movie/${tmdbId}`
		},
		{
			id: 'vidsrc-rip',
			name: '🌟 VidSrc RIP',
			badge: 'Stable',
			url: `https://vidsrc.rip/embed/movie/${tmdbId}`
		},
		{
			id: 'autoembed-co',
			name: '🛡️ AutoEmbed',
			badge: 'Backup',
			url: `https://autoembed.co/movie/tmdb/${tmdbId}`
		},
		...(trailerKey
			? [
					{
						id: 'youtube-trailer',
						name: '▶ Official Trailer',
						badge: '4K',
						url: `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`
					}
			  ]
			: [])
	]);

	let activeServerId = $state('vidlink-pro');
	let isLoading = $state(true);
	let isError = $state(false);
	let fallbackTimer: ReturnType<typeof setTimeout>;

	const activeServer = $derived(
		servers.find((s) => s.id === activeServerId) || servers[0]
	);

	function switchServer(id: string) {
		activeServerId = id;
		isLoading = true;
		isError = false;
		clearTimeout(fallbackTimer);
		
		// Auto-failover if iframe doesn't load within 12 seconds
		fallbackTimer = setTimeout(() => {
			if (isLoading) {
				handleIframeError();
			}
		}, 12000);
	}

	function handleIframeLoad() {
		isLoading = false;
		clearTimeout(fallbackTimer);
	}

	function handleIframeError() {
		isLoading = false;
		isError = true;
		clearTimeout(fallbackTimer);
		
		// Auto-switch to next server if not YouTube trailer
		if (activeServerId !== 'youtube-trailer') {
			const currentIndex = servers.findIndex((s) => s.id === activeServerId);
			const nextServer = servers[(currentIndex + 1) % servers.length];
			// Only auto-switch if we haven't looped back to the first one
			if (currentIndex + 1 < servers.length && nextServer.id !== 'youtube-trailer') {
				switchServer(nextServer.id);
			}
		}
	}
	
	import { onMount, onDestroy } from 'svelte';
	
	onMount(() => {
		// Initialize first timer
		switchServer(activeServerId);
	});
	
	onDestroy(() => {
		clearTimeout(fallbackTimer);
	});
</script>

<div class="stream-player-container glass-card">
	<!-- Server Selection Header Bar -->
	<div class="server-header-bar">
		<div class="server-title-group">
			<span class="live-dot"></span>
			<span class="server-heading">SELECT MOVIE STREAM SERVER:</span>
		</div>
		<div class="server-pills">
			{#each servers as server}
				<button
					type="button"
					class="server-pill"
					class:active={activeServerId === server.id}
					onclick={() => switchServer(server.id)}
				>
					<span class="server-name">{server.name}</span>
					<span class="server-badge">{server.badge}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Video Player Viewport -->
	<div class="player-viewport">
		{#if isLoading}
			<div class="player-loader-overlay">
				<div class="spinner"></div>
				<p class="loader-text">Loading stream from {activeServer.name}...</p>
			</div>
		{/if}

		{#if isError}
			<div class="player-error-overlay">
				<span class="error-emoji">📡</span>
				<p class="error-msg">Server mirror did not respond.</p>
				<button
					type="button"
					class="retry-btn"
					onclick={() => {
						const currentIndex = servers.findIndex((s) => s.id === activeServerId);
						const nextServer = servers[(currentIndex + 1) % servers.length];
						switchServer(nextServer.id);
					}}
				>
					🔄 Switch to Next Mirror
				</button>
			</div>
		{/if}

		<!-- Standard Clean Embed Iframe (Unsandboxed for full provider compatibility) -->
		<iframe
			src={activeServer.url}
			title="{title} Movie Stream"
			class="player-iframe"
			class:hidden={isLoading}
			allowfullscreen
			referrerpolicy="origin"
			allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>
	</div>

	<!-- Stream Metadata Footer -->
	<div class="player-footer">
		<div class="footer-info">
			<span class="now-playing">NOW STREAMING: <strong>{title}</strong></span>
			<span class="server-indicator">via {activeServer.name}</span>
		</div>
		<div class="footer-actions">
			<span class="quality-tag">1080p Ultra HD</span>
		</div>
	</div>
</div>

<style>
	.stream-player-container {
		display: flex;
		flex-direction: column;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-md);
	}

	.server-header-bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: var(--bg-surface-2);
		border-bottom: 1px solid var(--border-subtle);
	}

	@media (min-width: 768px) {
		.server-header-bar {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.server-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-emerald);
		box-shadow: 0 0 10px var(--accent-emerald);
	}

	.server-heading {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
	}

	.server-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.server-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.85rem;
		background: var(--bg-surface-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.server-pill:hover {
		background: var(--accent-emerald-subtle);
		border-color: var(--border-emerald);
		color: var(--text-primary);
	}

	.server-pill.active {
		background: rgba(16, 185, 129, 0.2);
		border-color: var(--accent-emerald);
		color: var(--accent-emerald);
		box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
	}

	.server-badge {
		font-size: 0.65rem;
		padding: 0.15rem 0.4rem;
		background: var(--bg-primary);
		border-radius: 3px;
		color: var(--text-tertiary);
	}

	.player-viewport {
		position: relative;
		width: 100%;
		padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
		height: 0;
		background: #000000;
	}

	.player-iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.player-iframe.hidden {
		opacity: 0;
	}

	.player-loader-overlay,
	.player-error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--bg-primary);
		z-index: 10;
		gap: 0.75rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(16, 185, 129, 0.2);
		border-top-color: var(--accent-emerald);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loader-text {
		font-size: 0.95rem;
		color: var(--text-primary);
		font-weight: 600;
	}

	.error-emoji {
		font-size: 2.5rem;
	}

	.error-msg {
		font-size: 1rem;
		color: var(--color-error);
		font-weight: 600;
	}

	.retry-btn {
		padding: 0.6rem 1.2rem;
		background: var(--accent-emerald);
		color: var(--bg-primary);
		font-weight: 700;
		font-size: 0.88rem;
		border-radius: var(--radius-md);
		border: none;
		cursor: pointer;
		transition: transform 150ms ease;
	}

	.retry-btn:hover {
		transform: scale(1.04);
	}

	.player-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		background: var(--bg-surface-2);
		border-top: 1px solid var(--border-subtle);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.now-playing strong {
		color: var(--text-primary);
	}

	.quality-tag {
		color: var(--accent-emerald);
		font-weight: 700;
		letter-spacing: 0.05em;
	}
</style>
