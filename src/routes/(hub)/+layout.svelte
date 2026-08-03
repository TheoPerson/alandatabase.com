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
		background: #0a0a0a;
		color: #f4f4f5;
		font-family: 'Inter', sans-serif;
	}
</style>
