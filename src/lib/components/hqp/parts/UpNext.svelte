<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { getHqpContext } from '../context';
	import { titleText } from '../logic/format';
	import { upNextMeta } from '../logic/panel-labels';
	import Icon from './Icon.svelte';

	// Up next (section 7.4). Landscape and large: the frame shrinks (Frame.svelte) and this card
	// rises at the bottom over a blurred backdrop of the next still. Portrait: the card replaces the
	// title block and the transport. White "Play now" with a 24 px countdown ring (10 s).
	const ctx = getHqpContext();
	const { snapshot, prefs, ui } = ctx;

	const upNext = $derived($snapshot.upNext);
	const next = $derived(upNext?.item ?? null);
	const still = $derived(
		tmdbImageUrl(next?.artwork.stillPath ?? next?.artwork.backdropPath ?? null, 'w780')
	);
	const backdrop = $derived(
		tmdbImageUrl(next?.artwork.stillPath ?? next?.artwork.backdropPath ?? null, 'w300')
	);
	const counting = $derived(Boolean(upNext?.countdownEndsAt) && $prefs.autoplayNext);
	const TOTAL = 10_000;

	let now = $state(Date.now());
	$effect(() => {
		if (!counting) return;
		now = Date.now();
		// 1 Hz only, for the reduced-motion text and the ring's starting point.
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const remainingMs = $derived(
		upNext?.countdownEndsAt ? Math.max(0, upNext.countdownEndsAt - now) : TOTAL
	);
	const seconds = $derived(Math.ceil(remainingMs / 1000));
	// Ring start (fraction elapsed) captured when the countdown (re)starts.
	const ringKey = $derived(upNext?.countdownEndsAt ?? 0);
	const ringFrom = $derived.by(() => {
		void ringKey;
		const left = upNext?.countdownEndsAt ? Math.max(0, upNext.countdownEndsAt - Date.now()) : TOTAL;
		return { elapsed: 1 - left / TOTAL, left };
	});

	let announced = -1;
	$effect(() => {
		if (!upNext || !next || announced === upNext.index) return;
		announced = upNext.index;
		ui.announce(`Up next: ${next.title}${counting ? ', playing in 10 seconds' : ''}`);
	});

	const episodeLabel = $derived(
		next?.kind === 'episode' && next.episodeNumber !== null
			? `Next · Episode ${next.episodeNumber}`
			: 'Next'
	);
</script>

{#if upNext && next}
	{#if !ui.portrait}
		<div class="backdrop" aria-hidden="true">
			{#if backdrop}<img src={backdrop} alt="" decoding="async" />{/if}
		</div>
	{/if}
	<section class="hqp-upnext hqp-glass--thick" aria-labelledby="hqp-upnext-title">
		<div class="top">
			<div class="still">
				{#if still}<img src={still} alt="" decoding="async" />{/if}
			</div>
			<div class="copy">
				<p class="eyebrow">{episodeLabel}</p>
				<h2 id="hqp-upnext-title" class="title">{titleText(next.title)}</h2>
				<p class="meta">{upNextMeta(next)}</p>
			</div>
		</div>
		<div class="actions">
			<button type="button" class="hqp-cta play" onclick={() => ctx.engine.next()}>
				{#if counting}
					{#key ringKey}
						<svg
							class="countdown-ring"
							viewBox="0 0 24 24"
							aria-hidden="true"
							style:--from={ringFrom.elapsed}
							style:--dur="{ringFrom.left}ms"
						>
							<circle class="bg" cx="12" cy="12" r="9.5" />
							<circle class="fg" cx="12" cy="12" r="9.5" pathLength="100" />
						</svg>
					{/key}
					<span class="countdown-text hqp-tnum">Next in {seconds} s</span>
					<span class="label">Play now</span>
				{:else}
					<Icon name="play" size={18} />
					<span>Play next</span>
				{/if}
			</button>
			<button
				type="button"
				class="hqp-cta"
				data-variant="secondary"
				onclick={() => ctx.engine.cancelUpNext()}
			>
				Credits
			</button>
		</div>
	</section>
{/if}

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: var(--hqp-z-dim);
		pointer-events: none;
		-webkit-mask-image: linear-gradient(0deg, black 30%, transparent 75%);
		mask-image: linear-gradient(0deg, black 30%, transparent 75%);
		animation: hqp-fade-in 600ms var(--hqp-ease-out) both;
	}
	:global(.hqp[data-layout='phone-landscape']) .backdrop {
		/* Keep the island pillars pure black: the island must vanish into them. */
		-webkit-mask-image:
			linear-gradient(
				90deg,
				transparent 64px,
				black 180px,
				black calc(100% - 180px),
				transparent calc(100% - 64px)
			),
			linear-gradient(0deg, black 30%, transparent 75%);
		-webkit-mask-composite: source-in;
		mask-image:
			linear-gradient(
				90deg,
				transparent 64px,
				black 180px,
				black calc(100% - 180px),
				transparent calc(100% - 64px)
			),
			linear-gradient(0deg, black 30%, transparent 75%);
		mask-composite: intersect;
	}
	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(60px) saturate(1.4) brightness(0.42);
	}
	.hqp-upnext {
		position: absolute;
		z-index: var(--hqp-z-panel);
		display: grid;
		gap: 14px;
		padding: 14px;
		border-radius: var(--hqp-r-card);
		animation: hqp-card-in 320ms var(--hqp-ease-out) 80ms both;
	}
	/* Landscape and large: centred at the bottom, the shrunken frame above. */
	:global(.hqp[data-layout='phone-landscape']) .hqp-upnext,
	:global(.hqp[data-layout='large']) .hqp-upnext {
		left: 0;
		right: 0;
		margin-inline: auto;
		bottom: var(--hqp-edge-bottom);
		width: min(720px, 100cqw - 2 * var(--hqp-edge-x));
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}
	:global(.hqp[data-layout='large']) .hqp-upnext {
		bottom: 64px;
		width: min(820px, 100cqw - 2 * var(--hqp-edge-x));
		padding: 16px;
	}
	/* Portrait: in place of the title block and the transport. */
	:global(.hqp[data-layout^='phone-portrait']) .hqp-upnext {
		left: 12px;
		right: 12px;
		top: calc(var(--frame-bottom) + 18px);
	}
	:global(.hqp[data-layout='phone-portrait-short']) .hqp-upnext {
		top: calc(var(--frame-bottom) + 16px);
	}
	.top {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 14px;
		align-items: center;
	}
	.still {
		width: 132px;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		background: var(--hqp-fill-row);
		box-shadow: 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
	}
	:global(.hqp[data-layout='phone-landscape']) .still {
		width: 120px;
	}
	:global(.hqp[data-layout='large']) .still {
		width: 168px;
	}
	.still img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		min-width: 0;
	}
	.eyebrow {
		margin: 0;
		font-size: 12px;
		line-height: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hqp-accent);
	}
	.title {
		margin: 3px 0 0;
		font-size: 17px;
		line-height: 21px;
		font-weight: 700;
		letter-spacing: -0.01em;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.hqp[data-layout='large']) .title {
		font-size: 19px;
		line-height: 24px;
	}
	.meta {
		margin: 4px 0 0;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-2);
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.play {
		flex: 1;
		gap: 8px;
	}
	.countdown-ring {
		width: 20px;
		height: 20px;
		flex: none;
		rotate: -90deg;
	}
	.countdown-ring circle {
		fill: none;
		stroke-width: 2.4;
	}
	/* The full track is always visible on the white button, so the arc reads as a ring emptying. */
	.countdown-ring .bg {
		stroke: var(--hqp-ink-on-light-faint);
	}
	.countdown-ring .fg {
		stroke: var(--hqp-ink-on-light);
		stroke-linecap: round;
		stroke-dasharray: 100;
		animation: hqp-ring var(--dur) linear both;
	}
	@keyframes hqp-ring {
		from {
			stroke-dashoffset: calc(100 * var(--from));
		}
		to {
			stroke-dashoffset: 100;
		}
	}
	.countdown-text {
		display: none;
	}
	@keyframes hqp-card-in {
		from {
			opacity: 0;
			translate: 0 24px;
		}
	}
	@keyframes hqp-fade-in {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-upnext {
			animation-name: hqp-fade-in;
			animation-duration: var(--hqp-dur-fade);
		}
		.countdown-ring {
			display: none;
		}
		.countdown-text {
			display: inline;
		}
		.countdown-text + .label {
			display: none;
		}
		.backdrop {
			animation: none;
		}
	}
</style>
