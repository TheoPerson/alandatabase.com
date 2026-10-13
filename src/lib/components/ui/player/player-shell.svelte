<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import Dialog from '../dialog/dialog.svelte';
	import Button from '../button/button.svelte';
	import Slider from '../slider/slider.svelte';
	import PlayerSettings from './player-settings.svelte';
	import ShortcutHelp from './shortcut-help.svelte';
	import { createYouTubeSource } from '$lib/player/youtube-source';
	import { createController, type PlayerController } from '$lib/player/controller';
	import { loadPrefs, savePrefs, type PlayerPrefs, DEFAULT_PREFS } from '$lib/player/prefs';
	import { pruneResume, readResume } from '$lib/player/resume';
	import { formatTime, spokenTime } from '$lib/player/format-time';
	import { shouldHideControls } from '$lib/player/auto-hide';
	import { matchShortcut, shouldHandleShortcut } from '$lib/player/shortcuts';
	import type { Capabilities, PlayerSnapshot } from '$lib/player/types';
	import { youtubeThumbnail } from '$lib/tmdb/images';
	import XIcon from 'lucide-svelte/icons/x';
	import PlayIcon from 'lucide-svelte/icons/play';
	import PauseIcon from 'lucide-svelte/icons/pause';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import RotateCwIcon from 'lucide-svelte/icons/rotate-cw';
	import Volume2Icon from 'lucide-svelte/icons/volume-2';
	import VolumeXIcon from 'lucide-svelte/icons/volume-x';
	import CaptionsIcon from 'lucide-svelte/icons/captions';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import MaximizeIcon from 'lucide-svelte/icons/maximize';
	import MinimizeIcon from 'lucide-svelte/icons/minimize';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';

	interface Props {
		open: boolean;
		title: string;
		videoKey: string;
		onclose?: () => void;
	}

	let { open = $bindable(false), title, videoKey, onclose }: Props = $props();

	const IDLE: PlayerSnapshot = {
		status: 'idle',
		position: 0,
		duration: 0,
		buffered: 0,
		rate: 1,
		volume: 1,
		muted: false,
		captions: false
	};
	const EMPTY_CAPABILITIES: Capabilities = {
		fullscreen: false,
		pip: false,
		captions: true,
		rates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
		boost: false,
		qualities: ['Auto']
	};
	const PERSIST_EVERY_MS = 5000;
	const PILL_RESET_MS = 1500;
	const TICK_MS = 250;
	// After a seek the source reports the old position for a moment; keep the committed value meanwhile.
	const SEEK_HOLD_MS = 1000;

	let root = $state<HTMLElement | null>(null);
	let stage = $state<HTMLElement | null>(null);
	let apron = $state<HTMLElement | null>(null);
	let controller = $state<PlayerController | null>(null);
	let snapshot = $state<PlayerSnapshot>({ ...IDLE });
	let capabilities = $state<Capabilities>(EMPTY_CAPABILITIES);
	let prefs = $state<PlayerPrefs>({ ...DEFAULT_PREFS });
	let seekValue = $state(0);
	let scrubbing = $state(false);
	let seekHoldUntil = 0;
	let volumeValue = $state(100);
	let settingsOpen = $state(false);
	let helpOpen = $state(false);
	let fullscreen = $state(false);
	let fullscreenAvailable = $state(false);
	let wide = $state(false);
	let touch = $state(false);
	let focusWithin = $state(false);
	let idleMs = $state(0);
	let pillSeconds = $state(0);
	let pushed = $state(false);
	let autoplayBlocked = $state(false);
	let resumedAt = $state<number | null>(null);
	let statusText = $state('');
	let errorText = $state<string | null>(null);

	const thumbnail = $derived(youtubeThumbnail(videoKey));
	const watchHref = $derived(`https://www.youtube.com/watch?v=${videoKey}`);
	const playing = $derived(snapshot.status === 'playing');
	const loading = $derived(snapshot.status === 'idle' || snapshot.status === 'loading');
	const controlsHidden = $derived(
		shouldHideControls({
			fullscreen,
			playing,
			buffering: snapshot.status === 'buffering',
			focusWithin,
			sheetOpen: settingsOpen || helpOpen,
			pillVisible: pillSeconds !== 0,
			touch,
			idleMs,
			delayMs: prefs.autoHideMs
		})
	);

	function announce(text: string) {
		statusText = text;
	}

	function wake() {
		idleMs = 0;
	}

	function close() {
		if (!open) return;
		open = false;
	}

	// Opening: history entry, preferences, resume point, the source and its controller.
	// Only open and videoKey are tracked; the body reads and writes state that must not re-run it.
	$effect(() => {
		if (!open || !videoKey) return;
		const key = videoKey;
		return untrack(() => start(key));
	});

	function start(videoKey: string): () => void {
		let storage: Storage | null = null;
		try {
			storage = localStorage;
		} catch {
			storage = null;
		}
		prefs = loadPrefs(storage);
		pruneResume(storage, Date.now());
		const resume = readResume(storage, videoKey, Date.now());
		const startAt = resume && prefs.resume ? resume.position : 0;
		resumedAt = startAt > 0 ? startAt : null;
		snapshot = { ...IDLE, status: 'loading' };
		errorText = null;
		autoplayBlocked = false;
		settingsOpen = false;
		helpOpen = false;
		idleMs = 0;
		pillSeconds = 0;
		statusText = '';
		volumeValue = Math.round((prefs.muted ? 0 : prefs.volume) * 100);

		pushState('', { ...page.state, player: { key: videoKey } });
		pushed = true;

		const source = createYouTubeSource(videoKey);
		const current = createController(source, videoKey, prefs, storage, Date.now);
		controller = current;
		capabilities = source.capabilities();

		const offs = [
			source.on('state', (next) => {
				const wasStatus = snapshot.status;
				snapshot = next;
				if (!scrubbing && Date.now() > seekHoldUntil) seekValue = next.position;
				if (next.status === 'playing' && wasStatus !== 'playing') {
					announce(resumedAt !== null ? `Resumed at ${formatTime(resumedAt)}` : 'Playing');
					resumedAt = null;
					autoplayBlocked = false;
				} else if (next.status === 'paused' && wasStatus !== 'paused') {
					announce('Paused');
					current.persistPosition();
				} else if (next.status === 'ended') {
					announce('Finished');
					current.persistPosition();
				}
			}),
			source.on('time', (next) => {
				snapshot = next;
				if (!scrubbing && Date.now() > seekHoldUntil) seekValue = next.position;
			}),
			source.on('error', (next) => {
				snapshot = next;
				errorText = next.error ?? 'Playback failed';
			}),
			source.on('autoplayblocked', () => {
				autoplayBlocked = true;
				announce('Ready to play');
			})
		];

		let disposed = false;
		(async () => {
			// Let the dialog paint before the third-party API is fetched.
			await new Promise((resolve) => setTimeout(resolve, 0));
			if (disposed || !stage) return;
			try {
				await source.load(stage, { autoplay: true, startAt, captions: prefs.captions });
				if (disposed) return;
				current.applyPrefs(prefs);
				capabilities = source.capabilities();
			} catch (error) {
				if (!disposed) errorText = (error as Error).message || 'Playback failed';
			}
		})();

		const persist = () => current.persistPosition();
		const persistTimer = window.setInterval(() => {
			if (source.getState().status === 'playing') persist();
		}, PERSIST_EVERY_MS);
		const idleTimer = window.setInterval(() => {
			if (source.getState().status === 'playing') idleMs += TICK_MS;
		}, TICK_MS);
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') persist();
		};
		const onFullscreen = () => {
			fullscreen = document.fullscreenElement === root;
			wake();
		};
		const onWindowBlur = () => {
			// The embed swallows focus; bring it back so shortcuts keep working.
			setTimeout(() => {
				if (document.activeElement?.tagName === 'IFRAME') stage?.focus();
			}, 0);
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', persist);
		document.addEventListener('fullscreenchange', onFullscreen);
		window.addEventListener('blur', onWindowBlur);

		return () => {
			disposed = true;
			persist();
			for (const off of offs) off();
			window.clearInterval(persistTimer);
			window.clearInterval(idleTimer);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', persist);
			document.removeEventListener('fullscreenchange', onFullscreen);
			window.removeEventListener('blur', onWindowBlur);
			if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
			current.dispose();
			controller = null;
			snapshot = { ...IDLE };
			fullscreen = false;
			if (pushed) {
				pushed = false;
				if (page.state.player) history.back();
			}
			onclose?.();
		};
	}

	// Back (or a swipe back) removes the player state: close without a second history step.
	$effect(() => {
		if (open && pushed && !page.state.player) {
			pushed = false;
			close();
		}
	});

	$effect(() => {
		fullscreenAvailable = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
		const wideMedia = window.matchMedia('(min-width: 768px)');
		const touchMedia = window.matchMedia('(hover: none)');
		const apply = () => {
			wide = wideMedia.matches;
			touch = touchMedia.matches;
		};
		apply();
		wideMedia.addEventListener('change', apply);
		touchMedia.addEventListener('change', apply);
		return () => {
			wideMedia.removeEventListener('change', apply);
			touchMedia.removeEventListener('change', apply);
		};
	});

	function onPrefsChange(next: PlayerPrefs) {
		prefs = next;
		try {
			savePrefs(localStorage, next);
		} catch {
			// Session-only preferences.
		}
		controller?.applyPrefs(next);
		volumeValue = Math.round((next.muted ? 0 : next.volume) * 100);
	}

	function togglePlay() {
		wake();
		controller?.toggle();
	}

	function skip(seconds: number) {
		wake();
		controller?.skip(seconds);
		pillSeconds += seconds;
		window.setTimeout(() => (pillSeconds = 0), PILL_RESET_MS);
	}

	function commitSeek(seconds: number) {
		scrubbing = false;
		seekHoldUntil = Date.now() + SEEK_HOLD_MS;
		seekValue = seconds;
		controller?.seek(seconds);
		announce(`Moved to ${spokenTime(seconds)}`);
	}

	function toggleMute() {
		wake();
		if (!controller) return;
		const muted = !snapshot.muted;
		onPrefsChange({ ...prefs, muted });
		announce(muted ? 'Muted' : 'Sound on');
	}

	function setVolume(percent: number) {
		const level = Math.min(1, Math.max(0, percent / 100));
		onPrefsChange({ ...prefs, volume: level, muted: level === 0 });
	}

	function toggleCaptions() {
		wake();
		const captions = !prefs.captions;
		onPrefsChange({ ...prefs, captions });
		announce(captions ? 'Captions on' : 'Captions off');
	}

	function cycleSpeed() {
		wake();
		if (!controller) return;
		const rates = capabilities.rates.length ? capabilities.rates : EMPTY_CAPABILITIES.rates;
		const index = rates.indexOf(prefs.speed);
		const next = rates[(index + 1) % rates.length] ?? 1;
		onPrefsChange({ ...prefs, speed: next });
		announce(`Speed ${next}×`);
	}

	function stepSpeed(direction: 1 | -1) {
		if (!controller) return;
		controller.stepRate(direction);
		const speed = controller.state.rate;
		onPrefsChange({ ...prefs, speed });
		announce(`Speed ${speed}×`);
	}

	async function toggleFullscreen() {
		wake();
		if (!root || !fullscreenAvailable) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await root.requestFullscreen();
		} catch {
			// Denied or unsupported: the stage stays as it is.
		}
	}

	function onKeydown(event: KeyboardEvent) {
		wake();
		if (settingsOpen || helpOpen) return;
		if (!shouldHandleShortcut(event, prefs)) return;
		const action = matchShortcut(event);
		if (!action) return;
		event.preventDefault();
		switch (action) {
			case 'toggle':
				togglePlay();
				break;
			case 'back10':
				skip(-10);
				break;
			case 'forward10':
				skip(10);
				break;
			case 'back5':
				skip(-5);
				break;
			case 'forward5':
				skip(5);
				break;
			case 'volumeUp':
				setVolume(volumeValue + 5);
				break;
			case 'volumeDown':
				setVolume(volumeValue - 5);
				break;
			case 'mute':
				toggleMute();
				break;
			case 'fullscreen':
				void toggleFullscreen();
				break;
			case 'captions':
				toggleCaptions();
				break;
			case 'slower':
				stepSpeed(-1);
				break;
			case 'faster':
				stepSpeed(1);
				break;
			case 'help':
				helpOpen = true;
				break;
		}
	}

	function onApronFocus() {
		focusWithin = true;
		wake();
	}

	function onApronBlur(event: FocusEvent) {
		focusWithin = Boolean(apron?.contains(event.relatedTarget as Node | null));
	}
</script>

<Dialog bind:open label={`Trailer: ${title}`} variant="fullscreen" class="player-dialog">
	<div
		class="player"
		class:hidden-controls={controlsHidden}
		class:settings-aside={settingsOpen && wide}
		data-oled={prefs.oled ? '' : undefined}
		bind:this={root}
		role="presentation"
		onkeydown={onKeydown}
		onpointermove={wake}
		onpointerdown={wake}
	>
		<header class="strip">
			<Button size="icon" variant="ghost" class="close" aria-label="Close player" onclick={close}>
				<XIcon size={22} aria-hidden="true" />
			</Button>
			<div class="strip-text">
				<p class="eyebrow">Trailer</p>
				<p class="strip-title">{title}</p>
			</div>
		</header>

		<div class="stage-wrap">
			<div class="stage" bind:this={stage} tabindex="-1" aria-label="Video">
				{#if thumbnail}
					<img class="poster" class:gone={!loading} src={thumbnail} alt="" aria-hidden="true" />
				{/if}
				{#if snapshot.status === 'loading'}
					<span class="spinner" aria-hidden="true"></span>
				{/if}
			</div>
			{#if errorText}
				<div class="unavailable" role="alert">
					<p class="unavailable-title">This trailer cannot play here.</p>
					<p class="unavailable-text">{errorText}</p>
					<Button href={watchHref} variant="secondary" target="_blank" rel="noopener">
						Watch on YouTube <ExternalLinkIcon size={16} aria-hidden="true" />
					</Button>
				</div>
			{/if}
		</div>

		<div
			class="apron"
			bind:this={apron}
			onfocusin={onApronFocus}
			onfocusout={onApronBlur}
			inert={controlsHidden ? true : undefined}
		>
			<div class="seek-row">
				<Slider
					bind:value={seekValue}
					min={0}
					max={snapshot.duration > 0 ? snapshot.duration : 1}
					step={1}
					label="Seek"
					valueText={spokenTime}
					buffered={snapshot.buffered}
					disabled={snapshot.duration <= 0}
					onchange={() => (scrubbing = true)}
					onCommit={commitSeek}
					class="seek"
				/>
				<span class="clock" role="timer" aria-live="off">
					{formatTime(snapshot.position)} / {formatTime(snapshot.duration)}
				</span>
			</div>
			<div class="buttons">
				<Button
					size="icon"
					variant="ghost"
					class="control primary-control"
					aria-label={playing ? 'Pause' : 'Play'}
					onclick={togglePlay}
					disabled={loading && !autoplayBlocked}
				>
					{#if playing}<PauseIcon size={22} aria-hidden="true" />{:else}<PlayIcon
							size={22}
							aria-hidden="true"
						/>{/if}
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="control"
					aria-label="Back 10 seconds"
					onclick={() => skip(-10)}
				>
					<RotateCcwIcon size={20} aria-hidden="true" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="control"
					aria-label="Forward 10 seconds"
					onclick={() => skip(10)}
				>
					<RotateCwIcon size={20} aria-hidden="true" />
				</Button>
				{#if pillSeconds !== 0}
					<span class="pill" aria-hidden="true"
						>{pillSeconds > 0 ? '+' : '−'}{Math.abs(pillSeconds)} s</span
					>
				{/if}
				<span class="spacer"></span>
				<div class="volume">
					<Button
						size="icon"
						variant="ghost"
						class="control"
						aria-label={snapshot.muted ? 'Unmute' : 'Mute'}
						aria-pressed={snapshot.muted}
						onclick={toggleMute}
					>
						{#if snapshot.muted || volumeValue === 0}<VolumeXIcon
								size={20}
								aria-hidden="true"
							/>{:else}<Volume2Icon size={20} aria-hidden="true" />{/if}
					</Button>
					<div class="volume-slider">
						<Slider
							bind:value={volumeValue}
							min={0}
							max={100}
							step={5}
							label="Volume"
							valueText={(v) => `${v}%`}
							onCommit={setVolume}
						/>
					</div>
				</div>
				<Button
					size="icon"
					variant="ghost"
					class="control wide-only"
					aria-label="Captions"
					aria-pressed={prefs.captions}
					onclick={toggleCaptions}
				>
					<CaptionsIcon size={20} aria-hidden="true" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="control speed wide-only"
					aria-label={`Speed ${prefs.speed}×`}
					onclick={cycleSpeed}
				>
					{prefs.speed}×
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="control"
					aria-label="Settings"
					aria-haspopup="dialog"
					aria-expanded={settingsOpen}
					onclick={() => {
						wake();
						settingsOpen = !settingsOpen;
					}}
				>
					<SettingsIcon size={20} aria-hidden="true" />
				</Button>
				{#if fullscreenAvailable}
					<Button
						size="icon"
						variant="ghost"
						class="control"
						aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
						onclick={toggleFullscreen}
					>
						{#if fullscreen}<MinimizeIcon size={20} aria-hidden="true" />{:else}<MaximizeIcon
								size={20}
								aria-hidden="true"
							/>{/if}
					</Button>
				{/if}
			</div>
		</div>

		<p class="sr-only" role="status" aria-live="polite">{statusText}</p>
	</div>

	<PlayerSettings
		bind:open={settingsOpen}
		{prefs}
		{capabilities}
		{videoKey}
		side={wide ? 'right' : 'bottom'}
		onchange={onPrefsChange}
	/>
	<ShortcutHelp bind:open={helpOpen} />
</Dialog>

<style>
	.player {
		--strip: calc(3.5rem + var(--safe-top));
		--apron: calc(4.5rem + var(--safe-bottom));
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #000;
		color: var(--content-primary);
		outline: none;
	}
	.strip {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--strip);
		padding: var(--safe-top) var(--space-3) 0;
		transition: opacity var(--duration-base) var(--ease-out);
	}
	.strip-text {
		min-width: 0;
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.strip-title {
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stage-wrap {
		position: relative;
		display: grid;
		flex: 1;
		min-height: 0;
		/* Phones: the stage sits under the strip so a bottom sheet never covers it. */
		place-items: start center;
	}
	/* The desktop settings panel takes its column; the stage re-fits once, no animation. */
	.settings-aside {
		padding-right: clamp(320px, 36vw, 440px);
	}
	.stage {
		position: relative;
		width: min(100%, calc((100dvh - var(--strip) - var(--apron)) * 16 / 9));
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: #000;
		outline: none;
	}
	.stage :global(iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.poster {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 1;
		transition: opacity var(--duration-base) var(--ease-out);
		pointer-events: none;
	}
	.poster.gone {
		opacity: 0;
	}
	.spinner {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 2;
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid rgba(255, 255, 255, 0.25);
		border-top-color: var(--content-primary);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		animation: player-spin 0.9s linear infinite;
		animation-delay: 2s;
		opacity: 0;
		animation-fill-mode: forwards;
	}
	@keyframes player-spin {
		from {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(0deg);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}
	.unavailable {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-content: center;
		gap: var(--space-3);
		padding: var(--space-5);
		background: rgba(0, 0, 0, 0.85);
		text-align: center;
	}
	.unavailable-title {
		font-size: var(--type-title);
		font-weight: 800;
	}
	.unavailable-text {
		color: var(--content-tertiary);
		font-size: var(--text-sm);
	}
	.apron {
		display: grid;
		gap: 0.25rem;
		min-height: var(--apron);
		padding: 0.25rem var(--space-3) var(--safe-bottom);
		transition: opacity var(--duration-base) var(--ease-out);
	}
	.seek-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.seek-row :global(.seek) {
		flex: 1;
	}
	.clock {
		flex: 0 0 auto;
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.buttons {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.spacer {
		flex: 1;
	}
	.buttons :global(.control) {
		color: var(--content-primary);
	}
	.buttons :global(.speed) {
		min-width: 3rem;
		font-variant-numeric: tabular-nums;
	}
	.pill {
		position: absolute;
		left: 50%;
		top: -2.25rem;
		padding: 0.2rem 0.6rem;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.12);
		color: var(--content-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		transform: translateX(-50%);
		animation: player-pill var(--duration-fast) var(--ease-spring) both;
	}
	@keyframes player-pill {
		from {
			opacity: 0;
			transform: translateX(-50%) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) scale(1);
		}
	}
	.volume {
		display: flex;
		align-items: center;
	}
	.volume-slider {
		display: none;
		width: 6rem;
	}
	.buttons :global(.wide-only) {
		display: none;
	}
	@media (hover: hover) and (min-width: 560px) {
		.volume-slider {
			display: block;
		}
	}
	@media (min-width: 560px) {
		.buttons :global(.wide-only) {
			display: inline-flex;
		}
	}
	@media (min-width: 768px) {
		.stage-wrap {
			place-items: center;
		}
	}
	/* Hidden controls: timer-driven, never over the stage. */
	.hidden-controls .strip,
	.hidden-controls .apron {
		opacity: 0;
		visibility: hidden;
	}
	.player:fullscreen .stage {
		width: min(100vw, calc((100vh - var(--strip) - var(--apron)) * 16 / 9));
	}
	.player:fullscreen.hidden-controls .stage {
		width: min(100vw, calc(100vh * 16 / 9));
	}
	.player[data-oled] .buttons :global(.control),
	.player[data-oled] .clock,
	.player[data-oled] .strip-text {
		opacity: 0.8;
	}
	@media (prefers-reduced-motion: reduce) {
		.strip,
		.apron,
		.poster {
			transition: none;
		}
		.pill {
			animation: none;
		}
	}
</style>
