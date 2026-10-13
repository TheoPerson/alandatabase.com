<script lang="ts">
	import Dialog from '../dialog/dialog.svelte';
	import { SHORTCUTS } from '$lib/player/shortcuts';

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
</script>

<Dialog bind:open label="Keyboard shortcuts">
	<h3 class="title">Keyboard shortcuts</h3>
	<dl class="keys">
		{#each SHORTCUTS as shortcut (shortcut.action)}
			<dt><kbd>{shortcut.display}</kbd></dt>
			<dd>{shortcut.label}</dd>
		{/each}
	</dl>
	<p class="note">Shortcuts can be turned off in the player settings.</p>
</Dialog>

<style>
	.title {
		margin-bottom: var(--space-4);
		font-size: var(--type-title);
		font-weight: 800;
	}
	.keys {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2) var(--space-4);
		align-items: center;
	}
	kbd {
		display: inline-block;
		min-width: 2.5rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-interactive);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-align: center;
	}
	dd {
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	.note {
		margin-top: var(--space-4);
		color: var(--content-tertiary);
		font-size: var(--text-xs);
	}
</style>
