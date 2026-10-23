<script lang="ts" module>
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
	export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

	export type ButtonProps = Omit<HTMLButtonAttributes, 'type'> &
		Omit<HTMLAnchorAttributes, 'type'> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			href?: string;
			loading?: boolean;
			disabled?: boolean;
			type?: 'button' | 'submit' | 'reset';
			class?: string;
			children?: Snippet;
		};
</script>

<script lang="ts">
	let {
		variant = 'primary',
		size = 'md',
		href = undefined,
		loading = false,
		disabled = false,
		type = 'button',
		class: className = '',
		children,
		...rest
	}: ButtonProps = $props();

	const inactive = $derived(disabled || loading);
</script>

{#if href}
	<a
		class="btn {variant} {size} {className}"
		href={inactive ? undefined : href}
		aria-disabled={inactive ? 'true' : undefined}
		tabindex={inactive ? -1 : undefined}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		class="btn {variant} {size} {className}"
		{type}
		disabled={inactive}
		aria-busy={loading ? 'true' : undefined}
		{...rest}
	>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		{@render children?.()}
	</button>
{/if}

<style>
	.btn {
		--btn-bg: var(--brand-primary);
		--btn-fg: var(--content-inverse);
		--btn-border: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		padding: 0 1.25rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--btn-border);
		background: var(--btn-bg);
		color: var(--btn-fg);
		font-weight: 700;
		font-size: var(--text-sm);
		letter-spacing: 0.01em;
		white-space: nowrap;
		transition:
			transform var(--duration-fast) var(--ease-out),
			background-color var(--duration-base) var(--ease-out),
			border-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out);
	}
	.btn:hover {
		transform: translateY(-1px);
	}
	.btn:active {
		transform: scale(0.97);
	}
	.btn[disabled],
	.btn[aria-disabled='true'] {
		opacity: 0.55;
		transform: none;
		pointer-events: none;
	}
	.primary:hover {
		--btn-bg: var(--brand-hover);
	}
	.secondary {
		--btn-bg: rgba(255, 255, 255, 0.12);
		--btn-fg: var(--content-primary);
	}
	.secondary:hover {
		--btn-bg: rgba(255, 255, 255, 0.18);
	}
	.ghost {
		--btn-bg: transparent;
		--btn-fg: var(--content-primary);
	}
	.ghost:hover {
		--btn-bg: rgba(255, 255, 255, 0.08);
	}
	.outline {
		--btn-bg: transparent;
		--btn-fg: var(--content-primary);
		--btn-border: var(--border-strong);
	}
	.outline:hover {
		--btn-border: var(--content-primary);
	}
	.danger {
		--btn-bg: rgba(251, 113, 133, 0.16);
		--btn-fg: var(--color-error);
	}
	.danger:hover {
		--btn-bg: rgba(251, 113, 133, 0.26);
	}
	.sm {
		min-height: 2.25rem;
		padding-inline: 0.875rem;
		font-size: var(--text-xs);
	}
	.lg {
		min-height: 3.25rem;
		padding-inline: 1.75rem;
		font-size: var(--text-md);
	}
	.icon {
		width: var(--touch-target);
		padding: 0;
	}
	.spinner {
		width: 1em;
		height: 1em;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
