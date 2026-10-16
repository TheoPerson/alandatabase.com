<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';

	// Kit switch: state is read from aria-checked (always set by bits-ui on role="switch"),
	// so the visuals cannot drift from what assistive technology announces.
	let {
		ref = $bindable(null),
		class: className = '',
		checked = $bindable(false),
		size = 'default',
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
		size?: 'sm' | 'default';
	} = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class="kit-switch {size} {className}"
	{...restProps}
>
	<SwitchPrimitive.Thumb data-slot="switch-thumb" class="kit-switch-thumb" />
</SwitchPrimitive.Root>

<style>
	:global(.kit-switch) {
		--switch-width: 2.75rem;
		--switch-height: 1.6rem;
		--switch-gap: 0.2rem;
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		width: var(--switch-width);
		height: var(--switch-height);
		padding: var(--switch-gap);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
		background: var(--surface-interactive);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--ease-out),
			border-color var(--duration-base) var(--ease-out);
	}
	/* A 44px hit area around the visible track. */
	:global(.kit-switch)::after {
		content: '';
		position: absolute;
		inset: calc((var(--switch-height) - var(--touch-target)) / 2) -0.5rem;
	}
	:global(.kit-switch.sm) {
		--switch-width: 2.25rem;
		--switch-height: 1.3rem;
	}
	:global(.kit-switch[aria-checked='true']) {
		border-color: var(--brand-border);
		background: var(--brand-primary);
	}
	:global(.kit-switch:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 3px;
	}
	:global(.kit-switch[data-disabled]) {
		cursor: not-allowed;
		opacity: 0.5;
	}
	:global(.kit-switch-thumb) {
		display: block;
		width: calc(var(--switch-height) - 2 * var(--switch-gap) - 2px);
		height: calc(var(--switch-height) - 2 * var(--switch-gap) - 2px);
		border-radius: 50%;
		background: var(--content-primary);
		box-shadow: var(--elevation-1);
		pointer-events: none;
		transition: transform var(--duration-base) var(--ease-out);
	}
	:global(.kit-switch[aria-checked='true'] .kit-switch-thumb) {
		background: var(--content-inverse);
		transform: translateX(calc(var(--switch-width) - var(--switch-height)));
	}
	@media (forced-colors: active) {
		:global(.kit-switch[aria-checked='true']) {
			background: Highlight;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-switch),
		:global(.kit-switch-thumb) {
			transition: none;
		}
	}
</style>
