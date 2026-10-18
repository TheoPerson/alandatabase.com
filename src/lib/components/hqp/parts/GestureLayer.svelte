<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatTime } from '$lib/player/format-time';
	import { getHqpContext } from '../context';
	import {
		createGestureRecognizer,
		type GestureAction,
		type PointerSample
	} from '../logic/gestures';
	import { fillCrop, frameRect } from '../logic/layout';

	// The picture area: one Pointer Events recognizer (section 6.1). Pointer moves are coalesced into
	// one requestAnimationFrame write of CSS custom properties (section 10.2).
	const ctx = getHqpContext();
	const { snapshot, clock, ui } = ctx;
	const engine = () => ctx.engine;

	let layer: HTMLDivElement;
	let raf = 0;
	let pending: { scrub?: number; rate?: 1 | 0.5 | 0.25; dy?: number; pinch?: number } = {};
	let seekLabelTotal = 0;
	let seekOrigin = 0;

	const aspect = () => ($snapshot.aspect && $snapshot.aspect > 0 ? $snapshot.aspect : 16 / 9);

	function flush() {
		raf = 0;
		const root = ctx.root();
		if (pending.scrub !== undefined && ui.scrub) {
			ui.scrub.target = pending.scrub;
			if (pending.rate) ui.scrub.rate = pending.rate;
		}
		if (pending.dy !== undefined) root?.style.setProperty('--dy', String(pending.dy));
		if (pending.pinch !== undefined) root?.style.setProperty('--pinch', String(pending.pinch));
		pending = {};
	}

	function schedule() {
		if (!raf) raf = requestAnimationFrame(flush);
	}

	function measureTrack() {
		const track = ctx.root()?.querySelector('[data-hqp-track]');
		if (!track) return;
		const r = track.getBoundingClientRect();
		ui.track = { left: r.left, width: r.width };
	}

	function emit(action: GestureAction) {
		const e = engine();
		switch (action.type) {
			case 'toggleChrome':
				if (ui.overlay) ui.close();
				else if (ui.info && !ui.chrome) ui.info = false;
				else {
					ui.toggleChrome();
					if (ui.chrome) ui.arm();
				}
				break;
			case 'revertChrome':
				ui.chrome = !ui.chrome;
				break;
			case 'seekTap': {
				if (seekLabelTotal === 0) seekOrigin = $clock.position;
				seekLabelTotal = action.total;
				const target = Math.min(
					Math.max(0, seekOrigin + action.total),
					$clock.duration || Infinity
				);
				ui.flashSeek(action.side, action.total, target);
				break;
			}
			case 'seekCommit': {
				e.skip(action.total);
				const total = seekLabelTotal;
				const target = Math.min(Math.max(0, seekOrigin + total), $clock.duration || Infinity);
				ui.announce(
					`${total < 0 ? 'Back' : 'Forward'} ${Math.abs(total)} seconds, ${formatTime(target)}`
				);
				seekLabelTotal = 0;
				break;
			}
			case 'frameToggle':
				ctx.setFrame($snapshot.frameMode === 'fill' ? 'fit' : 'fill');
				break;
			case 'hold':
				e.holdRate(action.on);
				break;
			case 'scrubStart':
				measureTrack();
				ui.scrub = { source: 'pan', origin: action.origin, target: action.origin, rate: 1 };
				void e.ensureTrickplay();
				break;
			case 'scrubMove':
				pending.scrub = action.target;
				pending.rate = action.rate;
				if (action.rate !== 1 && !ctxPrefsFine) markFine();
				schedule();
				break;
			case 'scrubEnd':
				if (raf) cancelAnimationFrame(raf);
				raf = 0;
				pending = {};
				ui.finishScrub(
					(seconds) => e.seek(seconds),
					action.cancelled ? null : action.target,
					ui.scrub?.origin ?? action.target
				);
				if (!action.cancelled) ui.announce(`Moved to ${formatTime(action.target)}`);
				ui.scrub = null;
				break;
			case 'drag':
				ui.dragging = true;
				pending.dy = action.dy;
				schedule();
				break;
			case 'dismiss':
				ui.dragging = false;
				ui.dismissing = true;
				setTimeout(() => ctx.close(), ui.reducedMotion ? 120 : 220);
				break;
			case 'dragCancel':
				ui.dragging = false;
				pending.dy = 0;
				schedule();
				break;
			case 'swipeUp':
				if ($snapshot.item?.kind === 'episode' && $snapshot.queue.length > 1) ui.open('episodes');
				else ui.info = true;
				break;
			case 'pinch': {
				const cover = fillCrop(ui.viewport, aspect()).scale;
				const fill = $snapshot.frameMode === 'fill';
				const lo = fill ? 1 / cover : 0.9;
				const hi = fill ? 1.05 : cover * 1.05;
				ui.pinching = true;
				pending.pinch = Math.min(hi, Math.max(lo, action.scale));
				schedule();
				break;
			}
			case 'pinchEnd':
				ui.pinching = false;
				ctx.root()?.style.removeProperty('--pinch');
				if (action.mode && action.mode !== $snapshot.frameMode) ctx.setFrame(action.mode);
				break;
			case 'lockedTap':
				ui.showLockPill();
				break;
		}
	}

	let ctxPrefsFine = false;
	function markFine() {
		ctxPrefsFine = true;
	}

	const recognizer = createGestureRecognizer(() => {
		const viewport = ui.viewport;
		const mode = ui.portrait ? 'fit' : $snapshot.frameMode;
		return {
			viewport,
			frame: frameRect(ui.layout, viewport, aspect(), mode),
			layout: ui.layout,
			duration: $clock.duration,
			position: $clock.position,
			locked: ui.locked,
			edgeExclusion: ui.iosTab ? 24 : 0,
			chromeVisible: ui.chrome
		};
	}, emit);

	function sample(event: PointerEvent): PointerSample {
		const type =
			event.pointerType === 'mouse' || event.pointerType === 'pen' ? event.pointerType : 'touch';
		return { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, type };
	}

	// Desktop mouse on the large layout: click toggles play, double-click toggles fullscreen.
	const mouseDesktop = (event: PointerEvent) => event.pointerType === 'mouse' && ui.large;

	function onpointerdown(event: PointerEvent) {
		if (mouseDesktop(event)) return;
		if (event.button > 0) return;
		layer.setPointerCapture?.(event.pointerId);
		recognizer.down(sample(event));
	}
	function onpointermove(event: PointerEvent) {
		if (mouseDesktop(event)) return;
		recognizer.move(sample(event));
	}
	function onpointerup(event: PointerEvent) {
		if (mouseDesktop(event)) return;
		recognizer.up(sample(event));
	}
	function onpointercancel(event: PointerEvent) {
		recognizer.cancel(sample(event));
	}
	function onclick(event: MouseEvent) {
		if (!ui.large || (event as PointerEvent).pointerType === 'touch') return;
		if ((event as PointerEvent).pointerType && (event as PointerEvent).pointerType !== 'mouse')
			return;
		if (ui.overlay) {
			ui.close();
			return;
		}
		const s = $snapshot;
		if (s.autoplayBlocked) void engine().play();
		else engine().toggle();
		ui.showChrome();
	}
	function ondblclick() {
		if (!ui.large) return;
		const root = ctx.root();
		if (root) void engine().toggleFullscreen(root);
	}

	$effect(() => {
		// Persist the fine-scrub hint once used (prefs.hints.fineScrub).
		if (ui.scrub === null && ctxPrefsFine) {
			ctxPrefsFine = false;
			engine().updatePrefs({ hints: { fineScrub: true } });
		}
	});

	onDestroy(() => {
		recognizer.dispose();
		if (raf) cancelAnimationFrame(raf);
	});
</script>

<!-- The picture surface: gestures only (every action also has a button or a key). -->
<div
	bind:this={layer}
	class="hqp-gestures"
	role="presentation"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onpointercancel}
	{onclick}
	{ondblclick}
></div>

<style>
	.hqp-gestures {
		position: absolute;
		inset: 0;
		z-index: var(--hqp-z-transport);
		touch-action: none;
		-webkit-user-select: none;
		user-select: none;
	}
</style>
