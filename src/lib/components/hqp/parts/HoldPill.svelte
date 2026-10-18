<script lang="ts">
	import { getHqpContext } from '../context';

	// Long-press 2x (section 6.1): a glass pill at the top centre, under the island band.
	const { snapshot } = getHqpContext();
</script>

{#if $snapshot.held}
	<div class="hqp-hold hqp-glass" role="status">
		<span class="hqp-tnum">2×</span>
		<svg class="chevs" viewBox="0 0 24 12" aria-hidden="true">
			<path d="M2 1.5l8 4.5-8 4.5z" />
			<path d="M13 1.5l8 4.5-8 4.5z" />
		</svg>
		<span class="hqp-sr">Playing at double speed</span>
	</div>
{/if}

<style>
	.hqp-hold {
		position: absolute;
		left: 0;
		right: 0;
		top: 24px;
		width: fit-content;
		margin-inline: auto;
		z-index: var(--hqp-z-toast);
		display: flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 16px;
		border-radius: var(--hqp-r-capsule);
		font-size: 15px;
		font-weight: 700;
		pointer-events: none;
		animation: hqp-hold-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-hold {
		top: calc(var(--hqp-edge-top) + 10px);
	}
	:global(.hqp[data-layout='phone-landscape']) .hqp-hold {
		top: 16px;
	}
	.chevs {
		width: 22px;
		height: 11px;
		fill: currentColor;
	}
	.chevs path {
		animation: hqp-pulse 1s ease-in-out infinite;
	}
	.chevs path:nth-child(2) {
		animation-delay: 150ms;
	}
	@keyframes hqp-hold-in {
		from {
			opacity: 0;
			translate: 0 -6px;
		}
	}
	@keyframes hqp-pulse {
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-hold {
			animation: none;
		}
		.chevs path {
			animation: none;
		}
	}
</style>
