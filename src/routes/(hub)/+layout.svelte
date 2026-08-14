<script lang="ts">
	import '../../app.css';
	import NavigationProgressBar from '$lib/components/layout/NavigationProgressBar.svelte';
	let { children } = $props();
</script>

<div class="hub-app" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="eager">
	<NavigationProgressBar />
	{@render children()}
</div>

<style>
	.hub-app {
		min-height: 100vh;
		background: var(--bg-primary, #050507);
		color: #f4f4f5;
		font-family: var(--font-sans);
	}
</style>
