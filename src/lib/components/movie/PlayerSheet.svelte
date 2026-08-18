<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import XIcon from 'lucide-svelte/icons/x';
	
	let { movie, onClose } = $props();
</script>

<div class="sheet-overlay" transition:fade={{ duration: 200 }} onclick={onClose}>
	<div class="sheet-content" transition:fly={{ y: 100, duration: 300, opacity: 1 }} onclick={(e) => e.stopPropagation()}>
		<div class="sheet-header">
			<h3 class="sheet-title">Watch {movie.title}</h3>
			<button class="close-btn" onclick={onClose} aria-label="Close player">
				<XIcon size={20} />
			</button>
		</div>
		
		<div class="player-container">
			<iframe 
				src={`https://vidsrc.xyz/embed/movie?tmdb=${movie.id}`} 
				allowfullscreen 
				title="Video Player"
				class="video-iframe"
			></iframe>
		</div>
		
		<div class="sheet-footer">
			<p class="server-note">Playing from Server 1 • HD</p>
		</div>
	</div>
</div>

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(8px);
		z-index: 100;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.sheet-content {
		background: #0a0a0c;
		border-top-left-radius: 1.5rem;
		border-top-right-radius: 1.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		width: 100%;
		height: 85vh; /* Takes up most of the screen like a native bottom sheet */
		display: flex;
		flex-direction: column;
		box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
	}

	.sheet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(255,255,255,0.05);
	}

	.sheet-title {
		font-weight: 600;
		font-size: 1.1rem;
		color: #fff;
		margin: 0;
	}

	.close-btn {
		background: rgba(255,255,255,0.1);
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #a1a1aa;
		border: none;
		cursor: pointer;
	}

	.player-container {
		flex: 1;
		background: #000;
		position: relative;
	}

	.video-iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.sheet-footer {
		padding: 1rem 1.5rem;
		background: #0a0a0c;
	}

	.server-note {
		color: #a1a1aa;
		font-size: 0.85rem;
		text-align: center;
		margin: 0;
	}
</style>
