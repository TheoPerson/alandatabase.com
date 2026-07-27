<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		borderRadius?: string;
		class?: string;
	}

	let {
		width = '100%',
		height = '1rem',
		borderRadius = 'var(--radius-md)',
		class: className = ''
	}: Props = $props();
</script>

<div
	class="skeleton {className}"
	style="width: {width}; height: {height}; border-radius: {borderRadius};"
	aria-hidden="true"
></div>

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--bg-surface-1) 25%,
			var(--bg-surface-2) 50%,
			var(--bg-surface-1) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
