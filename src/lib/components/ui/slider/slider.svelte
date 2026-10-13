<script lang="ts">
	import { Slider } from 'bits-ui';

	interface Props {
		value: number;
		min: number;
		max: number;
		step?: number;
		/** Accessible name of the thumb. */
		label: string;
		/** Spoken value for assistive technology, e.g. "1 minute 15 seconds". */
		valueText?: (value: number) => string;
		/** Visual-only buffered range, in the same unit as `value`. */
		buffered?: number;
		onCommit?: (value: number) => void;
		/** Fires on every change while dragging or stepping. */
		onchange?: (value: number) => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(0),
		min,
		max,
		step = 1,
		label,
		valueText,
		buffered = 0,
		onCommit,
		onchange,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const bufferedPercent = $derived(
		max > min ? Math.min(100, Math.max(0, ((buffered - min) / (max - min)) * 100)) : 0
	);
</script>

<Slider.Root
	type="single"
	bind:value
	{min}
	{max}
	{step}
	{disabled}
	onValueChange={(next) => onchange?.(next)}
	onValueCommit={(committed) => onCommit?.(committed)}
	class="kit-slider {className}"
>
	<span class="track" aria-hidden="true">
		<span class="buffered" style:width={`${bufferedPercent}%`}></span>
		<Slider.Range class="kit-slider-range" />
	</span>
	<Slider.Thumb
		index={0}
		class="kit-slider-thumb"
		aria-label={label}
		aria-valuetext={valueText ? valueText(value) : undefined}
	/>
</Slider.Root>

<style>
	:global(.kit-slider) {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		height: var(--touch-target);
		touch-action: none;
		user-select: none;
	}
	:global(.kit-slider[data-disabled]) {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.track {
		position: relative;
		display: block;
		width: 100%;
		height: 4px;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.18);
	}
	.buffered {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		background: var(--surface-interactive);
	}
	:global(.kit-slider-range) {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--brand-primary);
	}
	:global(.kit-slider-thumb) {
		position: absolute;
		top: 50%;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--content-primary);
		box-shadow: var(--elevation-1);
		transform: translateY(-50%);
		cursor: grab;
		transition: transform var(--duration-fast) var(--ease-out);
	}
	:global(.kit-slider-thumb:active) {
		cursor: grabbing;
	}
	:global(.kit-slider:hover .kit-slider-thumb),
	:global(.kit-slider-thumb:focus-visible) {
		transform: translateY(-50%) scale(1.15);
	}
	:global(.kit-slider-thumb:focus-visible) {
		outline: 2px solid var(--brand-primary);
		outline-offset: 3px;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-slider-thumb) {
			transition: none;
		}
	}
</style>
