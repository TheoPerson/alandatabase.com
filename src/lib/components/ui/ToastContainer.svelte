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
	/* Phones: centred above the tab bar. Wide screens: bottom right. */
	.toast-container {
		position: fixed;
		inset: auto var(--page-gutter) calc(var(--bottom-bar-height) + var(--safe-bottom) + 0.75rem)
			var(--page-gutter);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		z-index: var(--z-toast);
		pointer-events: none;
	}
	@media (min-width: 1024px) {
		.toast-container {
			inset: auto 2rem 2rem auto;
			align-items: flex-end;
		}
	}
</style>
