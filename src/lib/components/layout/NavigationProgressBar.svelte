<script lang="ts">
	import { navigating } from '$app/stores';

	let isNavigating = $derived(Boolean($navigating));
	let progress = $state(0);
	let timer: any = null;

	$effect(() => {
		if (isNavigating) {
			progress = 15;
			timer = setInterval(() => {
				if (progress < 85) {
					progress += Math.random() * 15;
				}
			}, 150);
		} else {
			if (progress > 0) {
				progress = 100;
				clearInterval(timer);
				const timeout = setTimeout(() => {
					progress = 0;
				}, 250);
				return () => clearTimeout(timeout);
			}
		}
		return () => clearInterval(timer);
	});
</script>

{#if progress > 0}
	<div class="nav-progress-bar-wrap">
		<div
			class="nav-progress-bar"
			style="width: {progress}%; opacity: {progress === 100 ? 0 : 1};"
		></div>
	</div>
{/if}

<style>
	.nav-progress-bar-wrap {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 99999;
		pointer-events: none;
		background: transparent;
	}

	.nav-progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7);
		box-shadow:
			0 0 10px #10b981,
			0 0 5px #34d399;
		transition:
			width 150ms ease-out,
			opacity 250ms ease-in;
		border-radius: 0 2px 2px 0;
	}
</style>
