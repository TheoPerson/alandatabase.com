<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatTime } from '$lib/player/format-time';
	import { getHqpContext } from '../context';
	import { meaningfulChapterTitle } from '../logic/format';
	import { deltaLabel } from '../logic/panel-labels';
	import { createSheetCache, imageSheet } from '../logic/sheet-cache';
	import { chapterIndexAt, fraction } from '../logic/timeline';
	import { sheetsAround, tileAt } from '../logic/trickplay';

	// Scrub preview (section 6.3). Portrait: the frame itself shows the tile (Frame.svelte) and this
	// shows chapter, a 44 px time and the emerald delta under the picture. Landscape and large: a
	// 216 / 272 px tile with the chapter above and a glass time pill below, following the finger.
	const { snapshot, clock, ui } = getHqpContext();

	const seconds = $derived(ui.scrub ? ui.scrub.target : ui.hoverAt);
	const active = $derived(seconds !== null);
	const delta = $derived(ui.scrub ? ui.scrub.target - ui.scrub.origin : null);
	const chapter = $derived.by(() => {
		if (seconds === null) return null;
		const i = chapterIndexAt($snapshot.chapters, seconds);
		return i >= 0 ? meaningfulChapterTitle($snapshot.chapters[i].title) : null;
	});
	const manifest = $derived($snapshot.trickplay);
	const tile = $derived(manifest && seconds !== null ? tileAt(manifest, seconds) : null);
	const width = $derived(ui.large ? 272 : 216);
	const centre = $derived.by(() => {
		if (seconds === null) return 0;
		const x = ui.track.left + fraction(seconds, $clock.duration) * ui.track.width;
		const half = width / 2;
		return Math.min(Math.max(x, 12 + half), Math.max(12 + half, ui.viewport.width - 12 - half));
	});

	// Decoded sheets: current plus neighbours, at most three (LRU).
	const cache = createSheetCache(imageSheet);
	let lastSheet = '';
	$effect(() => {
		if (!tile || !manifest || seconds === null) return;
		if (tile.url === lastSheet) return;
		lastSheet = tile.url;
		cache.touch(sheetsAround(manifest, seconds));
	});
	onDestroy(() => cache.clear());

	const bgSize = $derived(
		tile
			? `${(tile.sheetWidth / tile.tileWidth) * 100}% ${(tile.sheetHeight / tile.tileHeight) * 100}%`
			: ''
	);
	const bgPos = $derived.by(() => {
		if (!tile) return '';
		const x =
			tile.sheetWidth > tile.tileWidth ? (tile.x / (tile.sheetWidth - tile.tileWidth)) * 100 : 0;
		const y =
			tile.sheetHeight > tile.tileHeight
				? (tile.y / (tile.sheetHeight - tile.tileHeight)) * 100
				: 0;
		return `${x}% ${y}%`;
	});
</script>

{#if active && seconds !== null}
	{#if ui.portrait}
		{#if ui.scrub}
			<div class="portrait-readout" aria-hidden="true">
				{#if chapter}<p class="hqp-eyebrow chapter">{chapter}</p>{/if}
				<p class="big hqp-tnum">{formatTime(seconds)}</p>
				{#if delta !== null}<p class="delta hqp-tnum">{deltaLabel(delta)}</p>{/if}
			</div>
		{/if}
	{:else}
		<div class="preview" aria-hidden="true" style:--w="{width}px" style:--x="{centre}px">
			{#if chapter}<p class="hqp-eyebrow chapter">{chapter}</p>{/if}
			{#if tile}
				<!-- The tile keeps the picture's own shape (2.39:1 scope stays 2.39:1). -->
				<div
					class="tile"
					style:--tile-ar={tile.tileWidth / tile.tileHeight}
					style:background-image="url('{tile.url}')"
					style:background-size={bgSize}
					style:background-position={bgPos}
				></div>
			{/if}
			<p class="pill hqp-glass hqp-tnum">
				<span class="t">{formatTime(seconds)}</span>{#if delta !== null}<span class="delta"
						>{deltaLabel(delta)}</span
					>{/if}
			</p>
		</div>
	{/if}
{/if}

<style>
	.portrait-readout {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(var(--frame-bottom) + 26px);
		z-index: var(--hqp-z-chrome);
		display: grid;
		justify-items: center;
		gap: 6px;
		pointer-events: none;
		text-align: center;
		/* Text that changes on every scrub frame stays inside this box (section 10.2). */
		contain: layout style;
	}
	.portrait-readout p {
		margin: 0;
		max-width: 100%;
		contain: layout style;
	}
	.big {
		font-size: 44px;
		line-height: 48px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.delta {
		font-size: 14px;
		line-height: 18px;
		font-weight: 600;
		color: var(--hqp-accent);
	}
	.chapter {
		margin: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 1px 8px var(--hqp-scrim-a);
	}

	.preview {
		position: absolute;
		left: 0;
		bottom: calc(var(--hqp-edge-bottom) + 102px);
		z-index: var(--hqp-z-toast);
		width: var(--w);
		display: grid;
		justify-items: center;
		gap: 8px;
		pointer-events: none;
		translate: calc(var(--x) - var(--w) / 2) 0;
		transform-origin: 50% 100%;
		animation: hqp-preview-in var(--hqp-dur-in) var(--hqp-spring) both;
		/* Positioned only with translate; its changing text never relayouts the player. */
		contain: layout style;
	}
	:global(.hqp[data-layout='large']) .preview {
		bottom: 128px;
	}
	.tile {
		width: 100%;
		aspect-ratio: var(--tile-ar, 16 / 9);
		border-radius: var(--hqp-r-tile);
		background-color: var(--hqp-black);
		background-repeat: no-repeat;
		box-shadow:
			0 0 0 var(--hqp-hairline) var(--hqp-glass-rim),
			0 18px 40px -12px var(--hqp-scrim-a);
	}
	.pill {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		margin: 0;
		padding: 5px 12px;
		border-radius: var(--hqp-r-capsule);
		font-size: 15px;
		line-height: 20px;
		font-weight: 700;
	}
	.pill .t,
	.pill .delta {
		display: inline-block;
		contain: layout style paint;
	}
	.pill .delta {
		font-size: 13px;
	}
	@keyframes hqp-preview-in {
		from {
			opacity: 0;
			scale: 0.96;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.preview {
			animation: none;
		}
	}
</style>
