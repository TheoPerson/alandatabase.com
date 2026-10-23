<script lang="ts">
	import { formatTime } from '$lib/player/format-time';

	interface Props {
		position: number;
		duration: number;
		class?: string;
	}

	let { position, duration, class: className = '' }: Props = $props();

	const percent = $derived(
		duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0
	);
</script>

<span
	class="bar {className}"
	role="progressbar"
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={Math.round(percent)}
	aria-label={`Watched ${formatTime(position)} of ${formatTime(duration)}`}
>
	<span class="fill" style:transform={`scaleX(${percent / 100})`}></span>
</span>

<style>
	.bar {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: block;
		height: 3px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.25);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--brand-primary);
		transform-origin: left;
	}
</style>
