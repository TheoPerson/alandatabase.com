<script lang="ts">
	import '../../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import CommandPalette from '$lib/components/ui/CommandPalette.svelte';
	import NavigationProgressBar from '$lib/components/layout/NavigationProgressBar.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="app-layout" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="eager">
	<NavigationProgressBar />
	<a href="#main-content" class="sr-only skip-link">Skip to main content</a>
	<Header />
	<main id="main-content" class="main-content" tabindex="-1">
		{@render children?.()}
	</main>
	<Footer />
	<ToastContainer />
	<CommandPalette />
</div>

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.main-content {
		flex: 1;
	}
</style>
