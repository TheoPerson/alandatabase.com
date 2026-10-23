<script lang="ts">
	import { HQP_SHORTCUTS } from '$lib/player/hqp/shortcuts';
	import { getHqpContext } from '../context';
	import Icon from './Icon.svelte';
	import Panel from './Panel.svelte';

	// Shortcut help (section 7.11): a thick-glass dialog listing HQP_SHORTCUTS.
	const { ui } = getHqpContext();
</script>

{#if ui.shown === 'help'}
	<Panel labelledby="hqp-help-title" kind="center" wide>
		{#snippet header()}
			<div class="head">
				<h2 id="hqp-help-title" class="title">Keyboard shortcuts</h2>
				<button
					type="button"
					class="hqp-btn"
					aria-label="Close shortcuts"
					onclick={() => ui.close()}
				>
					<Icon name="close" />
				</button>
			</div>
		{/snippet}
		<dl class="list">
			{#each HQP_SHORTCUTS as shortcut (shortcut.action + shortcut.display)}
				<dt><kbd>{shortcut.display}</kbd></dt>
				<dd>{shortcut.label}</dd>
			{/each}
		</dl>
	</Panel>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		padding: 10px 10px 4px 22px;
	}
	.title {
		flex: 1;
		margin: 0;
		font-size: 19px;
		line-height: 24px;
		font-weight: 700;
	}
	.list {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 8px 14px;
		margin: 0;
		padding: 8px 22px 22px;
		overflow: auto;
		min-height: 0;
		font-size: 14px;
		line-height: 18px;
	}
	dd {
		margin: 0;
		color: var(--hqp-ink-2);
	}
	dt {
		justify-self: end;
	}
	@container hqp (min-width: 720px) {
		.list {
			grid-template-columns: auto 1fr auto 1fr;
			column-gap: 14px;
		}
	}
	kbd {
		display: inline-block;
		min-width: 28px;
		padding: 3px 8px;
		border-radius: 8px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		background: var(--hqp-fill-selected);
		box-shadow: inset 0 calc(-1 * var(--hqp-hairline)) 0 var(--hqp-glass-rim);
	}
</style>
