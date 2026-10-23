<script lang="ts">
	import PlayIcon from 'lucide-svelte/icons/play';
	import { youtubeThumbnail } from '$lib/tmdb/images';
	import { formatTime } from '$lib/player/format-time';
	import ResumeBar from '../resume-bar/resume-bar.svelte';

	interface Props {
		videoKey: string;
		name: string;
		kind: 'Trailer' | 'Teaser';
		resume?: { position: number; duration: number } | null;
		onplay: (key: string) => void;
		class?: string;
	}

	let { videoKey, name, kind, resume = null, onplay, class: className = '' }: Props = $props();

	const thumbnail = $derived(youtubeThumbnail(videoKey));
	let failed = $state(false);
</script>

<button
	type="button"
	class="facade {className}"
	onclick={() => onplay(videoKey)}
	aria-label={`${resume ? 'Resume' : 'Play'} ${kind.toLowerCase()}: ${name}`}
>
	<span class="stage">
		{#if thumbnail && !failed}
			<img
				src={thumbnail}
				alt=""
				width="480"
				height="360"
				loading="lazy"
				decoding="async"
				onerror={() => (failed = true)}
			/>
		{/if}
		<span class="play" aria-hidden="true"><PlayIcon size={22} /></span>
		{#if resume}<ResumeBar position={resume.position} duration={resume.duration} />{/if}
	</span>
	<span class="meta">
		<span class="kind">{kind}</span>
		{#if resume}<span class="left">{formatTime(resume.duration - resume.position)} left</span>{/if}
		<span class="name">{name}</span>
	</span>
</button>

<style>
	.facade {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		border-radius: var(--radius-md);
		color: inherit;
		text-align: left;
		outline-offset: 4px;
	}
	.stage {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--elevation-1);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play {
		position: absolute;
		top: 50%;
		left: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		background: rgba(8, 9, 11, 0.78);
		color: var(--content-primary);
		transform: translate(-50%, -50%);
		transition: transform var(--duration-fast) var(--ease-out);
	}
	.play :global(svg) {
		margin-left: 2px;
	}
	.facade:hover .play,
	.facade:focus-visible .play {
		transform: translate(-50%, -50%) scale(1.08);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.6rem;
		font-size: var(--text-sm);
	}
	.kind {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.left {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.name {
		flex-basis: 100%;
		font-weight: 700;
	}
	@media (prefers-reduced-motion: reduce) {
		.play {
			transition: none;
		}
	}
</style>
