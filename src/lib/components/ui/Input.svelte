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
		{...rest}
	/>
	{#if error}
		<span class="input-error">{error}</span>
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
		padding: 0.65rem 1rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.95rem;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
		outline: none;
	}

	.input-field:focus {
		border-color: var(--accent-emerald);
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
	}

	.input-field.has-error {
		border-color: var(--color-error);
	}
	.input-field.has-error:focus {
		box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
	}

	.input-error {
		font-size: 0.75rem;
		color: var(--color-error);
	}
</style>
