<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tabs } from 'bits-ui';

	export interface TabItem {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		value: string;
		items: TabItem[];
		orientation?: 'horizontal' | 'vertical';
		activation?: 'automatic' | 'manual';
		label?: string;
		class?: string;
		onValueChange?: (value: string) => void;
		/** Renders the panel for the given tab value. Every panel stays mounted (hidden) for SSR text. */
		children: Snippet<[string]>;
	}

	let {
		value = $bindable(),
		items,
		orientation = 'horizontal',
		activation = 'automatic',
		label = 'Sections',
		class: className = '',
		onValueChange,
		children
	}: Props = $props();

	let list = $state<HTMLElement | null>(null);

	// Keeps the selected trigger visible when the list scrolls on phones. Only the
	// list scrolls: scrollIntoView would also move the page to the tab list on load.
	$effect(() => {
		const current = value;
		const container = list;
		if (!container) return;
		const trigger = container.querySelector<HTMLElement>(`[data-value="${CSS.escape(current)}"]`);
		if (!trigger) return;
		const left = trigger.offsetLeft;
		const right = left + trigger.offsetWidth;
		if (left < container.scrollLeft) container.scrollLeft = left;
		else if (right > container.scrollLeft + container.clientWidth) {
			container.scrollLeft = right - container.clientWidth;
		}
	});
</script>

<Tabs.Root
	bind:value
	{orientation}
	activationMode={activation}
	loop
	onValueChange={(next) => onValueChange?.(next)}
	class="kit-tabs {orientation} {className}"
>
	<Tabs.List bind:ref={list} class="kit-tabs-list" aria-label={label}>
		{#each items as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				disabled={item.disabled}
				class="kit-tabs-trigger"
				data-value={item.value}
			>
				{item.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each items as item (item.value)}
		<Tabs.Content value={item.value} class="kit-tabs-panel" id={`panel-${item.value}`}>
			{@render children(item.value)}
		</Tabs.Content>
	{/each}
</Tabs.Root>

<style>
	:global(.kit-tabs) {
		display: flex;
		flex-direction: column;
	}
	:global(.kit-tabs.vertical) {
		flex-direction: row;
		gap: var(--space-5);
	}
	:global(.kit-tabs-list) {
		position: relative;
		display: flex;
		gap: var(--space-4);
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--border-subtle);
		mask-image: linear-gradient(
			to right,
			transparent,
			black 1rem,
			black calc(100% - 1rem),
			transparent
		);
	}
	:global(.kit-tabs-list::-webkit-scrollbar) {
		display: none;
	}
	@media (min-width: 768px) {
		:global(.kit-tabs-list) {
			mask-image: none;
		}
	}
	@media (min-width: 1440px) {
		:global(.kit-tabs-list) {
			gap: var(--space-6);
		}
	}
	:global(.kit-tabs.vertical > .kit-tabs-list) {
		flex-direction: column;
		gap: 0;
		min-width: 9rem;
		border-bottom: 0;
		border-right: 1px solid var(--border-subtle);
		mask-image: none;
		overflow: visible;
	}
	:global(.kit-tabs-trigger) {
		position: relative;
		flex: 0 0 auto;
		min-height: 3rem;
		padding-inline: 0.25rem;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		transition: color var(--duration-base) var(--ease-out);
	}
	:global(.kit-tabs.vertical .kit-tabs-trigger) {
		min-height: var(--touch-target);
		padding-inline: var(--space-3);
		text-align: left;
	}
	:global(.kit-tabs-trigger::after) {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background: var(--brand-primary);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform var(--duration-base) var(--ease-out);
	}
	:global(.kit-tabs.vertical .kit-tabs-trigger::after) {
		left: auto;
		right: -1px;
		top: 0;
		bottom: 0;
		width: 2px;
		height: auto;
		transform: scaleY(0);
	}
	:global(.kit-tabs-trigger:hover) {
		color: var(--content-primary);
	}
	:global(.kit-tabs-trigger[data-state='active']) {
		color: var(--content-primary);
	}
	:global(.kit-tabs-trigger[data-state='active']::after) {
		transform: scale(1);
	}
	:global(.kit-tabs-trigger[data-disabled]) {
		opacity: 0.45;
		cursor: not-allowed;
	}
	:global(.kit-tabs-trigger:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: -2px;
		border-radius: var(--radius-xs);
	}
	:global(.kit-tabs-panel) {
		min-height: 240px;
		padding-top: var(--space-5);
		outline: none;
	}
	:global(.kit-tabs.vertical > .kit-tabs-panel) {
		flex: 1;
		min-width: 0;
		padding-top: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-tabs-trigger),
		:global(.kit-tabs-trigger::after) {
			transition: none;
		}
	}
</style>
