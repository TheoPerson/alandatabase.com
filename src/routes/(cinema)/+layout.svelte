<script lang="ts">
	import '../../app.css';
	import TopBar from '$lib/components/ui/top-bar';
	import BottomTabBar from '$lib/components/ui/bottom-tab-bar';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import CommandPalette from '$lib/components/ui/CommandPalette.svelte';
	import NavigationProgressBar from '$lib/components/layout/NavigationProgressBar.svelte';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: { user: { username: string } | null }; children?: Snippet } =
		$props();

	// Lets browser tests wait for hydration before they click; harmless for users.
	$effect(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

<div class="app-layout" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="eager">
	<NavigationProgressBar />
	<a href="#main-content" class="sr-only skip-link">Skip to main content</a>
	<TopBar user={data.user} />
	<main id="main-content" class="main-content" tabindex="-1">
		{@render children?.()}
	</main>
	<Footer />
	<BottomTabBar />
	<ToastContainer />
	<CommandPalette />
</div>

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		/* Clearance for the fixed tab bar, footer included. */
		padding-bottom: calc(var(--bottom-bar-height) + var(--safe-bottom));
	}
	/* Hero sections pull themselves under the sticky bar; other pages keep normal flow. */
	.main-content {
		flex: 1;
	}
	@media (min-width: 1024px) {
		.app-layout {
			padding-bottom: 0;
		}
	}
</style>
