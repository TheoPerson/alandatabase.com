<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { getHqpContext } from '../context';
	import { tileAt } from '../logic/trickplay';
	import Subtitles from './Subtitles.svelte';
	import SeekRipple from './SeekRipple.svelte';
	import Icon from './Icon.svelte';

	let { video = $bindable() }: { video?: HTMLVideoElement } = $props();

	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	// Native attributes Svelte does not type (iOS inline playback, AirPlay, auto PiP).
	const nativeAttrs: Record<string, string> = {
		'webkit-playsinline': '',
		'x-webkit-airplay': 'allow',
		autopictureinpicture: ''
	};

	const item = $derived($snapshot.item);
	const stillPath = $derived(item?.artwork.stillPath ?? item?.artwork.backdropPath ?? null);
	const poster = $derived(tmdbImageUrl(stillPath, 'w1280'));
	const status = $derived($snapshot.status);
	const opening = $derived(
		(status === 'starting' || status === 'loading' || status === 'idle') && !$snapshot.error
	);
	const blocked = $derived($snapshot.autoplayBlocked);
	const fill = $derived(!ui.portrait && $snapshot.frameMode === 'fill');
	const glide = $derived(ui.portrait && (ui.overlay === 'sheet' || ui.overlay === 'episodes'));
	const credits = $derived(!ui.portrait && $snapshot.upNext !== null);
	const ended = $derived(status === 'ended' && !$snapshot.upNext);
	// HDR headroom (section 4.5): full on the picture, constrained while a panel is open so UI
	// white stays legible. Browsers without dynamic-range-limit drop the declaration.
	const rangeLimit = $derived(
		ui.overlay === 'sheet' || ui.overlay === 'episodes' || ui.info ? 'constrained' : 'no-limit'
	);

	// Portrait scrub: the whole picture becomes the trickplay preview (section 6.3).
	const tile = $derived(
		ui.portrait && ui.scrub && $snapshot.trickplay
			? tileAt($snapshot.trickplay, ui.scrub.target)
			: null
	);
	const scale = $derived(tile ? 100 / tile.tileWidth : 0);

	// When the finger rests 300 ms, the video itself moves there and the sharp live frame crossfades
	// in over the tile (200 ms) once the seek has landed; moving again brings the tile back.
	$effect(() => {
		const scrub = ui.portrait ? ui.scrub : null;
		const target = scrub?.target;
		if (!scrub || target === undefined) return;
		if (ui.scrubSeek === null && Math.abs(target - scrub.origin) < 0.5) return;
		const timer = setTimeout(() => {
			ui.scrubSeek = target;
			ctx.engine.seek(target);
		}, 300);
		return () => clearTimeout(timer);
	});
	let landed = $state<number | null>(null);
	$effect(() => {
		const el = video;
		if (!el) return;
		const onSeeked = () => {
			const at = ui.scrubSeek;
			if (at !== null && Math.abs(el.currentTime - at) < 1) landed = at;
		};
		el.addEventListener('seeked', onSeeked);
		return () => el.removeEventListener('seeked', onSeeked);
	});
	const live = $derived(
		landed !== null &&
			landed === ui.scrubSeek &&
			ui.scrub !== null &&
			Math.abs(ui.scrub.target - landed) < 0.5
	);

	const message = $derived(
		$snapshot.pip
			? 'Playing in Picture in Picture'
			: $snapshot.airplay.active
				? 'Playing on AirPlay'
				: null
	);
</script>

<div
	class="hqp-frame"
	data-fill={fill ? '' : undefined}
	data-flip={ui.flip ?? undefined}
	data-glide={glide ? '' : undefined}
	data-credits={credits ? '' : undefined}
	data-pinching={ui.pinching ? '' : undefined}
	data-ended={ended ? '' : undefined}
	style:view-transition-name="hqp-frame"
>
	<video
		bind:this={video}
		class="hqp-video"
		playsinline
		preload="auto"
		crossorigin="anonymous"
		poster={poster ?? undefined}
		style:dynamic-range-limit={rangeLimit}
		{...nativeAttrs}
	></video>

	{#if opening || blocked}
		<div class="veil" data-blocked={blocked ? '' : undefined}>
			{#if poster}<img src={poster} alt="" decoding="async" />{/if}
		</div>
	{/if}
	{#if opening}
		<!-- The in-picture title is for the server render only; the chrome carries it once mounted. -->
		{#if !ui.mounted}<p class="opening-title" aria-hidden="true">{item?.title ?? ''}</p>{/if}
		<div class="loading-line" aria-hidden="true"><i></i></div>
	{/if}

	<div class="trick" data-on={tile && !live ? '' : undefined} aria-hidden="true">
		{#if tile}
			<div
				class="trick-tile"
				style:background-image="url('{tile.url}')"
				style:background-size="{tile.sheetWidth * scale}% {tile.sheetHeight *
					(100 / tile.tileHeight)}%"
				style:background-position="{tile.sheetWidth > tile.tileWidth
					? (tile.x / (tile.sheetWidth - tile.tileWidth)) * 100
					: 0}% {tile.sheetHeight > tile.tileHeight
					? (tile.y / (tile.sheetHeight - tile.tileHeight)) * 100
					: 0}%"
			></div>
		{/if}
	</div>

	<div class="switch-veil" data-on={status === 'switching' ? '' : undefined}></div>
	<div class="end-veil" data-on={ended ? '' : undefined}></div>

	<Subtitles />
	<SeekRipple />

	{#if message}
		<div class="system-message">
			<Icon name={$snapshot.pip ? 'pip' : 'airplay'} size={32} />
			<p>{message}</p>
			{#if $snapshot.pip}
				<button
					type="button"
					class="hqp-cta"
					data-variant="secondary"
					onclick={() => ctx.engine.togglePip()}
				>
					Return
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hqp-frame {
		position: absolute;
		left: 0;
		right: 0;
		margin-inline: auto;
		top: var(--frame-top);
		width: var(--frame-w);
		height: var(--frame-h);
		overflow: hidden;
		container-type: size;
		container-name: frame;
		background: var(--hqp-black);
		transform-origin: 50% 50%;
		transition:
			transform var(--hqp-dur-panel) var(--hqp-spring),
			border-radius var(--hqp-dur-panel) var(--hqp-ease-out);
	}
	.hqp-video {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: var(--hqp-black);
	}

	/* Fill covers the viewport (cover); Fit keeps the real aspect. */
	.hqp-frame[data-fill] {
		top: 0;
		width: 100cqw;
		height: 100cqh;
	}
	/* FLIP: scale from the contain size to the cover size, then swap geometry. */
	.hqp-frame[data-flip='to-fill'] {
		transform: scale(var(--cover));
		transition: transform 300ms var(--hqp-spring);
	}
	.hqp-frame[data-flip='from-fill'] {
		transform: scale(var(--cover));
		transition: none;
	}
	.hqp-frame[data-flip='settle'] {
		transition: none;
	}
	.hqp-frame[data-pinching] {
		transform: scale(var(--pinch, 1));
		transition: none;
		will-change: transform;
	}
	/* Portrait sheet: the picture glides up to the band edge (section 7.2). */
	.hqp-frame[data-glide] {
		transform: translateY(calc(var(--hqp-glide-top) - var(--frame-top)));
	}
	/* Credits shrink (section 7.4): landscape 0.6 / radius 22, large 0.7 / radius 26, near the top. */
	:global(.hqp[data-layout='phone-landscape']) .hqp-frame[data-credits] {
		transform: translateY(calc(14px - var(--frame-top) - var(--frame-h) * 0.2)) scale(0.6);
		border-radius: calc(22px / 0.6);
	}
	:global(.hqp[data-layout='large']) .hqp-frame[data-credits] {
		transform: translateY(calc(64px - var(--frame-top) - var(--frame-h) * 0.15)) scale(0.7);
		border-radius: calc(26px / 0.7);
	}

	.veil {
		position: absolute;
		inset: 0;
		background: var(--hqp-black);
	}
	.veil img {
		position: absolute;
		inset: -6%;
		width: 112%;
		height: 112%;
		object-fit: cover;
		filter: blur(24px) brightness(0.5);
	}
	.veil[data-blocked] img {
		inset: 0;
		width: 100%;
		height: 100%;
		filter: none;
	}
	.opening-title {
		position: absolute;
		inset: auto 8% 0;
		bottom: calc(50cqh - 16px);
		margin: 0;
		text-align: center;
		font-size: clamp(17px, 7cqh, 28px);
		line-height: 1.2;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-wrap: balance;
		text-shadow: 0 1px 12px var(--hqp-scrim-b);
	}
	.loading-line {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		overflow: hidden;
	}
	.loading-line i {
		position: absolute;
		inset: 0;
		width: 35%;
		background: linear-gradient(90deg, var(--hqp-scrim-0), var(--hqp-accent), var(--hqp-scrim-0));
		animation: hqp-sweep 1.4s var(--hqp-ease-out) 400ms infinite both;
	}
	@keyframes hqp-sweep {
		from {
			translate: -100% 0;
		}
		to {
			translate: 290% 0;
		}
	}

	.trick {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 200ms var(--hqp-ease-out);
		pointer-events: none;
	}
	.trick[data-on] {
		opacity: 1;
	}
	.trick-tile {
		position: absolute;
		inset: 0;
		background-repeat: no-repeat;
	}

	.switch-veil,
	.end-veil {
		position: absolute;
		inset: 0;
		background: var(--hqp-black);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--hqp-dur-fade) var(--hqp-ease-out);
	}
	.switch-veil[data-on] {
		opacity: 0.4;
	}
	.end-veil[data-on] {
		opacity: 0.6;
		transition-duration: var(--hqp-dur-out);
	}

	.system-message {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		background: var(--hqp-black);
		color: var(--hqp-ink-2);
		text-align: center;
		font-size: 15px;
		font-weight: 600;
	}
	.system-message p {
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.hqp-frame,
		.hqp-frame[data-flip='to-fill'] {
			transition: opacity var(--hqp-dur-fade) linear;
		}
		/* The glide still happens (layout), just without motion. */
		.hqp-frame[data-flip] {
			transform: none;
		}
		/* Credits shrink becomes a crossfade to the card over a dimmed full-size picture; the dim
		   is a veil, never opacity on the video (HDR). */
		:global(.hqp[data-layout]) .hqp-frame[data-credits] {
			transform: none;
			border-radius: 0;
		}
		.hqp-frame[data-credits] .end-veil {
			opacity: 0.55;
		}
		.loading-line i {
			animation: none;
			translate: 100% 0;
		}
	}
</style>
