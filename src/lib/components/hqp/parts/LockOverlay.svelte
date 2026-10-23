<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getHqpContext } from '../context';
	import Icon from './Icon.svelte';

	// Lock (section 7.10): every gesture is ignored; a tap shows this pill for 2 s; a 1 s long press
	// on it unlocks, with a filling ring. Keyboard: Enter / Space held, or Esc.
	const { ui } = getHqpContext();

	let holding = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function start(event: PointerEvent | KeyboardEvent) {
		if (event instanceof KeyboardEvent) {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			if (event.repeat) return;
		}
		holding = true;
		ui.lockPill = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			holding = false;
			ui.setLocked(false);
			ui.announce('Screen unlocked');
		}, 1000);
	}
	function stop() {
		holding = false;
		if (timer) clearTimeout(timer);
		timer = null;
		if (ui.locked) ui.showLockPill();
	}
	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});
</script>

{#if ui.locked && ui.lockPill}
	<button
		type="button"
		class="hqp-lock hqp-glass"
		data-holding={holding ? '' : undefined}
		aria-label="Screen locked. Press and hold for one second to unlock"
		onpointerdown={start}
		onpointerup={stop}
		onpointercancel={stop}
		onpointerleave={stop}
		onkeydown={start}
		onkeyup={stop}
		oncontextmenu={(e) => e.preventDefault()}
	>
		<span class="hold-ring" aria-hidden="true">
			<svg viewBox="0 0 32 32"
				><circle class="bg" cx="16" cy="16" r="14" /><circle
					class="fg"
					cx="16"
					cy="16"
					r="14"
					pathLength="100"
				/></svg
			>
			<Icon name="lock" size={16} />
		</span>
		<span>Locked · hold to unlock</span>
	</button>
{/if}

<style>
	.hqp-lock {
		position: absolute;
		left: 0;
		right: 0;
		top: 16px;
		width: fit-content;
		margin-inline: auto;
		z-index: var(--hqp-z-alert);
		display: inline-flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		padding: 0 18px 0 8px;
		border-radius: var(--hqp-r-capsule);
		font-size: 15px;
		font-weight: 600;
		touch-action: none;
		-webkit-touch-callout: none;
		animation: hqp-lock-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-lock {
		top: calc(var(--hqp-edge-top) + 6px);
	}
	.hold-ring {
		position: relative;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
	}
	.hold-ring svg {
		position: absolute;
		inset: 0;
		rotate: -90deg;
	}
	.hold-ring circle {
		fill: none;
		stroke-width: 2.5;
	}
	.hold-ring .bg {
		stroke: var(--hqp-track);
	}
	.hold-ring .fg {
		stroke: var(--hqp-accent);
		stroke-linecap: round;
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
	}
	.hqp-lock[data-holding] .fg {
		animation: hqp-fill 1s linear forwards;
	}
	@keyframes hqp-fill {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes hqp-lock-in {
		from {
			opacity: 0;
		}
	}
</style>
