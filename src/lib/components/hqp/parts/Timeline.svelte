<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { formatTime } from '$lib/player/format-time';
	import { getHqpContext } from '../context';
	import { meaningfulChapterTitle, sliderText } from '../logic/format';
	import { absoluteScrubTarget, isCancel, magnet, trackFineRate } from '../logic/scrub';
	import { chapterIndexAt, chapterMask, fraction } from '../logic/timeline';

	// The timeline (section 6.2): 5 px track in a 44 px hit area; buffered and played layers scale
	// (never width); chapter cuts are one mask; the thumb translates in an inline-size container.
	const { withTimes = false }: { withTimes?: boolean } = $props();

	const ctx = getHqpContext();
	const { snapshot, clock, prefs, ui } = ctx;

	const duration = $derived($clock.duration);
	const position = $derived($clock.position);
	const chapters = $derived($snapshot.chapters);
	// Track width for the chapter cuts (cuts closer than 24 px are dropped); a ResizeObserver keeps
	// it current without reading layout during playback.
	let railWidth = $state(0);
	const mask = $derived(chapterMask(chapters, duration, railWidth));
	const scrub = $derived(ui.scrub);
	const shown = $derived(scrub ? scrub.target : position);
	const p = $derived(fraction(shown, duration));
	const b = $derived(fraction(Math.max($clock.bufferedEnd, position), duration));
	const origin = $derived(scrub ? fraction(scrub.origin, duration) : null);
	const chapter = $derived.by(() => {
		const i = chapterIndexAt(chapters, shown);
		return i >= 0 ? chapters[i] : null;
	});
	const grabbing = $derived(scrub?.source === 'timeline');
	// Seeks jump (no 250 ms glide): a clock step larger than playback could make drops the
	// transition before the DOM updates, and it returns on the next frame.
	let jumped = $state(false);
	let lastPosition = untrack(() => $clock.position);
	let jumpRaf = 0;
	$effect.pre(() => {
		const next = position;
		const step = Math.abs(next - lastPosition);
		lastPosition = next;
		if (step <= 1.5) return;
		jumped = true;
		cancelAnimationFrame(jumpRaf);
		jumpRaf = requestAnimationFrame(() => (jumped = false));
	});
	const smooth = $derived(
		$snapshot.status === 'playing' && ui.chrome && !scrub && !jumped && !ui.reducedMotion
	);
	const showHint = $derived(grabbing && !$prefs.hints.fineScrub && !ui.finePointer);

	let rail: HTMLDivElement;
	let rect = { left: 0, top: 0, width: 0, height: 0 };
	let drag: {
		id: number;
		relative: boolean;
		anchorX: number;
		anchorTarget: number;
		rate: 1 | 0.5 | 0.25;
		usedFine: boolean;
	} | null = null;
	let raf = 0;
	let pendingTarget: number | null = null;
	let pendingRate: 1 | 0.5 | 0.25 = 1;

	function measure() {
		const r = rail.getBoundingClientRect();
		rect = { left: r.left, top: r.top, width: r.width, height: r.height };
		ui.track = { left: r.left, width: r.width };
	}

	function flush() {
		raf = 0;
		if (pendingTarget === null || !ui.scrub) return;
		ui.scrub.target = pendingTarget;
		ui.scrub.rate = pendingRate;
		pendingTarget = null;
	}

	function targetAt(x: number, y: number): { target: number; rate: 1 | 0.5 | 0.25 } {
		if (!drag) return { target: absoluteScrubTarget(x, rect, duration), rate: 1 };
		const above = rect.top + rect.height / 2 - y;
		const rate = trackFineRate(above);
		if (rate !== drag.rate) {
			// Re-anchor so changing speed never jumps the thumb.
			const current = ui.scrub?.target ?? position;
			drag.relative = true;
			drag.anchorX = x;
			drag.anchorTarget = current;
			drag.rate = rate;
			if (rate !== 1) drag.usedFine = true;
		}
		let target: number;
		if (!drag.relative) target = absoluteScrubTarget(x, rect, duration);
		else {
			const seconds = ((x - drag.anchorX) / Math.max(1, rect.width)) * duration * drag.rate;
			target = Math.min(duration, Math.max(0, drag.anchorTarget + seconds));
		}
		if (drag.rate === 1) target = magnet(target, chapters, rect.width / Math.max(1, duration));
		return { target, rate: drag.rate };
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button > 0 || !(duration > 0)) return;
		event.preventDefault();
		measure();
		rail.setPointerCapture?.(event.pointerId);
		drag = {
			id: event.pointerId,
			relative: false,
			anchorX: event.clientX,
			anchorTarget: position,
			rate: 1,
			usedFine: false
		};
		const first = targetAt(event.clientX, event.clientY);
		ui.hoverAt = null;
		ui.scrub = { source: 'timeline', origin: position, target: first.target, rate: 1 };
		void ctx.engine.ensureTrickplay();
	}

	function onpointermove(event: PointerEvent) {
		if (drag && event.pointerId === drag.id) {
			const next = targetAt(event.clientX, event.clientY);
			pendingTarget = next.target;
			pendingRate = next.rate;
			if (!raf) raf = requestAnimationFrame(flush);
			return;
		}
		if (event.pointerType === 'mouse' && ui.finePointer && !ui.scrub) {
			if (rect.width === 0) measure();
			ui.hoverAt = absoluteScrubTarget(event.clientX, rect, duration);
		}
	}

	function finish(event: PointerEvent, cancelled: boolean) {
		if (!drag || event.pointerId !== drag.id) return;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		const final = cancelled ? null : targetAt(event.clientX, event.clientY).target;
		const scrubState = ui.scrub;
		const usedFine = drag.usedFine;
		drag = null;
		pendingTarget = null;
		ui.scrub = null;
		if (usedFine && !$prefs.hints.fineScrub) ctx.engine.updatePrefs({ hints: { fineScrub: true } });
		const seek = (seconds: number) => ctx.engine.seek(seconds);
		const origin = scrubState?.origin ?? position;
		if (final === null || !scrubState) return ui.finishScrub(seek, null, origin);
		const pxPerSecond = rect.width / Math.max(1, duration);
		if (isCancel(final, scrubState.origin, pxPerSecond)) {
			ui.finishScrub(seek, null, origin);
			ui.announce('Seek cancelled');
			return;
		}
		ui.finishScrub(seek, final, origin);
		const at = chapterIndexAt(chapters, final);
		const name = at >= 0 ? meaningfulChapterTitle(chapters[at].title) : null;
		ui.announce(`Moved to ${formatTime(final)}${name ? `, ${name}` : ''}`);
	}

	function onpointerenter(event: PointerEvent) {
		if (event.pointerType !== 'mouse' || !ui.finePointer) return;
		measure();
		void ctx.engine.ensureTrickplay();
	}

	function onpointerleave(event: PointerEvent) {
		if (event.pointerType === 'mouse') ui.hoverAt = null;
	}

	function onkeydown(event: KeyboardEvent) {
		const steps: Record<string, number> = {
			ArrowLeft: -5,
			ArrowDown: -5,
			ArrowRight: 5,
			ArrowUp: 5,
			PageDown: -60,
			PageUp: 60
		};
		let target: number | null = null;
		if (event.key in steps) target = position + steps[event.key];
		else if (event.key === 'Home') target = 0;
		else if (event.key === 'End') target = Math.max(0, duration - 1);
		if (target === null) return;
		event.preventDefault();
		event.stopPropagation();
		ctx.engine.seek(Math.min(duration, Math.max(0, target)));
		ui.poke();
	}

	onMount(() => {
		// A scrub that exists before this timeline (pan gesture, harness) needs the track rect.
		if (ui.scrub) measure();
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (Math.abs(width - railWidth) >= 1) railWidth = width;
		});
		observer.observe(rail);
		return () => observer.disconnect();
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		cancelAnimationFrame(jumpRaf);
	});
</script>

<div
	class="hqp-timeline"
	class:with-times={withTimes}
	data-grab={grabbing ? '' : undefined}
	data-smooth={smooth ? '' : undefined}
	style:--p={p}
	style:--b={b}
	style:--o={origin ?? 0}
>
	{#if withTimes}
		<span class="time hqp-tnum">{formatTime(shown)}</span>
	{/if}
	<div
		bind:this={rail}
		class="hit"
		role="slider"
		tabindex="0"
		aria-label="Seek"
		aria-valuemin={0}
		aria-valuemax={Math.round(duration)}
		aria-valuenow={Math.round(shown)}
		aria-valuetext={sliderText(shown, duration, chapter)}
		data-hqp-track
		{onpointerdown}
		{onpointermove}
		onpointerup={(e) => finish(e, false)}
		onpointercancel={(e) => finish(e, true)}
		{onpointerenter}
		{onpointerleave}
		{onkeydown}
	>
		<div class="rail">
			<div class="track" style:-webkit-mask-image={mask} style:mask-image={mask}>
				<div class="buffered"></div>
				<div class="played"></div>
			</div>
			{#if origin !== null}<div class="origin" aria-hidden="true"></div>{/if}
			<div class="thumb" aria-hidden="true"></div>
		</div>
	</div>
	{#if withTimes}
		<span class="time remaining hqp-tnum">−{formatTime(Math.max(0, duration - shown))}</span>
	{/if}
	{#if showHint}
		<p class="hint" aria-hidden="true">Slide up for fine scrubbing</p>
	{/if}
</div>

<style>
	.hqp-timeline {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}
	/* Fixed boxes: a time that changes on every scrub frame never relayouts the row (section 10.2). */
	.time {
		flex: none;
		width: 64px;
		height: 16px;
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--hqp-ink);
		text-shadow: 0 1px 8px var(--hqp-scrim-b);
		contain: size layout style;
	}
	.remaining {
		text-align: right;
		color: var(--hqp-ink-2);
	}
	.hit {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 44px;
		display: grid;
		align-items: center;
		touch-action: none;
		cursor: pointer;
		border-radius: 8px;
	}
	.rail {
		position: relative;
		height: 15px;
		display: grid;
		align-items: center;
		container-type: inline-size;
	}
	.track {
		position: relative;
		height: 5px;
		border-radius: 3px;
		background: var(--hqp-track);
		overflow: hidden;
		transition: scale var(--hqp-dur-in) var(--hqp-ease-out);
	}
	.buffered,
	.played {
		position: absolute;
		inset: 0;
		transform-origin: 0 50%;
	}
	.buffered {
		background: var(--hqp-buffered);
		scale: var(--b) 1;
	}
	.played {
		background: var(--hqp-played);
		scale: var(--p) 1;
	}
	.hqp-timeline[data-smooth] .played,
	.hqp-timeline[data-smooth] .thumb {
		transition:
			scale 250ms linear,
			translate 250ms linear;
	}
	.thumb {
		position: absolute;
		left: -7.5px;
		top: 0;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--hqp-thumb);
		box-shadow: var(--hqp-thumb-shadow);
		translate: calc(var(--p) * 100cqw) 0;
		transition: scale var(--hqp-dur-in) var(--hqp-ease-out);
	}
	.origin {
		position: absolute;
		left: -1px;
		top: 0.5px;
		width: 2px;
		height: 14px;
		border-radius: 1px;
		background: var(--hqp-ink);
		opacity: 0.7;
		translate: calc(var(--o) * 100cqw) 0;
	}
	.hqp-timeline[data-grab] .track {
		scale: 1 1.7;
	}
	.hqp-timeline[data-grab] .thumb {
		scale: 1.45;
	}
	.hint {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(100% + 4px);
		margin: 0;
		text-align: center;
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
		color: var(--hqp-ink-2);
		text-shadow: 0 1px 8px var(--hqp-scrim-a);
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.track,
		.thumb {
			transition: none;
		}
	}
</style>
