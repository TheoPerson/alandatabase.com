<script lang="ts">
	import '../../app.css';
	import NavigationProgressBar from '$lib/components/layout/NavigationProgressBar.svelte';
	let { children } = $props();
</script>

<div class="hub-app" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="eager">
	<NavigationProgressBar />
	<a href="#main-content" class="sr-only skip-link">Skip to main content</a>
	<main id="main-content" tabindex="-1">
		{@render children()}
	</main>
</div>

<style>
	.hub-app {
		min-height: 100dvh;
		background: var(--surface-canvas);
		color: var(--content-primary);
		font-family: var(--font-sans);
	}
</style>
