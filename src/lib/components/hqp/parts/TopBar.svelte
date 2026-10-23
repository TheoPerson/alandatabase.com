<script lang="ts">
	import { getHqpContext } from '../context';
	import { eyebrow } from '../logic/labels';
	import { titleText } from '../logic/format';
	import Icon from './Icon.svelte';
	import SignalChip from './SignalChip.svelte';
	import TitleBlock from './TitleBlock.svelte';

	// Top bar (sections 5.1, 5.2, 5.4): island-free insets, one glass group for outputs.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;
	const item = $derived($snapshot.item);
	const airplay = $derived($snapshot.airplay.available);
	const pip = $derived($snapshot.pip);
</script>

<!-- On large layouts the bottom bar owns Picture in Picture and Full screen. -->
{#snippet outputs(lock: boolean, pipHere = true)}
	<div class="hqp-group hqp-glass">
		{#if airplay}
			<button
				type="button"
				class="hqp-btn"
				aria-label={$snapshot.airplay.active ? 'AirPlay: playing on another device' : 'AirPlay'}
				onclick={() => ctx.engine.showAirPlayPicker()}
			>
				<Icon name="airplay" />
			</button>
		{/if}
		{#if pipHere}
			<button
				type="button"
				class="hqp-btn"
				aria-label={pip ? 'Exit Picture in Picture' : 'Picture in Picture'}
				aria-pressed={pip}
				onclick={() => ctx.engine.togglePip()}
			>
				<Icon name={pip ? 'pip-exit' : 'pip'} />
			</button>
		{/if}
		{#if lock}
			<button
				type="button"
				class="hqp-btn"
				aria-label="Lock the screen"
				onclick={() => ui.setLocked(true)}
			>
				<Icon name="lock" />
			</button>
		{/if}
		<button
			type="button"
			class="hqp-btn"
			aria-label="Playback info"
			aria-expanded={ui.info}
			onclick={() => (ui.info = !ui.info)}
		>
			<Icon name="info" />
		</button>
	</div>
{/snippet}

{#if ui.portrait}
	<div class="hqp-topbar hqp-fade hqp-x-scrub" data-from="top" data-variant="portrait">
		<button
			type="button"
			class="hqp-btn hqp-glass"
			aria-label="Close player"
			onclick={() => ctx.close()}
		>
			<Icon name="chevron-down" />
		</button>
		<!-- The resume capsule takes the title block's badge row: the quality signal moves up here. -->
		{#if $snapshot.resume !== null && $snapshot.status !== 'error'}
			<div class="signal signal-portrait hqp-x-upnext"><SignalChip /></div>
		{/if}
		{@render outputs(false)}
	</div>
{:else if ui.layout === 'phone-landscape'}
	<div class="hqp-topbar hqp-fade hqp-x-scrub" data-from="top" data-variant="landscape">
		<button
			type="button"
			class="hqp-btn hqp-glass"
			aria-label="Close player"
			onclick={() => ctx.close()}
		>
			<Icon name="chevron-down" />
		</button>
		{#if item}
			<div class="heading hqp-x-upnext">
				{#if !ui.landscapeShort}
					<p class="hqp-eyebrow eyebrow">{eyebrow(item, true)}</p>
				{/if}
				<h2 class="title">{titleText(item.title)}</h2>
			</div>
		{/if}
		<span class="spacer"></span>
		<div class="signal hqp-x-upnext"><SignalChip long /></div>
		{@render outputs(true)}
	</div>
{:else}
	<div class="hqp-topbar hqp-fade hqp-x-scrub" data-from="top" data-variant="large">
		<TitleBlock variant="large" />
		<span class="spacer"></span>
		{@render outputs(false, false)}
		<button
			type="button"
			class="hqp-btn hqp-glass"
			aria-label="Close player"
			onclick={() => ctx.close()}
		>
			<Icon name="close" />
		</button>
	</div>
{/if}

<style>
	.hqp-topbar {
		position: absolute;
		left: var(--hqp-edge-x);
		right: var(--hqp-edge-x);
		display: flex;
		align-items: center;
		gap: 12px;
		z-index: var(--hqp-z-chrome);
	}
	.hqp-topbar[data-variant='portrait'] {
		top: calc(var(--hqp-edge-top) + 6px);
		justify-content: space-between;
	}
	.hqp-topbar[data-variant='landscape'] {
		top: 12px;
	}
	.hqp-topbar[data-variant='large'] {
		top: 24px;
		align-items: flex-start;
		gap: 12px;
	}
	.spacer {
		flex: 1;
	}
	.heading {
		display: grid;
		gap: 1px;
		min-width: 0;
		max-width: 38cqw;
	}
	.eyebrow,
	.title {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-shadow: 0 1px 12px var(--hqp-scrim-c);
	}
	.signal {
		display: flex;
		min-width: 0;
		max-width: 30cqw;
	}
	.signal-portrait {
		flex: 0 1 auto;
		justify-content: center;
		max-width: none;
		margin-inline: auto;
	}
</style>
