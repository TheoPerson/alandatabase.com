<script lang="ts">
	import type { ToastType } from '$lib/stores/toast';

	interface Props {
		message: string;
		type: ToastType;
	}

	let { message, type }: Props = $props();
</script>

<div
	class="toast toast-{type}"
	role={type === 'error' ? 'alert' : 'status'}
	aria-live={type === 'error' ? 'assertive' : 'polite'}
>
	{message}
</div>

<style>
	.toast {
		padding: 1rem 1.25rem;
		border-radius: var(--radius-md);
		background: var(--bg-surface-glass);
		backdrop-filter: blur(16px);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		box-shadow: var(--shadow-lg);
		font-weight: 500;
		animation: slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: auto;
		min-width: 250px;
	}

	.toast-success {
		border-left: 4px solid var(--color-success);
	}

	.toast-error {
		border-left: 4px solid var(--color-error);
	}

	.toast-info {
		border-left: 4px solid var(--color-info);
	}

	@keyframes slide-in {
		from {
			transform: translateX(120%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
