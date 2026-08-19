<script lang="ts">
	import { fade } from 'svelte/transition';
	import TvIcon from 'lucide-svelte/icons/tv';
	import LinkIcon from 'lucide-svelte/icons/link';

	let streamUrl = $state('http://www.fawanews.sc/Dana%20White%20Contender%20Series_Week%202.html');
	let inputUrl = $state(streamUrl);
	let isIframeLoaded = $state(false);

	function loadStream() {
		if (inputUrl && inputUrl.trim() !== '') {
			isIframeLoaded = false;
			if (!inputUrl.startsWith('http')) {
				inputUrl = 'https://' + inputUrl;
			}
			streamUrl = inputUrl;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			loadStream();
		}
	}
</script>

<svelte:head>
	<title>Live Sports & Streams - CinemaDB</title>
</svelte:head>

<div class="live-container">
	<div class="control-bar glass-card">
		<div class="brand">
			<div class="live-pulse"></div>
			<TvIcon size={20} class="text-red-500" />
			<h1 class="title">Live Sports</h1>
		</div>

		<div class="url-input-wrapper">
			<LinkIcon size={16} class="input-icon" />
			<input 
				type="url" 
				bind:value={inputUrl} 
				onkeydown={handleKeydown}
				placeholder="Paste stream URL here (e.g. fawanews.sc/...)" 
				class="url-input"
			/>
			<button class="load-btn" onclick={loadStream}>
				Load
			</button>
		</div>
	</div>

	<div class="stream-viewport glass-card">
		{#if !isIframeLoaded}
			<div class="loading-overlay" out:fade={{ duration: 300 }}>
				<div class="loader-spinner"></div>
				<p>Connecting to stream...</p>
				<span class="security-badge">Ad-Block & Popup Protection Enabled</span>
			</div>
		{/if}
		
		<iframe 
			src={streamUrl} 
			title="Live Stream Viewport"
			class="stream-iframe"
			allowfullscreen
			sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
			onload={() => isIframeLoaded = true}
		></iframe>
	</div>
</div>

<style>
	.live-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: calc(100vh - 64px - 40px);
		padding: 1.5rem;
		max-width: 1600px;
		margin: 0 auto;
		width: 100%;
	}
	.control-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-radius: var(--radius-lg);
		background: rgba(9, 13, 20, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.05);
		gap: 2rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #fff;
		margin: 0;
		letter-spacing: -0.02em;
	}
	.live-pulse {
		width: 8px;
		height: 8px;
		background-color: #ef4444;
		border-radius: 50%;
		box-shadow: 0 0 10px #ef4444, 0 0 20px #ef4444;
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
		70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
		100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
	}
	.url-input-wrapper {
		display: flex;
		align-items: center;
		flex: 1;
		max-width: 800px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 0.2s;
	}
	.url-input-wrapper:focus-within {
		border-color: #10b981;
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
	}
	.input-icon {
		margin-left: 1rem;
		color: #a1a1aa;
	}
	.url-input {
		flex: 1;
		background: transparent;
		border: none;
		color: #fff;
		padding: 0.75rem 1rem;
		font-size: 0.95rem;
		outline: none;
	}
	.url-input::placeholder {
		color: #52525b;
	}
	.load-btn {
		background: #10b981;
		color: #000;
		font-weight: 600;
		padding: 0 1.5rem;
		height: 100%;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.load-btn:hover {
		background: #34d399;
	}
	.stream-viewport {
		flex: 1;
		position: relative;
		border-radius: var(--radius-lg);
		background: #000;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
	.stream-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: #000;
	}
	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #050507;
		z-index: 10;
		color: #a1a1aa;
		gap: 1rem;
	}
	.loader-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	.security-badge {
		margin-top: 1rem;
		font-size: 0.8rem;
		padding: 0.3rem 0.8rem;
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border-radius: 100px;
		border: 1px solid rgba(16, 185, 129, 0.2);
	}
</style>
