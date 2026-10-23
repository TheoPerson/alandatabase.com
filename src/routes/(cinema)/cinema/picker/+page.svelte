<script lang="ts">
	import MoviePicker from '$lib/components/picker/MoviePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Picker | Alan's Database</title>
	<meta
		name="description"
		content="One film for tonight, picked from well-rated titles and what you usually watch."
	/>
</svelte:head>

<div class="page">
	<header class="head">
		<p class="eyebrow">Picker</p>
		<h1>What to watch tonight</h1>
	</header>

	<MoviePicker initialGenres={data.genres} backdrops={data.backdrops} />
</div>

<style>
	.page {
		display: grid;
		gap: var(--space-4);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-6);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
	}
	@media (min-width: 1024px) {
		.page {
			gap: var(--space-5);
		}
	}
	/* Phone landscape: every pixel of height counts; the moods and the stage come first. */
	@media (orientation: landscape) and (max-height: 500px) {
		.page {
			gap: var(--space-3);
			padding-top: var(--space-4);
		}
	}
</style>
