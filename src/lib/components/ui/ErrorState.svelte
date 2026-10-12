<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		description: string;
		action?: Snippet;
	}

	let { title = 'Something went wrong', description, action }: Props = $props();
</script>

<section class="error-panel" role="alert">
	<span class="error-mark" aria-hidden="true">!</span>
	<div>
		<h3>{title}</h3>
		<p>{description}</p>
	</div>
	{#if action}<div class="error-action">{@render action()}</div>{/if}
</section>

<style>
	.error-panel {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-5);
		border: 1px solid rgba(251, 113, 133, 0.35);
		border-radius: var(--radius-lg);
		background: rgba(251, 113, 133, 0.07);
	}

	.error-mark {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid currentColor;
		border-radius: 50%;
		color: var(--color-error);
		font-weight: 800;
	}

	h3,
	p {
		margin: 0;
	}

	p {
		margin-top: var(--space-1);
		color: var(--content-secondary);
	}

	.error-action {
		grid-column: 2;
	}
</style>
