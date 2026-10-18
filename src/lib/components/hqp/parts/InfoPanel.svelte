<script lang="ts">
	import type { HqpMetrics } from '$lib/player/hqp/types';
	import { getHqpContext } from '../context';
	import { codecLabel, hdrBadge } from '../logic/format';
	import { infoAudioValue, infoSubtitleValue } from '../logic/panel-labels';
	import Icon from './Icon.svelte';

	// Playback info, "stats for nerds" (section 7.3): a non-modal thick-glass region that stays
	// open while the chrome hides and refreshes at 1 Hz only while open.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	let metrics = $state<HqpMetrics | null>(null);
	$effect(() => {
		if (!ui.info) {
			metrics = null;
			return;
		}
		const read = () => (metrics = ctx.engine.metrics());
		read();
		const timer = setInterval(read, 1000);
		return () => clearInterval(timer);
	});

	const DASH = '—';
	const mbps = (bits: number | null) =>
		bits && bits > 0 ? `${(bits / 1e6).toFixed(1)} Mb/s` : DASH;

	const rows = $derived.by(() => {
		const m = metrics;
		if (!m) return [] as Array<{ k: string; v: string; accent?: boolean; warn?: boolean }>;
		const direct = m.videoMode === 'copy';
		const video = [
			codecLabel(m.codec, true),
			m.profile,
			m.width && m.height ? `${m.width}×${m.height}` : null,
			m.frameRate ? `${Math.round(m.frameRate * 1000) / 1000} fps` : null,
			m.bitDepth ? `${m.bitDepth}-bit` : null
		].filter(Boolean);
		const hdr = hdrBadge(m.hdr);
		// Audio and subtitles come from the track fields, never the container title ("VFF").
		const audio = infoAudioValue(
			$snapshot.audio.options.find((option) => option.selected),
			m.audio.mode
		);
		const s = m.screen;
		return [
			{
				k: 'Stream',
				v: m.videoMode
					? `${direct ? 'Direct' : 'Converted'}${m.reason ? ` · ${m.reason}` : ''}`
					: DASH,
				accent: direct,
				warn: m.videoMode === 'transcode'
			},
			{ k: 'Video', v: video.join(' · ') || DASH },
			{
				k: 'HDR',
				v: hdr ? `${hdr} · ${m.hdrShown ? 'shown' : 'tone-mapped'}` : 'SDR',
				accent: Boolean(hdr && m.hdrShown)
			},
			{ k: 'Audio', v: audio },
			{ k: 'Subtitles', v: infoSubtitleValue($snapshot.subtitles) },
			{
				k: 'Delivery',
				v: [
					'HLS fMP4',
					m.segmentSeconds ? `${m.segmentSeconds} s segments` : null,
					m.delivery === 'native' ? 'native' : m.delivery
				]
					.filter(Boolean)
					.join(' · ')
			},
			{ k: 'Bitrate', v: `${mbps(m.bitrate.measured)} · file ${mbps(m.bitrate.file)}` },
			{ k: 'Network', v: mbps(m.throughput) },
			{
				k: 'Frames',
				v: m.frames
					? `${m.frames.dropped.toLocaleString('en')} dropped / ${m.frames.total.toLocaleString('en')}`
					: DASH
			},
			{
				k: 'Screen',
				v: `${s.width}×${s.height} @${s.dpr}x · ${Math.round(s.width * s.dpr)}×${Math.round(s.height * s.dpr)} px${s.refreshHz ? ` · ${s.refreshHz} Hz` : ''} · ${s.hdr ? 'HDR' : 'SDR'}`
			},
			{
				k: 'Quality',
				v: `${m.quality.choice === 'auto' ? 'Auto' : m.quality.choice}${m.quality.active ? ` · ${m.quality.active}` : ''}`
			},
			{ k: 'Session', v: m.sessionId ? m.sessionId.slice(0, 8) : DASH }
		];
	});
	const buffer = $derived(metrics ? Math.max(0, metrics.bufferAhead) : 0);

	// Portrait keeps one scrolling column: a "More" hint shows while rows remain below.
	let list = $state<HTMLElement | null>(null);
	let more = $state(false);
	function measure() {
		const el = list;
		more = !!el && el.scrollHeight - el.clientHeight - el.scrollTop > 4;
	}
	$effect(() => {
		void rows;
		if (list) requestAnimationFrame(measure);
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(ctx.engine.diagnostics());
			ui.toast('Diagnostics copied');
		} catch {
			ui.toast('Copy failed: clipboard unavailable');
		}
	}
	function reload() {
		void ctx.engine.retry();
		ui.toast('Reloading the stream…');
	}
</script>

{#if ui.info && !ui.locked}
	<section class="hqp-info hqp-glass--thick" aria-labelledby="hqp-info-title">
		<header class="head">
			<h2 id="hqp-info-title" class="hqp-eyebrow title">Playback info</h2>
			<button
				type="button"
				class="hqp-btn close"
				aria-label="Close playback info"
				onclick={() => (ui.info = false)}
			>
				<Icon name="close" size={18} />
			</button>
		</header>
		<dl class="rows" bind:this={list} onscroll={measure}>
			{#each rows as row (row.k)}
				<div class="row">
					<dt>{row.k}</dt>
					<dd class:accent={row.accent} class:warn={row.warn} title={row.v}>{row.v}</dd>
				</div>
			{/each}
			<!-- With the other rows only: a lone first snap target would pull the list to its end. -->
			{#if rows.length > 0}
				<div class="row">
					<dt>Buffer</dt>
					<dd class="buffer">
						<span class="hqp-tnum">{buffer.toFixed(0)} s</span>
						<span class="meter" style:--fill={Math.min(1, buffer / 60)}><i></i></span>
					</dd>
				</div>
			{/if}
		</dl>
		{#if more}
			<p class="more" aria-hidden="true">More <Icon name="chevron-down" size={14} /></p>
		{/if}
		<div class="actions">
			<button type="button" class="action" onclick={copy}
				><Icon name="copy" size={18} />Copy diagnostics</button
			>
			<button type="button" class="action" onclick={reload}
				><Icon name="refresh" size={18} />Reload stream</button
			>
		</div>
	</section>
{/if}

<style>
	.hqp-info {
		position: absolute;
		z-index: var(--hqp-z-panel);
		width: 380px;
		max-height: calc(100cqh - 24px);
		display: flex;
		flex-direction: column;
		padding: 6px 10px 8px 16px;
		border-radius: var(--hqp-r-card);
		overflow: hidden;
		animation: hqp-info-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	/* Portrait: between the picture and the timeline (the transport hides). */
	:global(.hqp[data-layout^='phone-portrait']) .hqp-info {
		left: 12px;
		right: 12px;
		width: auto;
		top: calc(var(--frame-bottom) + 14px);
		bottom: calc(var(--hqp-edge-bottom) + 112px);
	}
	/* Landscape: top right under the top bar, two label/value pairs per line, no scrolling. */
	:global(.hqp[data-layout='phone-landscape']) .hqp-info {
		right: var(--hqp-edge-x);
		top: 64px;
		width: min(640px, calc(100cqw - 2 * var(--hqp-edge-x)));
		max-height: calc(100cqh - 64px - var(--hqp-edge-bottom) - 102px);
	}
	/* Large: top left under the title. */
	:global(.hqp[data-layout='large']) .hqp-info {
		left: var(--hqp-edge-x);
		top: 196px;
		max-height: calc(100cqh - 196px - 140px);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: none;
	}
	.title {
		margin: 0;
	}
	.close {
		margin-right: -6px;
	}
	.rows {
		display: grid;
		grid-template-columns: 76px minmax(0, 1fr);
		gap: 5px 10px;
		margin: 0;
		overflow: auto;
		scrollbar-width: none;
		font-size: 12.5px;
		line-height: 16px;
		/* Scrolling stops on a row, so the fade always ends on a row boundary. */
		scroll-snap-type: y mandatory;
		scroll-padding-top: 0;
		-webkit-mask-image: linear-gradient(180deg, black calc(100% - 18px), transparent);
		mask-image: linear-gradient(180deg, black calc(100% - 18px), transparent);
		-webkit-user-select: text;
		user-select: text;
	}
	.row {
		display: contents;
	}
	.rows dt {
		scroll-snap-align: start;
	}
	:global(.hqp[data-layout='phone-landscape']) .rows {
		grid-template-columns: 64px minmax(0, 1fr) 64px minmax(0, 1fr);
		gap: 4px 10px;
		font-size: 13px;
		line-height: 17px;
		overflow: visible;
		scroll-snap-type: none;
		-webkit-mask-image: none;
		mask-image: none;
	}
	:global(.hqp[data-layout='phone-landscape']) dd {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		overflow-wrap: normal;
	}
	.more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		margin: 2px 0 0;
		font-size: 11px;
		line-height: 14px;
		font-weight: 700;
		color: var(--hqp-ink-3);
		pointer-events: none;
	}
	dt {
		font-weight: 600;
		color: var(--hqp-ink-3);
	}
	dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	dd.accent {
		color: var(--hqp-accent);
	}
	dd.warn {
		color: var(--hqp-warn);
	}
	.buffer {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.meter {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--hqp-track);
		overflow: hidden;
	}
	.meter i {
		display: block;
		height: 100%;
		background: var(--hqp-accent);
		transform-origin: 0 50%;
		scale: var(--fill) 1;
	}
	.actions {
		display: flex;
		gap: 6px;
		flex: none;
		margin: 6px -4px 0 -8px;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 44px;
		padding: 0 12px;
		border-radius: var(--hqp-r-capsule);
		font-size: 13px;
		font-weight: 700;
		background: var(--hqp-fill-row);
	}
	.action:active {
		background: var(--hqp-fill-press);
	}
	@keyframes hqp-info-in {
		from {
			opacity: 0;
			translate: 0 8px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-info {
			animation-name: hqp-info-fade;
		}
		@keyframes hqp-info-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
