<script lang="ts">
	import { onMount } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import SearchIcon from 'lucide-svelte/icons/search';
	import XIcon from 'lucide-svelte/icons/x';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'value' | 'class'> {
		value?: string;
		// The accessible name, rendered as a visually hidden <label>.
		label: string;
		clearLabel?: string;
		ref?: HTMLInputElement | null;
		class?: string;
		onclear?: () => void;
	}

	let {
		value = $bindable(''),
		label,
		clearLabel = 'Clear text',
		ref = $bindable(null),
		class: className = '',
		onclear,
		onkeydown,
		id,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const inputId = $derived(id ?? `search-input-${uid}`);

	// The clear control needs script to work, so without JavaScript it is never rendered
	// instead of sitting there dead.
	let interactive = $state(false);
	onMount(() => {
		interactive = true;
	});

	function clear() {
		value = '';
		ref?.focus();
		onclear?.();
	}

	// Keyboard users clear with Escape (the clear button stays out of the tab order so the
	// field and its submit button are neighbours); an already empty field leaves Escape alone.
	function handleKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onkeydown?.(event);
		if (event.key === 'Escape' && value && !event.defaultPrevented) {
			event.preventDefault();
			clear();
		}
	}
</script>

<div class="field {className}">
	<label class="sr-only" for={inputId}>{label}</label>
	<SearchIcon class="lead" size={20} aria-hidden="true" />
	<input
		bind:this={ref}
		bind:value
		id={inputId}
		type="search"
		enterkeyhint="search"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		{...rest}
		onkeydown={handleKeydown}
	/>
	{#if interactive && value}
		<button type="button" class="clear" aria-label={clearLabel} tabindex="-1" onclick={clear}>
			<XIcon size={18} aria-hidden="true" />
		</button>
	{/if}
</div>

<style>
	.field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-width: 0;
		min-height: 3.25rem;
		padding-inline: var(--space-4) var(--space-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--content-secondary);
		transition:
			border-color var(--duration-base) var(--ease-out),
			background-color var(--duration-base) var(--ease-out);
	}
	.field:hover {
		border-color: var(--border-strong);
	}
	.field:has(input:focus-visible) {
		border-color: var(--brand-border);
		background: var(--surface-overlay);
		outline: 2px solid var(--brand-primary);
		outline-offset: 3px;
	}
	.field :global(.lead) {
		flex: none;
	}
	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		min-height: 3rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--content-primary);
		/* 16px keeps iOS Safari from zooming the page when the field takes focus. */
		font-size: var(--text-md);
		appearance: none;
		-webkit-appearance: none;
	}
	input::placeholder {
		color: var(--content-tertiary);
	}
	/* The clear button below replaces the browser's own, which differs per engine. */
	input::-webkit-search-cancel-button,
	input::-webkit-search-decoration {
		-webkit-appearance: none;
		appearance: none;
	}
	.clear {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		transition:
			background-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out);
	}
	.clear:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-primary);
	}
</style>
