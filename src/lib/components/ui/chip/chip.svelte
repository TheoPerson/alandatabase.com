<script lang="ts">
	import type { Snippet } from 'svelte';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		selected?: boolean;
		href?: string;
		onclick?: (event: MouseEvent) => void;
		onremove?: () => void;
		class?: string;
		children?: Snippet;
	}

	let {
		selected = false,
		href,
		onclick,
		onremove,
		class: className = '',
		children
	}: Props = $props();
</script>

{#if href}
	<a {href} class="chip {className}" class:selected aria-current={selected ? 'true' : undefined}>
		{@render children?.()}
	</a>
{:else}
	<button type="button" class="chip {className}" class:selected aria-pressed={selected} {onclick}>
		{@render children?.()}
		{#if onremove}
			<span
				class="remove"
				role="button"
				tabindex="0"
				aria-label="Remove"
				onclick={(event) => {
					event.stopPropagation();
					onremove();
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						onremove();
					}
				}}><XIcon size={14} /></span
			>
		{/if}
	</button>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0 0.95rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.04);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
		transition:
			background-color var(--duration-base) var(--ease-out),
			border-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.chip:hover {
		color: var(--content-primary);
		border-color: var(--border-strong);
	}
	.chip:active {
		transform: scale(0.97);
	}
	.selected {
		background: var(--brand-muted);
		border-color: var(--brand-border);
		color: var(--brand-primary);
	}
	.remove {
		display: inline-flex;
		margin-right: -0.35rem;
		padding: 0.25rem;
		border-radius: 50%;
	}
	.remove:hover {
		background: rgba(255, 255, 255, 0.12);
	}
</style>
