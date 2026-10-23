<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip } from 'bits-ui';

	interface Props {
		label: string;
		/** Receives the trigger attributes to spread on the real control (a kit Button, usually). */
		children: Snippet<[Record<string, unknown>]>;
	}

	let { label, children }: Props = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render children(props)}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content class="kit-tooltip" sideOffset={6}>{label}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	:global(.kit-tooltip) {
		z-index: var(--z-toast);
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-sm);
		background: var(--surface-overlay);
		color: var(--content-primary);
		font-size: var(--text-xs);
		font-weight: 600;
		box-shadow: var(--elevation-2);
		animation: kit-tooltip-fade var(--duration-base) var(--ease-out) both;
	}
	@keyframes kit-tooltip-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	/* Touch has no hover: the control's accessible name carries the meaning. */
	@media (pointer: coarse) {
		:global(.kit-tooltip) {
			display: none;
		}
	}
</style>
