<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { getHqpContext } from '../context';
	import { channelLabel, codecLabel, hdrBadge, resolutionBadge, titleText } from '../logic/format';
	import { eyebrow } from '../logic/labels';
	import SignalChip from './SignalChip.svelte';
	import ResumeCapsule from './ResumeCapsule.svelte';

	// Portrait: eyebrow, title 22/27 (2 lines), badge row with the Signal chip, 22 px under the
	// picture. Large: logo art (or the title), eyebrow, title 26/32, badges (sections 5.1, 5.4).
	const { variant }: { variant: 'portrait' | 'large' } = $props();
	const { snapshot, ui } = getHqpContext();

	const item = $derived($snapshot.item);
	const audio = $derived($snapshot.audio.options.find((o) => o.selected));
	const badges = $derived.by(() => {
		if (!item) return [] as string[];
		const sound = audio
			? [codecLabel(audio.codec, true), channelLabel(audio.channels)].filter(Boolean).join(' ')
			: '';
		return [resolutionBadge(item.file.resolution), hdrBadge(item.file.hdr), sound].filter(
			(b): b is string => Boolean(b)
		);
	});
	const logo = $derived(variant === 'large' ? tmdbImageUrl(item?.artwork.logoPath, 'w500') : null);
	const resumeShown = $derived(
		variant === 'portrait' && $snapshot.resume !== null && $snapshot.status !== 'error'
	);
	let logoFailed = $state(false);
	const largeEyebrow = $derived.by(() => {
		if (!item) return '';
		if (logo && !logoFailed && item.kind === 'episode') {
			return [
				item.seasonNumber !== null ? `Season ${item.seasonNumber}` : '',
				item.episodeNumber !== null ? `Episode ${item.episodeNumber}` : ''
			]
				.filter(Boolean)
				.join(' · ');
		}
		return eyebrow(item, true);
	});
</script>

{#if item}
	{#if variant === 'portrait'}
		<div
			class="hqp-title-block hqp-fade hqp-x-scrub hqp-x-upnext hqp-x-info hqp-x-error hqp-x-card"
			data-from="bottom"
		>
			<p class="hqp-eyebrow eyebrow">{eyebrow(item, false)}</p>
			<h2 class="title">{titleText(item.title)}</h2>
			<div class="row">
				{#if resumeShown}
					<ResumeCapsule />
				{:else}
					<div class="badges">
						<SignalChip />
						{#if ui.layout === 'phone-portrait'}
							{#each badges as badge (badge)}
								<span class="hqp-tag badge">{badge}</span>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="large">
			{#if logo && !logoFailed}
				<img
					class="logo"
					src={logo}
					alt={item.kind === 'episode' ? (item.showTitle ?? '') : item.title}
					onerror={() => (logoFailed = true)}
				/>
			{/if}
			{#if largeEyebrow}<p class="hqp-eyebrow eyebrow">{largeEyebrow}</p>{/if}
			{#if item.kind === 'episode' || !logo || logoFailed}
				<h2 class="title large-title">{titleText(item.title)}</h2>
			{/if}
			<div class="badges">
				<SignalChip />
				{#each badges as badge (badge)}
					<span class="hqp-tag badge">{badge}</span>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	.hqp-title-block {
		position: absolute;
		left: 20px;
		right: 20px;
		top: calc(var(--frame-bottom) + 22px);
		display: grid;
		gap: 6px;
		z-index: var(--hqp-z-chrome);
	}
	.eyebrow,
	.title {
		margin: 0;
	}
	.eyebrow {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-size: 22px;
		line-height: 27px;
		font-weight: 700;
		letter-spacing: -0.01em;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-wrap: balance;
	}
	.row :global(.hqp-signal .pill) {
		height: 30px;
	}
	.row {
		min-height: 44px;
		margin-top: -2px;
		margin-left: -2px;
		pointer-events: auto;
		display: flex;
		align-items: center;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	/* Badges keep their own case ("1080p", "DD+ 5.1"); tags stay uppercase. */
	.badge {
		height: 28px;
		padding: 0 9px;
		color: var(--hqp-ink);
		text-transform: none;
	}
	:global(.hqp[data-layout='phone-portrait-short']) .hqp-title-block {
		top: calc(var(--frame-bottom) + 16px);
		gap: 4px;
	}
	:global(.hqp[data-layout='phone-portrait-short']) .title {
		-webkit-line-clamp: 1;
		line-clamp: 1;
		font-size: 19px;
		line-height: 24px;
	}

	.large {
		display: grid;
		justify-items: start;
		gap: 6px;
		min-width: 0;
		max-width: min(560px, 42cqw);
	}
	.logo {
		display: block;
		height: 48px;
		width: auto;
		max-width: 100%;
		margin-bottom: 6px;
		object-fit: contain;
		object-position: left center;
		filter: drop-shadow(0 2px 10px var(--hqp-scrim-b));
	}
	.large-title {
		font-size: 26px;
		line-height: 32px;
		letter-spacing: -0.015em;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		text-shadow: 0 1px 14px var(--hqp-scrim-c);
	}
	.large .badges {
		margin-top: -2px;
	}
	.large .badge {
		height: 26px;
		padding: 0 8px;
	}
	.large .badges :global(.hqp-signal .pill) {
		height: 28px;
	}
</style>
