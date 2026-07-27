<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import Toast from './Toast.svelte';
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<Toast message={toast.message} type={toast.type} />
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		z-index: 9999;
		pointer-events: none;
	}
</style>
