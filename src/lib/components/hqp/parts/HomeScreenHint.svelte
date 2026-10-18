<script lang="ts">
	import { getHqpContext } from '../context';
	import Icon from './Icon.svelte';
	import Panel from './Panel.svelte';

	// "Add to Home Screen" how-to (section 7.12): three steps, iOS Safari tab mode only.
	const { ui } = getHqpContext();
</script>

{#if ui.shown === 'homescreen'}
	<Panel labelledby="hqp-home-title" kind="center">
		{#snippet header()}
			<div class="head">
				<h2 id="hqp-home-title" class="title">Edge-to-edge playback</h2>
				<button type="button" class="hqp-btn" aria-label="Close" onclick={() => ui.close()}>
					<Icon name="close" />
				</button>
			</div>
		{/snippet}
		<ol class="steps">
			<li>
				<span class="n">1</span><span
					>Tap <Icon name="share" size={20} /> <b>Share</b> in Safari's toolbar.</span
				>
			</li>
			<li>
				<span class="n">2</span><span
					>Choose <Icon name="add-square" size={20} /> <b>Add to Home Screen</b>.</span
				>
			</li>
			<li>
				<span class="n">3</span><span
					>Open <b>Alan DB</b> from your Home Screen: no browser bars, the island disappears into black.</span
				>
			</li>
		</ol>
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
	.steps {
		display: grid;
		gap: 14px;
		margin: 0;
		padding: 8px 22px 22px;
		list-style: none;
		font-size: 15px;
		line-height: 21px;
		color: var(--hqp-ink-2);
	}
	.steps li {
		display: grid;
		grid-template-columns: 28px 1fr;
		gap: 12px;
		align-items: start;
	}
	.steps li :global(.hqp-icon) {
		display: inline-block;
		vertical-align: -4px;
	}
	.n {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 13px;
		font-weight: 700;
		color: var(--hqp-ink);
		background: var(--hqp-fill-selected);
	}
	b {
		color: var(--hqp-ink);
	}
</style>
