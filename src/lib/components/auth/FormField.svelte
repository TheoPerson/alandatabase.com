<script lang="ts">
	import { onMount } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import EyeIcon from 'lucide-svelte/icons/eye';
	import EyeOffIcon from 'lucide-svelte/icons/eye-off';
	import { validityMessage } from './auth-form';

	type Props = Omit<HTMLInputAttributes, 'type' | 'id' | 'name'> & {
		id: string;
		name: string;
		label: string;
		type?: 'text' | 'email' | 'password';
		/** Persistent guidance under the field, read with it by screen readers. */
		hint?: string;
		/** English message for a value that fails `pattern` or the input type. */
		patternHint?: string;
		/** Replaces the default "Enter your <label>." message. */
		missing?: string;
		/** Extra ids for aria-describedby, such as the server error summary. */
		describedBy?: string;
	};

	const {
		id,
		name,
		label,
		type = 'text',
		hint,
		patternHint,
		missing,
		describedBy,
		required = true,
		minlength,
		maxlength,
		...rest
	}: Props = $props();

	let error = $state<string | null>(null);
	let revealed = $state(false);
	// The reveal toggle needs JavaScript, so it only appears once the page is interactive.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const canReveal = $derived(type === 'password');
	const inputType = $derived(canReveal && revealed ? 'text' : type);
	const rules = $derived({
		label,
		minLength: minlength == null ? undefined : Number(minlength),
		maxLength: maxlength == null ? undefined : Number(maxlength),
		patternHint,
		missing
	});
	const describedby = $derived(
		[error ? `${id}-error` : null, hint ? `${id}-hint` : null, describedBy ?? null]
			.filter(Boolean)
			.join(' ') || undefined
	);

	// Replace the browser bubble (device language) with an inline English message.
	function handleInvalid(event: Event & { currentTarget: HTMLInputElement }) {
		event.preventDefault();
		const input = event.currentTarget;
		error = validityMessage(input.validity, rules);
		const firstInvalid = input.form?.querySelector(
			'input:invalid, select:invalid, textarea:invalid'
		);
		if (firstInvalid === input) input.focus();
	}

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		if (error) error = validityMessage(event.currentTarget.validity, rules);
	}
</script>

<div class="field">
	<label for={id}>{label}</label>
	<div class="control" class:revealable={canReveal}>
		<input
			{id}
			{name}
			type={inputType}
			{required}
			{minlength}
			{maxlength}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedby}
			oninvalid={handleInvalid}
			oninput={handleInput}
			{...rest}
		/>
		{#if canReveal && mounted}
			<button
				type="button"
				class="reveal"
				aria-label="Show {label.toLowerCase()}"
				aria-pressed={revealed}
				aria-controls={id}
				onclick={() => (revealed = !revealed)}
			>
				{#if revealed}
					<EyeOffIcon size={20} aria-hidden="true" />
				{:else}
					<EyeIcon size={20} aria-hidden="true" />
				{/if}
			</button>
		{/if}
	</div>
	{#if error}
		<p id="{id}-error" class="error">{error}</p>
	{/if}
	{#if hint}
		<p id="{id}-hint" class="hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	label {
		color: var(--content-secondary);
		font-size: var(--type-label);
		font-weight: 700;
		letter-spacing: 0.01em;
	}
	.control {
		position: relative;
	}
	input {
		width: 100%;
		min-width: 0;
		min-height: 3rem;
		padding: 0 var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-subtle);
		color: var(--content-primary);
		/* 16px keeps iOS Safari from zooming into the field. */
		font-size: var(--text-md);
		caret-color: var(--brand-primary);
		transition:
			border-color var(--duration-base) var(--ease-out),
			box-shadow var(--duration-base) var(--ease-out);
	}
	.revealable input {
		padding-right: calc(var(--touch-target) + var(--space-1));
	}
	input:hover {
		border-color: var(--border-strong);
	}
	input:focus-visible {
		outline: none;
		border-color: var(--brand-primary);
		box-shadow: 0 0 0 3px var(--brand-muted);
	}
	input[aria-invalid='true'] {
		border-color: var(--color-error);
	}
	input[readonly] {
		background: transparent;
		color: var(--content-secondary);
		border-style: dashed;
	}
	/* Keep autofilled values on the dark surface instead of the browser's light fill. */
	input:-webkit-autofill {
		-webkit-text-fill-color: var(--content-primary);
		box-shadow: inset 0 0 0 100px var(--surface-subtle);
	}
	input:-webkit-autofill:focus-visible {
		box-shadow:
			inset 0 0 0 100px var(--surface-subtle),
			0 0 0 3px var(--brand-muted);
	}
	.reveal {
		position: absolute;
		top: 50%;
		right: 2px;
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: var(--radius-sm);
		color: var(--content-tertiary);
		background: transparent;
		transform: translateY(-50%);
		transition: color var(--duration-fast) var(--ease-out);
	}
	.reveal:hover,
	.reveal[aria-pressed='true'] {
		color: var(--content-primary);
	}
	.reveal:focus-visible {
		outline-offset: -4px;
	}
	.error,
	.hint {
		font-size: var(--text-xs);
		line-height: 1.45;
	}
	.error {
		color: var(--color-error);
		font-weight: 600;
	}
	.hint {
		color: var(--content-tertiary);
	}
</style>
