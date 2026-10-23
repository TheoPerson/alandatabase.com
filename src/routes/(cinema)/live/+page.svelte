<script lang="ts">
	import PlaybackUnavailable from '$lib/components/player/PlaybackUnavailable.svelte';
</script>

<svelte:head>
	<title>Live playback unavailable | CinemaDB</title>
	<meta
		name="description"
		content="Live playback is unavailable until an owner-approved source is configured."
	/>
</svelte:head>

<section class="live-page" aria-labelledby="live-playback-title">
	<div class="page-copy">
		<p class="eyebrow">Private cinema</p>
		<h1 id="live-playback-title">Live playback</h1>
		<p>
			Live playback is currently unavailable. Approved private sources will appear here when they
			are configured.
		</p>
	</div>

	<PlaybackUnavailable
		title="live playback"
		context="No owner-approved live source is configured. Unknown third-party pages and stream URLs remain blocked."
	/>
</section>

<style>
	.live-page {
		box-sizing: border-box;
		width: min(100%, 72rem);
		min-height: calc(100dvh - 70px);
		margin: 0 auto;
		padding: clamp(1.25rem, 5vw, 4rem) clamp(1rem, 4vw, 2rem);
	}

	.page-copy {
		max-width: 44rem;
		margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
	}

	.eyebrow {
		margin: 0 0 0.6rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #34d399;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 7vw, 4rem);
		line-height: 0.98;
		letter-spacing: -0.05em;
		color: #fafafa;
	}

	.page-copy > p:last-child {
		margin: 1rem 0 0;
		font-size: clamp(0.95rem, 2vw, 1.05rem);
		line-height: 1.65;
		color: #a1a1aa;
	}
</style>
