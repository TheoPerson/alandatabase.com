<script lang="ts">
	import { SPEEDS } from '$lib/player/prefs';
	import type { SleepMode } from '$lib/player/hqp/types';
	import { getHqpContext } from '../context';
	import { rovingGroup } from './a11y';

	// Playback (section 7.2): speed, sleep timer, autoplay next and Lite glass.
	const ctx = getHqpContext();
	const { snapshot, prefs, ui } = ctx;
	const isEpisode = $derived($snapshot.item?.kind === 'episode');
	const SLEEP: Array<{ value: SleepMode; label: string }> = $derived([
		{ value: 'off', label: 'Off' },
		{ value: 'end-of-item', label: isEpisode ? 'End of episode' : 'End of film' },
		{ value: 15, label: '15 min' },
		{ value: 30, label: '30 min' },
		{ value: 60, label: '60 min' }
	]);

	function setRate(rate: number) {
		ctx.engine.setRate(rate);
		ui.announce(`Speed ${rate}x`);
	}
	function setSleep(mode: SleepMode) {
		ctx.engine.setSleep(mode);
		ui.announce(mode === 'off' ? 'Sleep timer off' : 'Sleep timer set');
	}
</script>

<div class="playback">
	<div class="field">
		<span class="label" id="hqp-speed-h">Speed</span>
		<div class="hqp-seg speeds" role="radiogroup" aria-labelledby="hqp-speed-h" use:rovingGroup>
			{#each SPEEDS as speed (speed)}
				{@const checked = Math.abs($snapshot.rate - speed) < 0.01}
				<button
					type="button"
					role="radio"
					aria-checked={checked}
					aria-label="{speed}x"
					tabindex={checked ? 0 : -1}
					class="hqp-tnum"
					onclick={() => setRate(speed)}>{speed}×</button
				>
			{/each}
		</div>
		<p class="hint">Long-press the picture for 2×</p>
	</div>

	<div class="field">
		<span class="label" id="hqp-sleep-h">Sleep timer</span>
		<div class="hqp-seg wrap" role="radiogroup" aria-labelledby="hqp-sleep-h" use:rovingGroup>
			{#each SLEEP as option (option.value)}
				{@const checked = $snapshot.sleep.mode === option.value}
				<button
					type="button"
					role="radio"
					aria-checked={checked}
					tabindex={checked ? 0 : -1}
					onclick={() => setSleep(option.value)}>{option.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="switches">
		{#if isEpisode}
			<button
				type="button"
				class="hqp-row switch-row"
				role="switch"
				aria-checked={$prefs.autoplayNext}
				onclick={() => ctx.engine.updatePrefs({ autoplayNext: !$prefs.autoplayNext })}
			>
				<span class="text">
					<span class="hqp-row-label">Autoplay next episode</span>
					<span class="hqp-row-detail">Plays with a 10 s countdown</span>
				</span>
				<span class="hqp-switch" aria-hidden="true"></span>
			</button>
		{/if}
		<button
			type="button"
			class="hqp-row switch-row"
			role="switch"
			aria-checked={$prefs.liteGlass}
			onclick={() => ctx.engine.updatePrefs({ liteGlass: !$prefs.liteGlass })}
		>
			<span class="text">
				<span class="hqp-row-label">Lite glass</span>
				<span class="hqp-row-detail">Solid fills instead of blur</span>
			</span>
			<span class="hqp-switch" aria-hidden="true"></span>
		</button>
	</div>
</div>

<style>
	.playback {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 16px;
		padding: 6px 16px calc(var(--hqp-sa-b) + 14px);
		container-type: inline-size;
	}
	/* Seven speeds in one row with full labels ("0.75×"); two rows (4 + 3) when the sheet is narrow,
	   so every target stays 44 px. */
	.speeds {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}
	.speeds > :global(button) {
		padding: 0 2px;
		text-overflow: clip;
	}
	@container (max-width: 380px) {
		.speeds {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			border-radius: 22px;
		}
	}
	.field {
		display: grid;
		gap: 8px;
	}
	.label {
		padding: 0 6px;
		font-size: 12px;
		line-height: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hqp-ink-3);
	}
	.hint {
		margin: 0 6px;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-3);
	}
	.wrap {
		flex-wrap: wrap;
		border-radius: 22px;
	}
	.wrap > :global(button) {
		flex: 1 1 auto;
	}
	.switches {
		display: grid;
		gap: 4px;
		margin: 0 -6px;
	}
	.switch-row {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.text {
		min-width: 0;
	}
	:global(.hqp[data-layout='phone-landscape']) .playback,
	:global(.hqp[data-layout='large']) .playback {
		padding-bottom: 14px;
	}
</style>
