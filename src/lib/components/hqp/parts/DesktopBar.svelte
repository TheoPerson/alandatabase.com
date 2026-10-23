<script lang="ts">
	import { getHqpContext } from '../context';
	import { audioValue, endsAt, meaningfulChapterTitle, subtitleValue } from '../logic/format';
	import { tracksAria } from '../logic/labels';
	import { chapterIndexAt } from '../logic/timeline';
	import Icon from './Icon.svelte';

	// Large layout bottom bar (section 5.4): play; back/forward/mute/volume; chapter and "ends at";
	// Audio & Subtitles and Speed; Episodes and Next episode; PiP and Fullscreen.
	const ctx = getHqpContext();
	const { snapshot, clock, ui } = ctx;

	const status = $derived($snapshot.status);
	const playing = $derived(status === 'playing' || status === 'buffering');
	const audio = $derived($snapshot.audio.options.find((o) => o.selected));
	const subs = $derived(subtitleValue($snapshot.subtitles));
	const isEpisode = $derived($snapshot.item?.kind === 'episode');
	const hasNext = $derived($snapshot.index < $snapshot.queue.length - 1);
	const volume = $derived($snapshot.muted ? 0 : $snapshot.volume);
	const chapter = $derived.by(() => {
		const i = chapterIndexAt($snapshot.chapters, $clock.position);
		return i >= 0 ? meaningfulChapterTitle($snapshot.chapters[i].title) : null;
	});
	const ends = $derived(
		$clock.duration > 0 ? endsAt(new Date(), $clock.duration - $clock.position, $snapshot.rate) : ''
	);
	const fullscreenEnabled = typeof document !== 'undefined' && document.fullscreenEnabled;

	let volumeEl: HTMLDivElement;
	let volumeRect = { left: 0, width: 84 };
	let volumeDrag = false;

	function setVolumeAt(x: number) {
		const level = Math.min(1, Math.max(0, (x - volumeRect.left) / volumeRect.width));
		ctx.engine.setVolume(Math.round(level * 100) / 100);
		if ($snapshot.muted && level > 0) ctx.engine.setMuted(false);
	}
	function onVolumeDown(event: PointerEvent) {
		const r = volumeEl.getBoundingClientRect();
		volumeRect = { left: r.left, width: r.width };
		volumeDrag = true;
		volumeEl.setPointerCapture?.(event.pointerId);
		setVolumeAt(event.clientX);
	}
	function onVolumeMove(event: PointerEvent) {
		if (volumeDrag) setVolumeAt(event.clientX);
	}
	function onVolumeKey(event: KeyboardEvent) {
		const step =
			event.key === 'ArrowRight' || event.key === 'ArrowUp'
				? 0.05
				: event.key === 'ArrowLeft' || event.key === 'ArrowDown'
					? -0.05
					: 0;
		if (!step) return;
		event.preventDefault();
		event.stopPropagation();
		ctx.engine.setVolume(Math.min(1, Math.max(0, volume + step)));
	}
	// Passive: the player never scrolls, so there is nothing to prevent.
	function onVolumeWheel(event: WheelEvent) {
		ctx.engine.setVolume(Math.min(1, Math.max(0, volume - Math.sign(event.deltaY) * 0.05)));
	}
	function toggle() {
		if ($snapshot.autoplayBlocked) void ctx.engine.play();
		else ctx.engine.toggle();
	}
</script>

<div class="hqp-desktop-bar hqp-x-scrub">
	<button
		type="button"
		class="hqp-btn hqp-glass"
		aria-label={playing ? 'Pause' : 'Play'}
		onclick={toggle}
	>
		<Icon name={playing ? 'pause' : 'play'} size={20} />
	</button>
	<div class="hqp-group hqp-glass">
		<button
			type="button"
			class="hqp-btn"
			aria-label="Back 10 seconds"
			onclick={() => ctx.engine.skip(-10)}
		>
			<Icon name="back-10" size={22} />
		</button>
		<button
			type="button"
			class="hqp-btn"
			aria-label="Forward 10 seconds"
			onclick={() => ctx.engine.skip(10)}
		>
			<Icon name="forward-10" size={22} />
		</button>
		<button
			type="button"
			class="hqp-btn"
			aria-label={$snapshot.muted ? 'Unmute' : 'Mute'}
			aria-pressed={$snapshot.muted}
			onclick={() => ctx.engine.setMuted(!$snapshot.muted)}
		>
			<Icon name={volume === 0 ? 'volume-mute' : 'volume'} size={20} />
		</button>
		<div
			bind:this={volumeEl}
			class="volume"
			role="slider"
			tabindex="0"
			aria-label="Volume"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(volume * 100)}
			style:--v={volume}
			onpointerdown={onVolumeDown}
			onpointermove={onVolumeMove}
			onpointerup={() => (volumeDrag = false)}
			onpointercancel={() => (volumeDrag = false)}
			onkeydown={onVolumeKey}
			onwheel={onVolumeWheel}
		>
			<span class="vol-track"><i></i></span>
		</div>
	</div>
	<p class="meta">
		{#if chapter}<span class="chapter">{chapter}</span>{/if}
		{#if ends}<span class="ends">{chapter ? ' · ' : ''}ends {ends}</span>{/if}
	</p>
	<span class="spacer"></span>
	<div class="hqp-group hqp-glass">
		<button
			type="button"
			class="hqp-cap"
			aria-label={tracksAria(audio, $snapshot.subtitles)}
			aria-haspopup="dialog"
			onclick={(e) => ui.openSheet('tracks', e.currentTarget)}
		>
			<Icon name="subtitles" size={20} />
			<span class="value" aria-hidden="true"
				>{audioValue(audio)}{subs !== 'Off' ? ` · ${subs}` : ''}</span
			>
		</button>
		<span class="hqp-sep" aria-hidden="true"></span>
		<button
			type="button"
			class="hqp-cap"
			aria-label="Speed {$snapshot.rate}x"
			aria-haspopup="dialog"
			onclick={(e) => ui.openSheet('playback', e.currentTarget)}
		>
			<Icon name="speed" size={20} />
			<span class="hqp-tnum">{$snapshot.rate}×</span>
		</button>
	</div>
	{#if isEpisode && $snapshot.queue.length > 1}
		<div class="hqp-group hqp-glass">
			<button
				type="button"
				class="hqp-cap"
				aria-label="Episodes"
				aria-haspopup="dialog"
				onclick={(e) => ui.open('episodes', e.currentTarget)}
			>
				<Icon name="episodes" size={20} />
				<span class="label">Episodes</span>
			</button>
			{#if hasNext}
				<span class="hqp-sep" aria-hidden="true"></span>
				<button
					type="button"
					class="hqp-cap"
					aria-label="Next episode"
					onclick={() => ctx.engine.next()}
				>
					<Icon name="next" size={20} />
					<span class="label">Next episode</span>
				</button>
			{/if}
		</div>
	{/if}
	<div class="hqp-group hqp-glass">
		<button
			type="button"
			class="hqp-btn"
			aria-label={$snapshot.pip ? 'Exit Picture in Picture' : 'Picture in Picture'}
			aria-pressed={$snapshot.pip}
			onclick={() => ctx.engine.togglePip()}
		>
			<Icon name={$snapshot.pip ? 'pip-exit' : 'pip'} size={20} />
		</button>
		{#if fullscreenEnabled}
			<button
				type="button"
				class="hqp-btn"
				aria-label={$snapshot.fullscreen ? 'Exit full screen' : 'Full screen'}
				onclick={() => {
					const root = ctx.root();
					if (root) void ctx.engine.toggleFullscreen(root);
				}}
			>
				<Icon name={$snapshot.fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={20} />
			</button>
		{/if}
	</div>
</div>

<style>
	.hqp-desktop-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.hqp-desktop-bar :global(.hqp-cap) {
		font-size: 15px;
	}
	.spacer {
		flex: 1;
	}
	.volume {
		position: relative;
		display: grid;
		align-items: center;
		width: 84px;
		height: 44px;
		margin: 0 14px 0 2px;
		cursor: pointer;
		touch-action: none;
		border-radius: 6px;
	}
	.vol-track {
		position: relative;
		height: 4px;
		border-radius: 2px;
		background: var(--hqp-track);
		overflow: hidden;
	}
	.vol-track i {
		position: absolute;
		inset: 0;
		background: var(--hqp-ink);
		transform-origin: 0 50%;
		scale: var(--v) 1;
	}
	.meta {
		margin: 0 0 0 6px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
		color: var(--hqp-ink-2);
		text-shadow: 0 1px 8px var(--hqp-scrim-b);
	}
	.ends {
		color: var(--hqp-ink-3);
		font-weight: 500;
	}
	@container hqp (max-width: 1180px) {
		.meta {
			display: none;
		}
	}
	@container hqp (max-width: 980px) {
		.label {
			display: none;
		}
	}
	@container hqp (max-width: 760px) {
		.value {
			display: none;
		}
	}
</style>
