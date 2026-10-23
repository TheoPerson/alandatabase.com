<script lang="ts" module>
	export type HqpIconName =
		| 'chevron-down'
		| 'chevron-right'
		| 'chevron-left'
		| 'close'
		| 'play'
		| 'pause'
		| 'back-10'
		| 'forward-10'
		| 'airplay'
		| 'pip'
		| 'pip-exit'
		| 'lock'
		| 'unlock'
		| 'info'
		| 'subtitles'
		| 'audio'
		| 'speed'
		| 'episodes'
		| 'next'
		| 'volume'
		| 'volume-mute'
		| 'fullscreen'
		| 'fullscreen-exit'
		| 'check'
		| 'quality'
		| 'moon'
		| 'alert'
		| 'refresh'
		| 'wifi-off'
		| 'copy'
		| 'share'
		| 'add-square';
</script>

<script lang="ts">
	const { name, size = 22 }: { name: HqpIconName; size?: number } = $props();
</script>

<svg class="hqp-icon" width={size} height={size} aria-hidden="true" focusable="false"
	><use href="#hqp-i-{name}" /></svg
>

<style>
	.hqp-icon {
		display: block;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
		overflow: visible;
	}
</style>
