<script lang="ts">
	import { getHqpContext } from '../context';
	import { signalInfo } from '../logic/labels';

	// The live truth chip (section 7.1): white text; only the dot carries the truth colour
	// (emerald Original, amber Converted, grey Preparing).
	// A 32 px capsule inside a 44 px button.
	const { long = false }: { long?: boolean } = $props();
	const { snapshot, ui } = getHqpContext();
	const info = $derived(signalInfo($snapshot.session, $snapshot.item, $snapshot.status, long));
	// Over the picture (landscape, large) the chip is a regular glass capsule like its neighbours;
	// on the portrait badge row it sits on black, where a flat fill is enough.
	const glass = $derived(!ui.portrait);
</script>

<button
	type="button"
	class="hqp-signal"
	data-tone={info.tone}
	aria-label={info.aria}
	aria-expanded={ui.info}
	onclick={() => (ui.info = !ui.info)}
>
	<span class="pill" class:hqp-glass={glass}>
		<span class="dot" aria-hidden="true"></span>
		<span class="text">{info.text}</span>
	</span>
</button>

<style>
	.hqp-signal {
		display: inline-flex;
		align-items: center;
		min-width: 44px;
		max-width: 100%;
		height: 44px;
		transition: scale var(--hqp-dur-press) var(--hqp-ease-out);
	}
	.hqp-signal:active {
		scale: 0.95;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
		height: 32px;
		padding: 0 12px 0 10px;
		border-radius: var(--hqp-r-capsule);
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
		color: var(--hqp-ink);
		font-variant-numeric: tabular-nums;
	}
	/* Flat fill on black (portrait); the glass material is left alone over the picture. */
	.pill:not(.hqp-glass) {
		background: var(--hqp-fill-row);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dot {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--hqp-ink-3);
	}
	.hqp-signal[data-tone='direct'] .dot {
		background: var(--hqp-accent);
		box-shadow: 0 0 8px var(--hqp-accent);
	}
	.hqp-signal[data-tone='converted'] .dot {
		background: var(--hqp-warn);
	}
	.hqp-signal:focus-visible {
		outline: none;
	}
	.hqp-signal:focus-visible .pill {
		outline: 2px solid var(--hqp-accent);
		outline-offset: 3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-signal:active {
			scale: none;
		}
	}
</style>
