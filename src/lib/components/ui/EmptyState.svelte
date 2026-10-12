<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		action?: Snippet;
		compact?: boolean;
	}

	let { title, description, action, compact = false }: Props = $props();
</script>

<section class:compact class="state-panel" role="status" aria-live="polite">
	<span class="state-mark" aria-hidden="true"></span>
	<h3>{title}</h3>
	{#if description}<p>{description}</p>{/if}
	{#if action}<div class="state-action">{@render action()}</div>{/if}
</section>

<style>
	.state-panel {
		display: grid;
		place-items: center;
		gap: var(--space-3);
		min-height: 18rem;
		padding: var(--space-7) var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		text-align: center;
	}

	.state-panel.compact {
		min-height: 11rem;
		padding: var(--space-5);
	}

	.state-mark {
		width: 2.25rem;
		height: 0.3rem;
		border-radius: var(--radius-full);
		background: var(--brand-primary);
	}

	h3 {
		margin: 0;
		font-size: var(--text-xl);
		letter-spacing: -0.025em;
	}

	p {
		max-width: 36rem;
		margin: 0;
		color: var(--content-secondary);
	}

	.state-action {
		margin-top: var(--space-2);
	}
</style>
