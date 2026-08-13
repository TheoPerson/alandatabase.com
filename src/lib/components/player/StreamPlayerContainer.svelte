<script lang="ts">
	import { onMount } from 'svelte';

	let {
		tmdbId,
		imdbId,
		title,
		trailerKey,
		customVideoUrl
	} = $props<{
		tmdbId: number | string;
		imdbId?: string | null;
		title: string;
		trailerKey?: string | null;
		customVideoUrl?: string | null;
	}>();

	// Premium 2026 Movie Mirror Pipeline with Distinct Providers
	const servers = $derived(
		customVideoUrl
			? [
					{
						id: 'custom-source',
						name: '🔒 Custom Source',
						badge: 'Private',
						url: customVideoUrl
					}
			  ]
			: [
					{
						id: 'vidzy-hd',
						name: '🇫🇷 Vidzy HD',
						badge: 'VFQ',
						url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`
					},
					{
						id: 'fstream-vostfr',
						name: '🇬🇧 FStream (Uqload)',
						badge: 'VOSTFR',
						url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
					},
					{
						id: 'vidsrc-pro',
						name: '⚡ VidSrc Pro',
						badge: 'HD',
						url: `https://vidsrc.pro/embed/movie/${tmdbId}`
					},
					{
						id: 'super-embed',
						name: '🎥 SuperEmbed',
						badge: 'Multi-Lang',
						url: `https://autoembed.to/movie/tmdb/${tmdbId}`
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
			  ]
	);

	let activeServerId = $state('vidzy-hd');
	let isLoading = $state(true);
	let isError = $state(false);
	let playerViewportEl = $state<HTMLDivElement | null>(null);
	let isFullscreen = $state(false);

	$effect(() => {
		if (customVideoUrl && activeServerId !== 'custom-source') {
			activeServerId = 'custom-source';
		}
	});

	const activeServer = $derived(
		servers.find((s) => s.id === activeServerId) || servers[0]
	);

	function switchServer(id: string) {
		activeServerId = id;
		isLoading = true;
		isError = false;
	}

	function handleIframeLoad() {
		isLoading = false;
	}

	function handleIframeError() {
		isLoading = false;
		isError = true;
	}

	function toggleFullscreen() {
		if (!playerViewportEl) return;
		if (!document.fullscreenElement) {
			playerViewportEl.requestFullscreen?.().catch((err) => {
				console.warn('Native fullscreen failed, fallback to iframe:', err);
			});
			isFullscreen = true;
		} else {
			document.exitFullscreen?.().catch(() => {});
			isFullscreen = false;
		}
	}

	onMount(() => {
		const handleFsChange = () => {
			isFullscreen = !!document.fullscreenElement;
		};
		document.addEventListener('fullscreenchange', handleFsChange);
		document.addEventListener('webkitfullscreenchange', handleFsChange);
		return () => {
			document.removeEventListener('fullscreenchange', handleFsChange);
			document.removeEventListener('webkitfullscreenchange', handleFsChange);
		};
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
			{#each servers as server (server.id)}
				<button
					type="button"
					class="server-pill"
					class:active={activeServerId === server.id}
					aria-pressed={activeServerId === server.id}
					onclick={() => switchServer(server.id)}
				>
					<span class="server-name">{server.name}</span>
					<span class="server-badge">{server.badge}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Video Player Viewport -->
	<div class="player-wrapper">
		<div class="player-viewport" bind:this={playerViewportEl}>
			{#if isLoading}
				<div class="player-loader-overlay">
					<div class="spinner"></div>
					<p class="loader-text">Loading {activeServer.name}...</p>
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

			<!-- Standard Clean Embed Iframe with Wildcard Fullscreen Permissions -->
			{#key activeServer.id}
				<iframe
					src={activeServer.url}
					title="{title} Movie Stream"
					class="player-iframe"
					allowfullscreen
					allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; clipboard-write *"
					onload={handleIframeLoad}
					onerror={handleIframeError}
				></iframe>
			{/key}
		</div>
	</div>

	<!-- Stream Metadata Footer with Custom Fullscreen Button -->
	<div class="player-footer">
		<div class="footer-info">
			<span class="now-playing">NOW STREAMING: <strong>{title}</strong></span>
			<span class="server-indicator">via {activeServer.name}</span>
		</div>
		<div class="footer-actions">
			<button
				type="button"
				class="fullscreen-toggle-btn"
				onclick={toggleFullscreen}
				title="Activer le mode plein écran"
			>
				{#if isFullscreen}
					<span>🗗 Quitter Plein Écran</span>
				{:else}
					<span>⛶ Plein Écran HD</span>
				{/if}
			</button>
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
		position: relative;
		z-index: 20;
	}

	.server-header-bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: var(--bg-surface-2);
		border-bottom: 1px solid var(--border-subtle);
		position: relative;
		z-index: 25;
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
		position: relative;
		z-index: 30;
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
		user-select: none;
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

	.player-wrapper {
		width: 100%;
		max-width: 1000px;
		margin: 0 auto;
		background: #000000;
		position: relative;
	}

	.player-viewport {
		position: relative;
		width: 100%;
		padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
		height: 0;
		background: #000000;
	}

	/* Native Fullscreen styling for absolute 100% monitor takeover */
	.player-viewport:fullscreen {
		width: 100vw !important;
		height: 100vh !important;
		padding-bottom: 0 !important;
		background: #000000 !important;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.player-viewport:-webkit-full-screen {
		width: 100vw !important;
		height: 100vh !important;
		padding-bottom: 0 !important;
		background: #000000 !important;
	}

	.player-viewport:fullscreen .player-iframe,
	.player-viewport:-webkit-full-screen .player-iframe {
		width: 100vw !important;
		height: 100vh !important;
		position: fixed !important;
		inset: 0 !important;
		z-index: 999999 !important;
	}

	.player-iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		z-index: 5;
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
		z-index: 1;
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
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		background: var(--bg-surface-2);
		border-top: 1px solid var(--border-subtle);
		font-size: 0.8rem;
		color: var(--text-secondary);
		position: relative;
		z-index: 25;
	}

	.now-playing strong {
		color: var(--text-primary);
	}

	.footer-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.fullscreen-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.85rem;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid var(--accent-emerald);
		color: var(--accent-emerald);
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
	}

	.fullscreen-toggle-btn:hover {
		background: var(--accent-emerald);
		color: var(--bg-primary);
		transform: translateY(-1px);
		box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
	}

	.quality-tag {
		color: var(--accent-emerald);
		font-weight: 700;
		letter-spacing: 0.05em;
	}
</style>
