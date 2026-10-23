<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fieldStatus } from './list-form';

	interface Props {
		id: string;
		name: string;
		label: string;
		max: number;
		value?: string;
		multiline?: boolean;
		hint?: string;
		placeholder?: string;
		required?: boolean;
		/** A validation message for this field (client or server). */
		error?: string | null;
		ref?: HTMLInputElement | HTMLTextAreaElement | null;
	}

	let {
		id,
		name,
		label,
		max,
		value = $bindable(''),
		multiline = false,
		hint,
		placeholder,
		required = false,
		error = null,
		ref = $bindable(null)
	}: Props = $props();

	const status = $derived(fieldStatus(value, max, multiline));
	// Screen readers hear the count after a pause or on leaving the field, not per keystroke.
	let announced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	function announceSoon() {
		clearTimeout(timer);
		timer = setTimeout(() => (announced = status.announcement), 800);
	}
	function announceNow() {
		clearTimeout(timer);
		announced = status.announcement;
	}
	onDestroy(() => clearTimeout(timer));

	const invalid = $derived(status.over || !!error);
	const describedBy = $derived(
		[hint ? `${id}-hint` : null, error ? `${id}-error` : null, `${id}-count`]
			.filter(Boolean)
			.join(' ')
	);

	// The description grows with its text (3 rows to start, capped), so short notes stay compact.
	$effect(() => {
		void value;
		if (!multiline || !(ref instanceof HTMLTextAreaElement)) return;
		ref.style.height = 'auto';
		ref.style.height = `${ref.scrollHeight + 2}px`;
	});
</script>

<div class="field" class:invalid>
	<div class="top">
		<label for={id}>
			{label}
			{#if !required}<span class="optional">Optional</span>{/if}
		</label>
		{#if status.showCounter}
			<span class="counter" class:near={status.near} class:over={status.over} aria-hidden="true"
				>{status.counter}</span
			>
		{/if}
	</div>
	{#if hint}<p class="hint" id={`${id}-hint`}>{hint}</p>{/if}
	{#if multiline}
		<textarea
			{id}
			{name}
			{placeholder}
			{required}
			rows="3"
			bind:value
			bind:this={ref}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
			oninput={announceSoon}
			onblur={announceNow}></textarea>
	{:else}
		<input
			{id}
			{name}
			{placeholder}
			{required}
			type="text"
			autocomplete="off"
			bind:value
			bind:this={ref}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
			oninput={announceSoon}
			onblur={announceNow}
		/>
	{/if}
	{#if error}<p class="error" id={`${id}-error`}>{error}</p>{/if}
	<span class="sr-only" id={`${id}-count`} aria-live="polite">{announced}</span>
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-2);
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}
	label {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--content-primary);
	}
	.optional {
		margin-inline-start: var(--space-2);
		color: var(--content-tertiary);
		font-weight: 500;
	}
	.counter {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.counter.near {
		color: var(--color-warning);
		font-weight: 700;
	}
	.counter.over {
		color: var(--color-error);
		font-weight: 700;
	}
	.hint {
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	input,
	textarea {
		width: 100%;
		min-height: var(--touch-target);
		padding: 0.7rem var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-subtle);
		color: var(--content-primary);
		font: inherit;
		/* 16px keeps iOS Safari from zooming into the field. */
		font-size: max(1rem, 16px);
		transition: border-color var(--duration-fast) var(--ease-standard);
	}
	textarea {
		min-height: 6.25rem;
		max-height: 16rem;
		resize: none;
		overflow-y: auto;
		line-height: var(--leading-body);
	}
	input::placeholder,
	textarea::placeholder {
		color: var(--content-tertiary);
	}
	input:hover,
	textarea:hover {
		border-color: var(--border-strong);
	}
	input:focus-visible,
	textarea:focus-visible {
		border-color: var(--brand-primary);
	}
	.invalid input,
	.invalid textarea {
		border-color: var(--color-error);
	}
	.error {
		color: var(--color-error);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		input,
		textarea {
			transition: none;
		}
	}
</style>
