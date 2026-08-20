<script lang="ts">
	import PlaybackUnavailable from './PlaybackUnavailable.svelte';

	const { title } = $props<{
		tmdbId: number | string;
		imdbId?: string | null;
		title: string;
		trailerKey?: string | null;
		customVideoUrl?: string | null;
	}>();
</script>

<div class="stream-player-container">
	<header class="player-header">
		<div>
			<p class="eyebrow">Playback status</p>
			<h3>{title}</h3>
		</div>
		<span class="source-badge">No source</span>
	</header>

	<PlaybackUnavailable {title} compact />
</div>

<style>
	.stream-player-container {
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		background: #08080a;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
	}

	.player-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.eyebrow {
		margin: 0 0 0.15rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: #34d399;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #f4f4f5;
	}

	.source-badge {
		flex: 0 0 auto;
		padding: 0.35rem 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		color: #a1a1aa;
	}
</style>
