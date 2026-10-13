<script lang="ts">
	import Sheet from '../sheet/sheet.svelte';
	import Tabs from '../tabs/tabs.svelte';
	import Slider from '../slider/slider.svelte';
	import {
		AUTO_HIDE_DELAYS,
		SPEEDS,
		type AutoHideDelay,
		type CaptionSize,
		type PlayerPrefs
	} from '$lib/player/prefs';
	import { clearAllResume, clearResume, listResume } from '$lib/player/resume';
	import type { Capabilities } from '$lib/player/types';

	interface Props {
		open: boolean;
		prefs: PlayerPrefs;
		capabilities: Capabilities;
		videoKey: string;
		/** Bottom sheet on phones, right panel on wide screens. */
		side?: 'bottom' | 'right';
		onchange: (prefs: PlayerPrefs) => void;
	}

	let {
		open = $bindable(false),
		prefs,
		capabilities,
		videoKey,
		side = 'bottom',
		onchange
	}: Props = $props();

	const TABS = [
		{ value: 'video', label: 'Video' },
		{ value: 'audio', label: 'Audio' },
		{ value: 'subtitles', label: 'Subtitles' },
		{ value: 'playback', label: 'Playback' }
	];
	let tab = $state('video');
	let volumePercent = $state(Math.round(prefs.volume * 100));
	let savedCount = $state(0);
	let forgotThis = $state(false);

	const YOUTUBE_ONLY = 'Not available for YouTube trailers';
	// Only speeds the preferences can store; the source may offer more (YouTube lists 0.25×).
	const rates = $derived(
		capabilities.rates.filter((rate) => (SPEEDS as readonly number[]).includes(rate))
	);

	function set<K extends keyof PlayerPrefs>(key: K, value: PlayerPrefs[K]) {
		if (prefs[key] === value) return;
		onchange({ ...prefs, [key]: value });
	}

	$effect(() => {
		volumePercent = Math.round(prefs.volume * 100);
	});

	$effect(() => {
		const level = volumePercent / 100;
		if (Math.abs(level - prefs.volume) >= 0.01) set('volume', level);
	});

	function refreshCount() {
		try {
			savedCount = listResume(localStorage).length;
		} catch {
			savedCount = 0;
		}
	}

	$effect(() => {
		if (open) refreshCount();
	});

	function forgetThis() {
		try {
			clearResume(localStorage, videoKey);
		} catch {
			// ignore
		}
		forgotThis = true;
		refreshCount();
	}

	function forgetAll() {
		try {
			clearAllResume(localStorage);
		} catch {
			// ignore
		}
		forgotThis = true;
		refreshCount();
	}
</script>

{#snippet switchRow(label: string, checked: boolean, onclick: () => void, hint?: string)}
	<div class="row">
		<span class="row-text">
			<span class="row-label">{label}</span>
			{#if hint}<span class="row-hint">{hint}</span>{/if}
		</span>
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			class="switch"
			{onclick}
		>
			<span class="knob"></span>
		</button>
	</div>
{/snippet}

{#snippet disabledRow(label: string, reason: string, value: string)}
	<div class="row disabled" aria-disabled="true">
		<span class="row-text">
			<span class="row-label">{label}</span>
			<span class="row-hint">{reason}</span>
		</span>
		<span class="row-value">{value}</span>
	</div>
{/snippet}

<Sheet bind:open label="Player settings" {side} modal={false} class="player-settings">
	<Tabs
		bind:value={tab}
		items={TABS}
		label="Settings sections"
		orientation={side === 'right' ? 'vertical' : 'horizontal'}
		activation="manual"
		class="settings-tabs"
	>
		{#snippet children(value)}
			{#if value === 'video'}
				{@render disabledRow('Quality', 'Set by YouTube', 'Auto')}
				<fieldset class="group">
					<legend>Format</legend>
					<label class="row">
						<span class="row-label">Fit</span>
						<input type="radio" name="format" value="fit" checked disabled />
					</label>
					{#each ['Fill', '16:9', '4:3', 'Zoom'] as option (option)}
						<label class="row disabled">
							<span class="row-text">
								<span class="row-label">{option}</span>
								<span class="row-hint">{YOUTUBE_ONLY}</span>
							</span>
							<input type="radio" name="format" value={option} disabled />
						</label>
					{/each}
				</fieldset>
				{@render switchRow(
					'OLED mode',
					prefs.oled,
					() => set('oled', !prefs.oled),
					'Pure black chrome, dimmed controls'
				)}
			{:else if value === 'audio'}
				<div class="row stacked">
					<span class="row-label">Volume</span>
					<Slider
						bind:value={volumePercent}
						min={0}
						max={100}
						label="Volume"
						valueText={(v) => `${v}%`}
					/>
					<span class="row-value">{volumePercent}%</span>
				</div>
				{@render disabledRow(
					'Boost',
					capabilities.boost ? 'Up to 2×' : 'Needs a local file',
					'Off'
				)}
			{:else if value === 'subtitles'}
				{@render switchRow(
					'Captions',
					prefs.captions,
					() => set('captions', !prefs.captions),
					capabilities.captions ? 'Uses the tracks YouTube provides' : 'No tracks'
				)}
				<fieldset class="group">
					<legend>Size</legend>
					{#each [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as [size, label] (size)}
						<label class="row">
							<span class="row-label">{label}</span>
							<input
								type="radio"
								name="caption-size"
								value={size}
								checked={prefs.captionSize === size}
								onchange={() => set('captionSize', size as CaptionSize)}
							/>
						</label>
					{/each}
				</fieldset>
				{@render disabledRow('Style', YOUTUBE_ONLY, 'Default')}
				{@render disabledRow('Position', YOUTUBE_ONLY, 'Bottom')}
			{:else if value === 'playback'}
				<fieldset class="group">
					<legend>Speed</legend>
					<div class="segments" role="presentation">
						{#each rates as rate (rate)}
							<label class="segment" class:active={prefs.speed === rate}>
								<input
									type="radio"
									name="speed"
									value={rate}
									checked={prefs.speed === rate}
									onchange={() => set('speed', rate)}
								/>
								<span>{rate}×</span>
							</label>
						{/each}
					</div>
				</fieldset>
				{@render switchRow(
					'Resume where you left off',
					prefs.resume,
					() => set('resume', !prefs.resume),
					'Positions are kept on this device for 90 days'
				)}
				<div class="row">
					<span class="row-label">Saved positions</span>
					<span class="buttons">
						<button type="button" class="link" onclick={forgetThis} disabled={forgotThis}>
							Forget this one
						</button>
						<button type="button" class="link" onclick={forgetAll} disabled={savedCount === 0}>
							Forget all ({savedCount})
						</button>
					</span>
				</div>
				{@render switchRow(
					'Keyboard shortcuts',
					prefs.shortcuts,
					() => set('shortcuts', !prefs.shortcuts),
					'Single keys such as Space, J, K, L and M'
				)}
				<fieldset class="group">
					<legend>Hide controls after</legend>
					<div class="segments" role="presentation">
						{#each AUTO_HIDE_DELAYS as delay (delay)}
							<label class="segment" class:active={prefs.autoHideMs === delay}>
								<input
									type="radio"
									name="auto-hide"
									value={delay}
									checked={prefs.autoHideMs === delay}
									onchange={() => set('autoHideMs', delay as AutoHideDelay)}
								/>
								<span>{delay / 1000} s</span>
							</label>
						{/each}
					</div>
				</fieldset>
			{/if}
		{/snippet}
	</Tabs>
</Sheet>

<style>
	:global(.player-settings .settings-tabs) {
		min-height: 100%;
	}
	:global(.player-settings .kit-tabs-panel) {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-height: 0;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--touch-target);
		padding-block: 0.25rem;
	}
	.row.stacked {
		flex-wrap: wrap;
	}
	.row.stacked :global(.kit-slider) {
		flex: 1 1 10rem;
	}
	.row.disabled {
		opacity: 0.55;
	}
	.row-text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.row-label {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.row-hint {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
	}
	.row-value {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.group {
		display: grid;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-1);
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	label.row {
		cursor: pointer;
	}
	input[type='radio'] {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--brand-primary);
	}
	.switch {
		position: relative;
		flex: 0 0 auto;
		width: 3rem;
		height: 1.75rem;
		border-radius: var(--radius-full);
		background: var(--surface-interactive);
		transition: background-color var(--duration-base) var(--ease-out);
	}
	.switch[aria-checked='true'] {
		background: var(--brand-primary);
	}
	.switch:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	.knob {
		position: absolute;
		top: 0.2rem;
		left: 0.2rem;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 50%;
		background: var(--content-primary);
		transition: transform var(--duration-base) var(--ease-out);
	}
	.switch[aria-checked='true'] .knob {
		transform: translateX(1.25rem);
	}
	.segments {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.segment {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3.25rem;
		min-height: var(--touch-target);
		padding-inline: 0.6rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 700;
		cursor: pointer;
	}
	.segment.active {
		border-color: var(--brand-primary);
		background: var(--brand-muted);
		color: var(--content-primary);
	}
	.segment input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.segment:has(input:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.link {
		min-height: var(--touch-target);
		padding-inline: var(--space-2);
		color: var(--brand-primary);
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.link:disabled {
		color: var(--content-tertiary);
		cursor: not-allowed;
	}
	@media (prefers-reduced-motion: reduce) {
		.switch,
		.knob {
			transition: none;
		}
	}
</style>
