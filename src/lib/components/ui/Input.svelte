<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
	}

	let { label, error, class: customClass = '', ...rest }: Props = $props();
</script>

<div class="input-wrapper {customClass}">
	{#if label}
		<label class="input-label" for={rest.id}>{label}</label>
	{/if}
	<input
		class="input-field"
		class:has-error={!!error}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error && rest.id ? `${rest.id}-error` : undefined}
		{...rest}
	/>
	{#if error}
		<span class="input-error" id={rest.id ? `${rest.id}-error` : undefined}>{error}</span>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}

	.input-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.input-field {
		width: 100%;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		min-height: var(--touch-target);
		padding: 0.65rem 1rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.95rem;
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
		outline: none;
	}

	.input-field:focus-visible {
		border-color: var(--accent-emerald);
		box-shadow: 0 0 0 3px var(--brand-muted);
	}

	.input-field.has-error {
		border-color: var(--color-error);
	}
	.input-field.has-error:focus-visible {
		box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.18);
	}

	.input-error {
		font-size: 0.75rem;
		color: var(--color-error);
	}
</style>
