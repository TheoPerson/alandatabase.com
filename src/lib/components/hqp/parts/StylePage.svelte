<script lang="ts">
	import type { HqpSubtitleStyle } from '$lib/player/hqp/types';
	import { getHqpContext } from '../context';
	import { rovingGroup } from './a11y';

	// Subtitle style (section 7.2): size, look, colour, position and a sync offset stepper; the live
	// sample line shows over the picture (Subtitles.svelte).
	const ctx = getHqpContext();
	const { snapshot, prefs } = ctx;
	const style = $derived($prefs.subtitleStyle);
	const offset = $derived($snapshot.subtitles.offsetSeconds);

	type Field = keyof HqpSubtitleStyle;
	const GROUPS: Array<{
		field: Field;
		label: string;
		options: Array<{ value: string; label: string; aria?: string }>;
	}> = [
		{
			field: 'size',
			label: 'Size',
			options: [
				{ value: 's', label: 'S', aria: 'Small' },
				{ value: 'm', label: 'M', aria: 'Medium' },
				{ value: 'l', label: 'L', aria: 'Large' },
				{ value: 'xl', label: 'XL', aria: 'Extra large' }
			]
		},
		{
			field: 'background',
			label: 'Look',
			options: [
				{ value: 'shadow', label: 'Shadow' },
				{ value: 'outline', label: 'Outline' },
				{ value: 'box', label: 'Box' }
			]
		},
		{
			field: 'color',
			label: 'Colour',
			options: [
				{ value: 'white', label: 'White' },
				{ value: 'yellow', label: 'Yellow' }
			]
		},
		{
			field: 'position',
			label: 'Position',
			options: [
				{ value: 'auto', label: 'Auto' },
				{ value: 'low', label: 'Low' }
			]
		}
	];

	function set(field: Field, value: string) {
		ctx.engine.updatePrefs({ subtitleStyle: { [field]: value } as Partial<HqpSubtitleStyle> });
	}
	function shift(delta: number) {
		const next = Math.round(Math.min(10, Math.max(-10, offset + delta)) * 10) / 10;
		ctx.engine.setSubtitleOffset(next);
	}
	const offsetText = $derived(
		offset === 0 ? '0.0 s' : `${offset > 0 ? '+' : '−'}${Math.abs(offset).toFixed(1)} s`
	);
</script>

<div class="style">
	{#each GROUPS as group (group.field)}
		<div class="field">
			<span class="label" id="hqp-style-{group.field}">{group.label}</span>
			<div
				class="hqp-seg"
				role="radiogroup"
				aria-labelledby="hqp-style-{group.field}"
				use:rovingGroup
			>
				{#each group.options as option (option.value)}
					{@const checked = style[group.field] === option.value}
					<button
						type="button"
						role="radio"
						aria-checked={checked}
						aria-label={option.aria}
						tabindex={checked ? 0 : -1}
						onclick={() => set(group.field, option.value)}>{option.label}</button
					>
				{/each}
			</div>
		</div>
	{/each}
	<div class="field">
		<span class="label" id="hqp-style-sync">Sync</span>
		<div class="stepper" role="group" aria-labelledby="hqp-style-sync">
			<button
				type="button"
				class="hqp-btn step"
				aria-label="Subtitles 0.1 seconds earlier"
				disabled={offset <= -10}
				onclick={() => shift(-0.1)}>−</button
			>
			<output class="value hqp-tnum" aria-live="polite">{offsetText}</output>
			<button
				type="button"
				class="hqp-btn step"
				aria-label="Subtitles 0.1 seconds later"
				disabled={offset >= 10}
				onclick={() => shift(0.1)}>+</button
			>
			<button
				type="button"
				class="reset"
				disabled={offset === 0}
				onclick={() => ctx.engine.setSubtitleOffset(0)}>Reset</button
			>
		</div>
	</div>
</div>

<style>
	.style {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		display: grid;
		align-content: start;
		gap: 14px;
		padding: 6px 18px calc(var(--hqp-sa-b) + 16px);
	}
	.field {
		display: grid;
		gap: 8px;
	}
	.label {
		font-size: 12px;
		line-height: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hqp-ink-3);
	}
	:global(.hqp[data-layout='phone-landscape']) .style,
	:global(.hqp[data-layout='large']) .style {
		grid-template-columns: 1fr 1fr;
		column-gap: 18px;
	}
	@media (orientation: landscape) and (max-height: 379px) {
		:global(.hqp[data-layout='phone-landscape']) .style {
			grid-template-columns: 1fr;
		}
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 3px;
		border-radius: var(--hqp-r-capsule);
		background: var(--hqp-fill-row);
	}
	.step {
		font-size: 22px;
		font-weight: 600;
	}
	.step:disabled,
	.reset:disabled {
		opacity: 0.4;
	}
	.value {
		flex: 1;
		text-align: center;
		font-size: 15px;
		font-weight: 700;
	}
	.reset {
		min-width: 44px;
		height: 44px;
		padding: 0 14px;
		font-size: 14px;
		font-weight: 600;
		color: var(--hqp-ink-2);
	}
</style>
