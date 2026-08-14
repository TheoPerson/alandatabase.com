<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import '../../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import CommandPalette from '$lib/components/ui/CommandPalette.svelte';
	import LiveTelemetryHUD from '$lib/components/telemetry/LiveTelemetryHUD.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="app-layout">
	<a href="#main-content" class="sr-only">Skip to main content</a>
	<Header />
	<main id="main-content" class="main-content">
		{@render children?.()}
	</main>
	<Footer />
	<ToastContainer />
	<CommandPalette />
	<LiveTelemetryHUD />
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
