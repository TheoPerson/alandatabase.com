<script lang="ts">
	import { formatTime } from '$lib/player/format-time';
	import { getHqpContext } from '../context';
	import { endsAt, meaningfulChapterTitle } from '../logic/format';
	import { chapterIndexAt } from '../logic/timeline';

	// Portrait times row (section 5.1): elapsed · current chapter + "ends 22:11" · remaining.
	const { snapshot, clock, ui } = getHqpContext();
	const shown = $derived(ui.scrub ? ui.scrub.target : $clock.position);
	const remaining = $derived(Math.max(0, $clock.duration - shown));
	const chapter = $derived.by(() => {
		const i = chapterIndexAt($snapshot.chapters, shown);
		return i >= 0 ? meaningfulChapterTitle($snapshot.chapters[i].title) : null;
	});
	const ends = $derived(
		$clock.duration > 0
			? endsAt(new Date(), Math.max(0, $clock.duration - $clock.position), $snapshot.rate)
			: ''
	);
</script>

<div class="hqp-timerow">
	<span class="time hqp-tnum">{formatTime(shown)}</span>
	<span class="mid">
		{#if chapter}<span class="chapter">{chapter}</span>{/if}
		{#if ends}<span class="ends">{chapter ? ' · ' : ''}ends {ends}</span>{/if}
	</span>
	<span class="time remaining hqp-tnum">−{formatTime(remaining)}</span>
</div>

<style>
	.hqp-timerow {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) 64px;
		align-items: center;
		gap: 12px;
		margin-top: -8px;
		padding: 0 2px;
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
	}
	/* Fixed boxes: the times change on every scrub frame without relayouting the row (10.2). */
	.time {
		height: 16px;
		white-space: nowrap;
		contain: size layout style;
	}
	.remaining {
		text-align: right;
		color: var(--hqp-ink-2);
	}
	.mid {
		height: 16px;
		contain: size layout style;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
		color: var(--hqp-ink-2);
	}
	.ends {
		color: var(--hqp-ink-3);
		font-weight: 500;
	}
	@media (max-width: 359px) {
		.ends {
			display: none;
		}
	}
</style>
