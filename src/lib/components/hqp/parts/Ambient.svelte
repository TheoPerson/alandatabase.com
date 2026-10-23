<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { getHqpContext } from '../context';
	import { tileAt } from '../logic/trickplay';

	// Portrait ambient light: the still (w300) blurred around the picture, masked out of the
	// island band. Static: never sampled from the video (section 5.1). Dimmed, and nearly off while
	// playing with the chrome hidden, so it never competes with the film.
	const { snapshot, ui } = getHqpContext();
	const item = $derived($snapshot.item);
	const src = $derived(
		tmdbImageUrl(item?.artwork.stillPath ?? item?.artwork.backdropPath ?? null, 'w300')
	);
	const scrubTile = $derived(
		ui.portrait && ui.scrub && $snapshot.trickplay
			? tileAt($snapshot.trickplay, ui.scrub.target)
			: null
	);
	const glide = $derived(ui.portrait && (ui.overlay === 'sheet' || ui.overlay === 'episodes'));
</script>

<div class="hqp-ambient" aria-hidden="true">
	<div class="glow" data-glide={glide ? '' : undefined}>
		{#if src}
			<img class="a" {src} alt="" decoding="async" data-off={scrubTile ? '' : undefined} />
		{/if}
		{#if scrubTile}
			<img class="b" src={scrubTile.url} alt="" decoding="async" />
		{/if}
	</div>
</div>

<style>
	.hqp-ambient {
		display: none;
		position: absolute;
		inset: 0;
		pointer-events: none;
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent var(--hqp-edge-top),
			black calc(var(--hqp-edge-top) + 78px),
			black calc(100% - 120px),
			transparent
		);
		mask-image: linear-gradient(
			to bottom,
			transparent var(--hqp-edge-top),
			black calc(var(--hqp-edge-top) + 78px),
			black calc(100% - 120px),
			transparent
		);
	}
	@media (orientation: portrait) and (max-width: 599px) {
		.hqp-ambient {
			display: block;
		}
	}
	.glow {
		position: absolute;
		left: -30%;
		right: -30%;
		top: calc(var(--frame-top) - 60px);
		height: calc(var(--frame-h) + 240px);
		transition: transform var(--hqp-dur-panel) var(--hqp-spring);
	}
	.glow[data-glide] {
		transform: translateY(calc(var(--hqp-glide-top) - var(--frame-top)));
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Dimmed so the halo never outshines a dark scene or lifts the OLED black. */
		filter: blur(60px) saturate(1.2) brightness(0.55);
		opacity: 0.3;
		transition: opacity 600ms var(--hqp-ease-out);
	}
	/* Watching with the chrome hidden: the halo all but disappears. */
	:global(.hqp[data-chrome='off'][data-status='playing']) img:not([data-off]) {
		opacity: 0.08;
	}
	img.a[data-off] {
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		img {
			transition: none;
		}
		.glow {
			transition: none;
		}
	}
</style>
