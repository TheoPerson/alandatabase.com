<script lang="ts">
	// The ALAN DB radar mark, part of the product identity (spec §2).
	interface Props {
		size?: number;
		class?: string;
	}
	let { size = 28, class: className = '' }: Props = $props();
</script>

<svg
	class="logo {className}"
	viewBox="0 0 36 36"
	width={size}
	height={size}
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	focusable="false"
>
	<circle
		cx="18"
		cy="18"
		r="15"
		stroke="rgba(52, 211, 153, 0.35)"
		stroke-width="1.5"
		stroke-dasharray="3 2"
	/>
	<circle
		cx="18"
		cy="18"
		r="11"
		fill="var(--surface-canvas)"
		stroke="var(--brand-active)"
		stroke-width="2"
	/>
	<circle cx="18" cy="18" r="3.5" fill="var(--brand-active)" />
	<circle cx="18" cy="11.5" r="1.5" fill="var(--brand-active)" />
	<circle cx="18" cy="24.5" r="1.5" fill="var(--brand-active)" />
	<circle cx="11.5" cy="18" r="1.5" fill="var(--brand-active)" />
	<circle cx="24.5" cy="18" r="1.5" fill="var(--brand-active)" />
	<line
		class="scan"
		x1="18"
		y1="18"
		x2="28"
		y2="8"
		stroke="var(--brand-primary)"
		stroke-width="2"
		stroke-linecap="round"
	/>
</svg>

<style>
	.logo {
		display: block;
		flex: 0 0 auto;
	}
	.scan {
		transform-origin: 18px 18px;
		animation: scan 8s linear infinite;
	}
	@keyframes scan {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scan {
			animation: none;
		}
	}
</style>
