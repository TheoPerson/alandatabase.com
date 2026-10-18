<script lang="ts">
	import './hqp-tokens.css';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { createHqpEngine } from '$lib/player/hqp/engine';
	import { matchHqpShortcut, shouldHandleHqpShortcut } from '$lib/player/hqp/shortcuts';
	import type {
		FrameMode,
		HqpEngine,
		HqpItem,
		HqpLaunchPayload,
		HqpShortcutAction
	} from '$lib/player/hqp/types';
	import { formatTime } from '$lib/player/format-time';
	import { createBridge } from './bridge';
	import { setHqpContext } from './context';
	import { HqpUi, type HqpUiSeed } from './ui-state.svelte';
	import { shouldHideChrome } from './logic/chrome';
	import { aspectClass, fillCrop } from './logic/layout';
	import { speedStep } from './logic/timeline';
	import Icons from './parts/Icons.svelte';
	import Ambient from './parts/Ambient.svelte';
	import Frame from './parts/Frame.svelte';
	import Scrims from './parts/Scrims.svelte';
	import GestureLayer from './parts/GestureLayer.svelte';
	import TopBar from './parts/TopBar.svelte';
	import TitleBlock from './parts/TitleBlock.svelte';
	import Transport from './parts/Transport.svelte';
	import Timeline from './parts/Timeline.svelte';
	import TimeRow from './parts/TimeRow.svelte';
	import ActionRow from './parts/ActionRow.svelte';
	import type DesktopBarPart from './parts/DesktopBar.svelte';
	import ResumeCapsule from './parts/ResumeCapsule.svelte';
	import Toasts from './parts/Toasts.svelte';
	import type * as LazyParts from './parts/lazy';
	import LiveRegion from './parts/LiveRegion.svelte';

	interface Props {
		launch: HqpLaunchPayload;
		startAt?: number | 'resume';
		onclose: () => void;
		onitemchange?: (item: HqpItem, index: number) => void;
		/** Injection for the dev harness; default createHqpEngine({ onItemChange }). */
		engine?: HqpEngine;
		/** Dev harness only: the initial UI state (spec 13.5). */
		demoUi?: HqpUiSeed;
	}

	const {
		launch,
		startAt = 'resume',
		onclose,
		onitemchange,
		engine: injected,
		demoUi
	}: Props = $props();

	const bridge = createBridge(untrack(() => launch));
	const { snapshot, clock, cues, prefs } = bridge;
	const ui = new HqpUi(untrack(() => demoUi));
	let engine = $state.raw<HqpEngine>(bridge.standIn);
	let root = $state<HTMLDivElement>();
	let video = $state<HTMLVideoElement>();

	setHqpContext({
		get engine() {
			return engine;
		},
		snapshot,
		clock,
		cues,
		prefs,
		ui,
		launch: untrack(() => launch),
		root: () => root ?? null,
		close: () => onclose(),
		setFrame
	});

	const item = $derived($snapshot.item);
	const title = $derived(item?.title ?? 'Player');
	const ar = $derived($snapshot.aspect && $snapshot.aspect > 0 ? $snapshot.aspect : 16 / 9);
	const isEpisode = $derived(item?.kind === 'episode');
	const hasNext = $derived($snapshot.index < $snapshot.queue.length - 1);
	const status = $derived($snapshot.status);
	const chromeOn = $derived(ui.chrome && !ui.locked && !ui.dragging && !ui.dismissing);
	const constrained = $derived(ui.overlay === 'sheet' || ui.overlay === 'episodes' || ui.info);
	// End card or "Still watching?": the card takes the place of the transport (and of the portrait
	// title block), so no control or glass sits under it.
	const cardShown = $derived(
		!$snapshot.error &&
			($snapshot.stillWatching || ($snapshot.status === 'ended' && !$snapshot.upNext))
	);
	const hideDelay = $derived(ui.large ? 2500 : $prefs.autoHideMs);

	// ---- Fit / Fill (section 5.5): FLIP on the frame, then the geometry swaps with no jump. ----
	let flipTimer: ReturnType<typeof setTimeout> | null = null;
	function setFrame(mode: FrameMode) {
		const current = $snapshot.frameMode;
		const remember = () => engine.updatePrefs({ frameModes: { [aspectClass(ar)]: mode } });
		if (mode === current) return;
		if (ui.portrait) {
			engine.setFrameMode(mode);
			remember();
			ui.toast(mode === 'fill' ? 'Fill applies in landscape' : 'Fit');
			return;
		}
		const { cropPercent } = fillCrop(ui.viewport, ar);
		ui.toast(mode === 'fill' ? `Fill · crops ${cropPercent}%` : 'Fit · the whole picture');
		if (flipTimer) clearTimeout(flipTimer);
		if (ui.reducedMotion) {
			engine.setFrameMode(mode);
			remember();
			return;
		}
		if (mode === 'fill') {
			ui.flip = 'to-fill';
			flipTimer = setTimeout(() => {
				ui.flip = 'settle';
				engine.setFrameMode('fill');
				remember();
				requestAnimationFrame(() => requestAnimationFrame(() => (ui.flip = null)));
			}, 300);
		} else {
			ui.flip = 'from-fill';
			engine.setFrameMode('fit');
			remember();
			requestAnimationFrame(() => requestAnimationFrame(() => (ui.flip = null)));
		}
	}

	// ---- Chrome visibility (section 6.5) ----
	const playingNow = $derived(status === 'playing');
	const bufferingNow = $derived(status === 'buffering');
	const overlayOpen = $derived(
		ui.overlay !== null ||
			$snapshot.upNext !== null ||
			$snapshot.error !== null ||
			$snapshot.stillWatching
	);
	const mustShow = $derived(
		status === 'paused' ||
			status === 'ended' ||
			status === 'error' ||
			status === 'starting' ||
			status === 'loading' ||
			status === 'idle'
	);

	$effect(() => {
		if (ui.mounted && mustShow && !ui.locked) ui.chrome = true;
	});

	$effect(() => {
		void ui.activity;
		if (!ui.chrome || ui.pinChrome) return;
		const delay = hideDelay;
		const hide = shouldHideChrome({
			playing: playingNow,
			buffering: bufferingNow,
			focusWithin: ui.focusWithin,
			overlayOpen,
			scrubbing: ui.scrub !== null || ui.hoverAt !== null,
			pointerOverControls: ui.pointerOverControls,
			idleMs: delay,
			delayMs: delay
		});
		if (!hide) return;
		const timer = setTimeout(() => (ui.chrome = false), delay);
		return () => clearTimeout(timer);
	});

	// 4 Hz clock only while something shows it moving; 1 Hz otherwise (section 10.2).
	$effect(() => {
		engine.setClockRate(ui.chrome || ui.info || ui.scrub !== null || ui.hoverAt !== null ? 4 : 1);
	});

	// Panels, cards and drawers load as one lazy chunk: at once when one is needed, otherwise in idle
	// time about 2 s after the first frame, when the settings sheet is also built ahead (parked).
	let parts = $state.raw<typeof LazyParts | null>(null);
	let partsLoading: Promise<void> | null = null;
	function loadParts(): Promise<void> {
		partsLoading ??= import('./parts/lazy').then(
			(module) => {
				parts = module;
			},
			() => {
				partsLoading = null;
			}
		);
		return partsLoading;
	}
	$effect(() => {
		if (
			ui.overlay !== null ||
			ui.info ||
			ui.large ||
			$snapshot.error !== null ||
			ui.scrub !== null ||
			ui.hoverAt !== null ||
			ui.locked ||
			$snapshot.held ||
			$snapshot.skipIntro !== null ||
			$snapshot.upNext !== null ||
			$snapshot.stillWatching ||
			status === 'ended'
		) {
			void loadParts();
		}
	});
	// The desktop bar only exists on large layouts: phones never download it.
	let DesktopBar = $state.raw<typeof DesktopBarPart | null>(null);
	let desktopLoading = false;
	$effect(() => {
		if (!ui.large || desktopLoading) return;
		desktopLoading = true;
		import('./parts/DesktopBar.svelte').then(
			(module) => (DesktopBar = module.default),
			() => (desktopLoading = false)
		);
	});
	let warming = false;
	let warmTimer: ReturnType<typeof setTimeout> | undefined;
	let warmIdle: number | undefined;
	$effect(() => {
		if (warming || status !== 'playing') return;
		warming = true;
		warmTimer = setTimeout(() => {
			const warm = () => {
				warmIdle = undefined;
				void loadParts().then(() => (ui.warmSheet = true));
			};
			if (typeof requestIdleCallback === 'function') {
				warmIdle = requestIdleCallback(warm, { timeout: 2000 });
			} else warm();
		}, 2000);
	});
	onDestroy(() => {
		clearTimeout(warmTimer);
		if (warmIdle !== undefined) cancelIdleCallback(warmIdle);
	});

	// One-time "Add to Home Screen" hint in iOS Safari tab mode (section 7.12), shown at the first
	// pause after playback has started: never over the opening seconds of the film.
	let hinted = false;
	let played = false;
	$effect(() => {
		if (status === 'playing') played = true;
		if (hinted || !played || !ui.iosTab || status !== 'paused' || $prefs.hints.homeScreen) return;
		hinted = true;
		ui.toast('Add to Home Screen for full screen', 4000, {
			label: 'How',
			run: () => ui.open('homescreen')
		});
		engine.updatePrefs({ hints: { homeScreen: true } });
	});

	// ---- Input ----
	let lastMove = 0;
	function onPointerDown() {
		engine.noteInteraction();
	}
	function onPointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse' || ui.locked) return;
		if (event.timeStamp - lastMove < 120) return;
		lastMove = event.timeStamp;
		if (!ui.chrome) ui.chrome = true;
		ui.poke();
		engine.noteInteraction();
	}
	function onPointerOver(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		const target = event.target as Element | null;
		ui.pointerOverControls = Boolean(
			target?.closest?.('button, a, [role="slider"], .hqp-panel, .hqp-info')
		);
	}
	function onFocusIn(event: FocusEvent) {
		const target = event.target as HTMLElement | null;
		const visible = Boolean(target && target !== root && target.matches(':focus-visible'));
		ui.focusWithin = visible;
		if (visible && !ui.chrome && !ui.locked) ui.showChrome();
	}
	function onFocusOut(event: FocusEvent) {
		if (!root?.contains(event.relatedTarget as Node | null)) ui.focusWithin = false;
	}

	function clampTime(seconds: number) {
		return Math.min(Math.max(0, seconds), $clock.duration || seconds);
	}

	function seekBy(delta: number) {
		const target = clampTime($clock.position + delta);
		engine.skip(delta);
		if (!ui.chrome) ui.flashSeek(delta < 0 ? 'back' : 'forward', delta, target);
		ui.announce(
			`${delta < 0 ? 'Back' : 'Forward'} ${Math.abs(delta)} seconds, ${formatTime(target)}`
		);
	}

	const SEEKS: HqpShortcutAction[] = ['back10', 'forward10', 'back5', 'forward5'];

	function runShortcut(action: HqpShortcutAction, percent?: number) {
		const s = $snapshot;
		const opener = document.activeElement;
		const hiddenSeek = SEEKS.includes(action) && !ui.chrome;
		switch (action) {
			case 'toggle':
				if (s.autoplayBlocked) void engine.play();
				else engine.toggle();
				break;
			case 'back10':
				seekBy(-10);
				break;
			case 'forward10':
				seekBy(10);
				break;
			case 'back5':
				seekBy(-5);
				break;
			case 'forward5':
				seekBy(5);
				break;
			case 'prevChapter':
				engine.seekChapter(-1);
				break;
			case 'nextChapter':
				engine.seekChapter(1);
				break;
			case 'volumeUp':
				engine.setVolume(Math.min(1, s.volume + 0.1));
				break;
			case 'volumeDown':
				engine.setVolume(Math.max(0, s.volume - 0.1));
				break;
			case 'mute':
				engine.setMuted(!s.muted);
				break;
			case 'fullscreen':
				if (ui.large && root) void engine.toggleFullscreen(root);
				break;
			case 'subtitles':
				engine.toggleSubtitles();
				break;
			case 'audioNext':
				void engine.cycleAudio();
				break;
			case 'tracks':
				ui.openSheet('tracks', opener);
				break;
			case 'info':
				ui.info = !ui.info;
				break;
			case 'episodes':
				if (isEpisode) ui.open('episodes', opener);
				break;
			case 'nextItem':
				if (hasNext) void engine.next();
				break;
			case 'pip':
				void engine.togglePip();
				break;
			case 'percent':
				engine.seek((($clock.duration || 0) * (percent ?? 0)) / 100);
				break;
			case 'home':
				engine.seek(0);
				break;
			case 'end':
				engine.seek(Math.max(0, $clock.duration - 1));
				break;
			case 'frameBack':
				if (s.status === 'paused') engine.stepFrame(-1);
				break;
			case 'frameForward':
				if (s.status === 'paused') engine.stepFrame(1);
				break;
			case 'slower':
				engine.setRate(speedStep(s.rate, -1));
				break;
			case 'faster':
				engine.setRate(speedStep(s.rate, 1));
				break;
			case 'help':
				ui.open('help', opener);
				break;
			case 'escape':
				escape();
				return;
		}
		if (!hiddenSeek) ui.showChrome();
	}

	function escape() {
		if (ui.overlay) {
			if (ui.overlay === 'sheet' && ui.sheetPage === 'style') ui.sheetPage = 'main';
			else ui.close();
			return;
		}
		if (ui.info) {
			ui.info = false;
			return;
		}
		if (ui.locked) {
			ui.setLocked(false);
			return;
		}
		if ($snapshot.fullscreen && root) {
			void engine.toggleFullscreen(root);
			return;
		}
		onclose();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || !ui.mounted) return;
		engine.noteInteraction();
		if (event.key === 'Escape') {
			event.preventDefault();
			escape();
			return;
		}
		if (ui.modal) return;
		if (!shouldHandleHqpShortcut(event)) return;
		const hit = matchHqpShortcut(event);
		if (!hit) return;
		if (ui.locked) {
			ui.showLockPill();
			return;
		}
		event.preventDefault();
		runShortcut(hit.action, hit.percent);
	}

	// ---- Mount: layout queries, engine, html overflow, focus ----
	onMount(() => {
		const html = document.documentElement;
		const previousOverflow = html.style.overflow;
		html.style.overflow = 'hidden';

		const mq = (query: string) => window.matchMedia(query);
		const queries = {
			portrait: mq('(orientation: portrait) and (max-width: 599px)'),
			portraitShort: mq('(orientation: portrait) and (max-width: 599px) and (max-height: 759px)'),
			landscape: mq('(orientation: landscape) and (max-height: 499px)'),
			landscapeShort: mq('(orientation: landscape) and (max-height: 379px)'),
			fine: mq('(hover: hover) and (pointer: fine)'),
			motion: mq('(prefers-reduced-motion: reduce)'),
			transparency: mq('(prefers-reduced-transparency: reduce)'),
			standalone: mq('(display-mode: standalone)')
		};
		const nav = navigator as Navigator & { standalone?: boolean };
		const ios =
			/iPhone|iPad|iPod/.test(nav.userAgent) ||
			(nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
		const sync = () => {
			ui.layout = queries.portraitShort.matches
				? 'phone-portrait-short'
				: queries.portrait.matches
					? 'phone-portrait'
					: queries.landscape.matches
						? 'phone-landscape'
						: 'large';
			ui.landscapeShort = queries.landscapeShort.matches;
			ui.finePointer = queries.fine.matches;
			ui.reducedMotion = queries.motion.matches;
			ui.reducedTransparency = queries.transparency.matches;
			ui.iosTab = ios && !queries.standalone.matches && nav.standalone !== true;
		};
		sync();
		const lists = Object.values(queries);
		for (const list of lists) list.addEventListener('change', sync);

		const observer = new ResizeObserver((entries) => {
			const box = entries[0]?.contentRect;
			if (box) ui.viewport = { width: box.width, height: box.height };
		});
		if (root) {
			observer.observe(root);
			ui.viewport = { width: root.clientWidth, height: root.clientHeight };
		}

		const live =
			injected ?? createHqpEngine({ onItemChange: (next, index) => onitemchange?.(next, index) });
		engine = live;
		const disconnect = bridge.connect(live);
		if (video) live.attach(video);
		void live.load(launch, { startAt });
		ui.mounted = true;
		root?.focus({ preventScroll: true });

		return () => {
			for (const list of lists) list.removeEventListener('change', sync);
			observer.disconnect();
			disconnect();
			if (flipTimer) clearTimeout(flipTimer);
			ui.dispose();
			void live.destroy();
			html.style.overflow = previousOverflow;
		};
	});

	const cover = $derived(
		fillCrop(ui.viewport.width ? ui.viewport : { width: 16, height: 9 }, ar).scale
	);
</script>

<svelte:window onkeydown={onKeydown} />

<div
	bind:this={root}
	class="hqp"
	role="region"
	aria-label="Alan's HQP: {title}"
	tabindex="-1"
	data-layout={ui.layout}
	data-chrome={chromeOn ? 'on' : 'off'}
	data-hdr={$snapshot.hdrShown ? 'on' : undefined}
	data-lite-glass={$prefs.liteGlass ? '' : undefined}
	data-overlay={ui.overlay ?? undefined}
	data-info={ui.info ? '' : undefined}
	data-scrub={ui.scrub ? '' : undefined}
	data-upnext={$snapshot.upNext ? '' : undefined}
	data-card={cardShown ? '' : undefined}
	data-status={status}
	data-locked={ui.locked ? '' : undefined}
	data-dragging={ui.dragging ? '' : undefined}
	data-dismissing={ui.dismissing ? '' : undefined}
	data-constrained={constrained ? '' : undefined}
	data-cursor={ui.large && !chromeOn && ui.mounted ? 'hidden' : undefined}
	data-mounted={ui.mounted ? '' : undefined}
	data-arming={ui.arming ? '' : undefined}
	style:--ar={ar}
	style:--cover={cover}
	onpointerdowncapture={onPointerDown}
	onpointermove={onPointerMove}
	onpointerover={onPointerOver}
	onfocusin={onFocusIn}
	onfocusout={onFocusOut}
>
	<Icons />
	{#if parts}<parts.IconsMore />{/if}
	<div class="hqp-stage">
		<Ambient />
		<Frame bind:video />
	</div>

	{#if ui.mounted}
		<Scrims />
		<GestureLayer />

		<div class="hqp-chrome">
			<TopBar />
			{#if ui.portrait}
				<TitleBlock variant="portrait" />
			{/if}
			<Transport />
			<div class="hqp-bottom hqp-fade hqp-x-error" data-from="bottom">
				{#if ui.portrait}
					<Timeline />
					<TimeRow />
					<ActionRow />
				{:else if ui.large}
					<Timeline withTimes />
					{#if DesktopBar}<DesktopBar />{/if}
				{:else}
					<Timeline withTimes />
					<ActionRow />
				{/if}
			</div>
		</div>

		{#if parts}<parts.ScrubPreview />{/if}
		{#if !ui.portrait}
			<ResumeCapsule />
		{/if}
		{#if parts}
			<parts.SkipIntro />
			<parts.HoldPill />
		{/if}
		<Toasts />
		{#if parts}
			<parts.InfoPanel />
			<parts.UpNext />
			<parts.StillWatching />
			<parts.EndCard />
			<parts.Sheet />
			<parts.EpisodesDrawer />
			<parts.HomeScreenHint />
			<parts.ShortcutHelp />
			<parts.LockOverlay />
			<parts.ErrorCard />
		{/if}
	{/if}
	<LiveRegion />
</div>

<style>
	.hqp {
		/* Picture geometry (section 5): Fit centred; portrait at 35% (36% when short), never above 118 px. */
		--ar: 1.7778;
		--frame-w: min(100cqw, 100cqh * var(--ar));
		--frame-h: min(100cqh, 100cqw / var(--ar));
		--frame-top: calc(50cqh - var(--frame-h) / 2);
		--frame-bottom: calc(var(--frame-top) + var(--frame-h));
		position: fixed;
		inset: 0;
		z-index: 60;
		background: var(--hqp-black);
		isolation: isolate;
		container-type: size;
		container-name: hqp;
		overflow: hidden;
		overscroll-behavior: none;
		color: var(--hqp-ink);
		font-family: var(--hqp-font);
		font-size: 15px;
		line-height: 20px;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		outline: none;
	}
	@media (orientation: portrait) and (max-width: 599px) {
		.hqp {
			--frame-top: clamp(118px, 35cqh - var(--frame-h) / 2, 100cqh - var(--frame-h));
		}
	}
	@media (orientation: portrait) and (max-width: 599px) and (max-height: 759px) {
		.hqp {
			--frame-top: clamp(0px, 36cqh - var(--frame-h) / 2, 100cqh - var(--frame-h));
		}
	}
	.hqp[data-cursor='hidden'] {
		cursor: none;
	}

	.hqp-stage {
		position: absolute;
		inset: 0;
		z-index: var(--hqp-z-frame);
		translate: 0 calc(var(--dy, 0) * 0.6px);
		scale: calc(1 - var(--dy, 0) / 2000);
		transform-origin: 50% 0;
		transition:
			translate var(--hqp-dur-panel) var(--hqp-spring),
			scale var(--hqp-dur-panel) var(--hqp-spring);
	}
	.hqp[data-dragging] .hqp-stage {
		transition: none;
		will-change: translate, scale;
	}
	.hqp[data-dismissing] .hqp-stage {
		translate: 0 100cqh;
		transition: translate 220ms var(--hqp-ease-in);
	}

	.hqp-chrome {
		position: absolute;
		inset: 0;
		z-index: var(--hqp-z-chrome);
		pointer-events: none;
	}
	/* Only controls take pointers: the gaps between them stay part of the picture's gesture layer. */
	.hqp-chrome :global(*) {
		pointer-events: none;
	}
	.hqp-chrome :global(:is(button, a, [role='slider'])) {
		pointer-events: auto;
	}
	/* Chrome revealed by a tap ignores pointers for the double-tap window (300 ms), so the second
	   tap of a double tap never lands on a control that just appeared under the finger. */
	.hqp[data-arming] .hqp-chrome :global(:is(button, a, [role='slider'])) {
		pointer-events: none;
	}

	.hqp-bottom {
		position: absolute;
		left: var(--hqp-edge-x);
		right: var(--hqp-edge-x);
		bottom: var(--hqp-edge-bottom);
		display: grid;
		gap: 6px;
	}
	.hqp[data-layout='phone-portrait'] .hqp-bottom,
	.hqp[data-layout='phone-portrait-short'] .hqp-bottom {
		gap: 0;
	}
	.hqp[data-layout='large'] .hqp-bottom {
		bottom: 24px;
		gap: 8px;
	}
	.hqp[data-layout='phone-landscape'][data-upnext] .hqp-bottom,
	.hqp[data-layout='large'][data-upnext] .hqp-bottom {
		opacity: 0;
		visibility: hidden;
	}

	/* ---------- Shared HQP primitives (used by every part) ---------- */
	:global(:where(.hqp) button) {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		margin: 0;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}
	:global(:where(.hqp) button:disabled) {
		cursor: default;
	}
	.hqp :global(:focus-visible) {
		outline: 2px solid var(--hqp-accent);
		outline-offset: 3px;
	}
	.hqp :global(.hqp-sr) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global(:where(.hqp) .hqp-tnum) {
		font-variant-numeric: tabular-nums;
		font-feature-settings: 'tnum';
	}
	:global(:where(.hqp) .hqp-eyebrow) {
		font-size: 12px;
		line-height: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hqp-ink-2);
	}

	/* 44 px round button and capsules (section 9.7) */
	:global(:where(.hqp) .hqp-btn) {
		position: relative;
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: var(--hqp-r-capsule);
		transition:
			scale var(--hqp-dur-press) var(--hqp-ease-out),
			background-color var(--hqp-dur-press) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-btn:active:not(:disabled)) {
		scale: 0.92;
	}
	:global(:where(.hqp) .hqp-cap) {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 44px;
		height: 44px;
		padding: 0 16px 0 13px;
		border-radius: var(--hqp-r-capsule);
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
		letter-spacing: -0.005em;
		white-space: nowrap;
		transition: scale var(--hqp-dur-press) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-cap:active:not(:disabled)) {
		scale: 0.95;
	}
	:global(:where(.hqp) .hqp-group) {
		display: inline-flex;
		align-items: center;
		border-radius: var(--hqp-r-capsule);
	}
	:global(:where(.hqp) .hqp-group > .hqp-sep) {
		flex: none;
		width: var(--hqp-hairline);
		height: 20px;
		background: var(--hqp-glass-rim);
	}

	/* Chrome show / hide (section 10.1): opacity + 6 px, then visibility so no glass stays composited. */
	.hqp :global(.hqp-fade) {
		transition:
			opacity var(--hqp-dur-in) var(--hqp-ease-out),
			translate var(--hqp-dur-in) var(--hqp-ease-out),
			visibility 0s;
	}
	.hqp[data-chrome='off'] :global(.hqp-fade),
	.hqp[data-overlay] :global(.hqp-fade) {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity var(--hqp-dur-out) var(--hqp-ease-in),
			translate var(--hqp-dur-out) var(--hqp-ease-in),
			visibility 0s var(--hqp-dur-out);
	}
	.hqp[data-chrome='off'] :global(.hqp-fade[data-from='top']) {
		translate: 0 -6px;
	}
	.hqp[data-chrome='off'] :global(.hqp-fade[data-from='bottom']) {
		translate: 0 6px;
	}
	/* State-driven exits (scrub, up next, info, error) */
	.hqp[data-scrub] :global(.hqp-x-scrub),
	.hqp[data-upnext] :global(.hqp-x-upnext),
	.hqp[data-card] :global(.hqp-x-card),
	.hqp[data-info] :global(.hqp-x-info),
	.hqp[data-status='error'] :global(.hqp-x-error) {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity var(--hqp-dur-in) var(--hqp-ease-out),
			visibility 0s var(--hqp-dur-in);
	}

	/* Tags and badges: 10.5/12, 700 (section 9.5) */
	:global(:where(.hqp) .hqp-tag) {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 6px;
		border-radius: var(--hqp-r-tag);
		font-size: 10.5px;
		line-height: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hqp-ink-2);
		background: var(--hqp-fill-row);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
		white-space: nowrap;
	}
	:global(:where(.hqp) .hqp-tag[data-tone='accent']) {
		color: var(--hqp-accent);
		background: var(--hqp-accent-soft);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-accent-rim);
	}
	:global(:where(.hqp) .hqp-tag[data-tone='warn']) {
		color: var(--hqp-warn);
		background: var(--hqp-warn-soft);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-warn);
	}

	/* White cinema CTA (48 tall) and its glass secondary */
	:global(:where(.hqp) .hqp-cta) {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 48px;
		padding: 0 20px;
		border-radius: var(--hqp-r-capsule);
		font-size: 16px;
		line-height: 20px;
		font-weight: 700;
		white-space: nowrap;
		background: var(--hqp-cta);
		color: var(--hqp-ink-on-light);
		text-decoration: none;
		transition: scale var(--hqp-dur-press) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-cta:active) {
		scale: 0.96;
	}
	:global(:where(.hqp) .hqp-cta[data-variant='secondary']) {
		background: var(--hqp-fill-selected);
		color: var(--hqp-ink);
		box-shadow:
			inset 0 var(--hqp-hairline) 0 var(--hqp-glass-spec),
			inset 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
	}

	/* Rows inside thick panels: flat fills, never glass on glass (section 9.3) */
	:global(:where(.hqp) .hqp-row) {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 6px 12px;
		border-radius: var(--hqp-r-tile);
		text-align: left;
		transition: background-color var(--hqp-dur-press) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-row:active:not(:disabled)) {
		background: var(--hqp-fill-press);
	}
	:global(:where(.hqp) .hqp-row[aria-checked='true']) {
		background: var(--hqp-fill-row);
	}
	:global(:where(.hqp) .hqp-row:disabled),
	:global(:where(.hqp) .hqp-row[aria-disabled='true']) {
		opacity: 0.5;
	}
	:global(:where(.hqp) .hqp-row-check) {
		color: var(--hqp-accent);
		opacity: 0;
	}
	:global(:where(.hqp) .hqp-row[aria-checked='true'] .hqp-row-check) {
		opacity: 1;
	}
	:global(:where(.hqp) .hqp-row-label) {
		display: block;
		font-size: 16px;
		line-height: 20px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(:where(.hqp) .hqp-row-detail) {
		display: block;
		margin-top: 1px;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(:where(.hqp) .hqp-row-tags) {
		display: inline-flex;
		gap: 4px;
	}

	/* Segmented control (tabs, sizes, speeds) */
	:global(:where(.hqp) .hqp-seg) {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--hqp-r-capsule);
		background: var(--hqp-fill-row);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-fill-row);
	}
	:global(:where(.hqp) .hqp-seg > button) {
		position: relative;
		flex: 1 1 0;
		min-width: 44px;
		height: 44px;
		padding: 0 8px;
		border-radius: var(--hqp-r-capsule);
		font-size: 14px;
		line-height: 18px;
		font-weight: 600;
		color: var(--hqp-ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			background-color var(--hqp-dur-in) var(--hqp-ease-out),
			color var(--hqp-dur-in) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-seg > button[aria-selected='true']),
	:global(:where(.hqp) .hqp-seg > button[aria-checked='true']) {
		color: var(--hqp-ink);
		background: var(--hqp-fill-press);
		box-shadow: inset 0 var(--hqp-hairline) 0 var(--hqp-glass-spec);
	}

	/* Switch: knob on the spring, track colour 180 ms */
	:global(:where(.hqp) .hqp-switch) {
		position: relative;
		flex: none;
		width: 51px;
		height: 31px;
		border-radius: var(--hqp-r-capsule);
		background: var(--hqp-track);
		transition: background-color var(--hqp-dur-in) var(--hqp-ease-out);
	}
	:global(:where(.hqp) .hqp-switch::after) {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: var(--hqp-ink);
		box-shadow: var(--hqp-thumb-shadow);
		transition: translate var(--hqp-dur-panel) var(--hqp-spring);
	}
	:global(:where(.hqp) [aria-checked='true'] > .hqp-switch) {
		background: var(--hqp-accent);
	}
	:global(:where(.hqp) [aria-checked='true'] > .hqp-switch::after) {
		translate: 20px 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.hqp-stage {
			transition: none;
		}
		.hqp[data-dismissing] .hqp-stage {
			translate: none;
			opacity: 0;
			transition: opacity 120ms linear;
		}
		.hqp :global(.hqp-fade),
		.hqp[data-chrome='off'] :global(.hqp-fade) {
			translate: none !important;
		}
		.hqp :global(.hqp-switch::after) {
			transition: none;
		}
	}
</style>
