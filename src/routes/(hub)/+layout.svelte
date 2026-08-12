<script lang="ts">
	import '../../app.css';
	let { children } = $props();
</script>

<div class="hub-app">
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
