<script lang="ts">
	import MoviePicker from '$lib/components/picker/MoviePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Movie Picker — CinemaDB</title>
	<meta
		name="description"
		content="Find what to watch tonight in seconds. Intelligent, high-confidence movie recommendations powered by authentic IMDb quality and your personal taste."
	/>
	<meta property="og:title" content="Movie Picker — CinemaDB" />
	<meta
		property="og:description"
		content="Find what to watch tonight in seconds. High-confidence movie recommendations."
	/>
</svelte:head>

<div class="picker-page">
	<div class="container page-content">
		<header class="picker-header">
			<div class="header-badge">
				<span class="pulse-dot"></span>
				<span>CINEMADB INTELLIGENCE</span>
			</div>
			<h1 class="page-title">Daily Movie Picker</h1>
			<p class="page-tagline">
				Instant, high-confidence cinema recommendations answering one question: <em>What should I watch tonight?</em>
			</p>
		</header>

		<MoviePicker initialGenres={data.genres} />
	</div>
</div>

<style>
	.picker-page {
		min-height: calc(100vh - 70px);
		padding: 2rem 0 4rem;
	}

	.page-content {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.picker-header {
		text-align: center;
		margin-bottom: 2.5rem;
		max-width: 640px;
	}

	.header-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.8rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--accent-emerald);
		margin-bottom: 0.85rem;
	}

	.pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent-emerald);
		box-shadow: 0 0 8px var(--accent-emerald);
		animation: pulseDot 2s infinite ease-in-out;
	}

	.page-title {
		font-size: 2.4rem;
		font-weight: 900;
		color: var(--text-primary);
		letter-spacing: -0.03em;
		line-height: 1.15;
		margin-bottom: 0.75rem;
	}

	@media (min-width: 768px) {
		.page-title {
			font-size: 3rem;
		}
	}

	.page-tagline {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.page-tagline em {
		color: var(--text-primary);
		font-style: normal;
		font-weight: 600;
	}

	@keyframes pulseDot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.85);
		}
	}
</style>
