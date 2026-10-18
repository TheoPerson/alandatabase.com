<script lang="ts">
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { getHqpContext } from '../context';
	import { titleText } from '../logic/format';
	import { runtimeLabel } from '../logic/labels';
	import { rovingGroup } from './a11y';
	import Icon from './Icon.svelte';
	import Panel from './Panel.svelte';

	// Episodes drawer (section 7.6): same geometry as the sheet; seasons present in the queue;
	// rows with a 16:9 still, progress, "E2 · 58 min", the title and a completed check.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	const queue = $derived($snapshot.queue);
	const seasons = $derived(
		[...new Set(queue.map((item) => item.seasonNumber ?? 0))].sort((a, b) => a - b)
	);
	let season = $state<number | null>(null);
	const activeSeason = $derived(season ?? $snapshot.item?.seasonNumber ?? seasons[0] ?? 0);
	const rows = $derived(
		queue
			.map((item, index) => ({ item, index }))
			.filter((row) => (row.item.seasonNumber ?? 0) === activeSeason)
	);

	function progressOf(index: number): number {
		const p = queue[index]?.progress;
		if (!p) return 0;
		if (p.completed) return 1;
		const duration = p.durationSeconds ?? queue[index].file.durationSeconds ?? 0;
		return duration > 0 ? Math.min(1, p.positionSeconds / duration) : 0;
	}

	function play(index: number) {
		if (index === $snapshot.index) {
			ui.close();
			return;
		}
		ui.close();
		void ctx.engine.playIndex(index);
	}
</script>

{#if ui.shown === 'episodes'}
	<Panel labelledby="hqp-episodes-title" initialFocus="[aria-current='true']">
		{#snippet header()}
			<div class="head">
				<h2 id="hqp-episodes-title" class="title">{$snapshot.item?.showTitle ?? 'Episodes'}</h2>
				<button
					type="button"
					class="hqp-btn"
					aria-label="Close episodes"
					onclick={() => ui.close()}
				>
					<Icon name="close" />
				</button>
			</div>
			{#if seasons.length > 1}
				<div class="hqp-seg seasons" role="radiogroup" aria-label="Season" use:rovingGroup>
					{#each seasons as s (s)}
						<button
							type="button"
							role="radio"
							aria-checked={activeSeason === s}
							tabindex={activeSeason === s ? 0 : -1}
							onclick={() => (season = s)}>Season {s}</button
						>
					{/each}
				</div>
			{/if}
		{/snippet}
		<ol class="list">
			{#each rows as row (row.item.fileId)}
				{@const current = row.index === $snapshot.index}
				{@const progress = progressOf(row.index)}
				{@const done = row.item.progress?.completed ?? false}
				<li>
					<button
						type="button"
						class="episode"
						aria-current={current ? 'true' : undefined}
						onclick={() => play(row.index)}
					>
						<span class="still">
							{#if row.item.artwork.stillPath}
								<img
									src={tmdbImageUrl(row.item.artwork.stillPath, 'w300')}
									alt=""
									loading="lazy"
									decoding="async"
								/>
							{/if}
							{#if progress > 0 && !current}
								<span class="bar" style:--f={progress}><i></i></span>
							{/if}
						</span>
						<span class="text">
							<span class="meta hqp-tnum">
								{#if current}<span class="now">Now playing</span>{:else}E{row.item.episodeNumber ??
										'?'}{#if row.item.runtimeMinutes}&nbsp;· {runtimeLabel(
											row.item.runtimeMinutes
										)}{/if}{/if}
							</span>
							<span class="name">{titleText(row.item.title)}</span>
						</span>
						{#if done}
							<span class="done" aria-label="Watched"><Icon name="check" size={18} /></span>
						{/if}
					</button>
				</li>
			{/each}
		</ol>
	</Panel>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px 10px 4px 22px;
	}
	.title {
		flex: 1;
		margin: 0;
		font-size: 19px;
		line-height: 24px;
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.seasons {
		margin: 6px 16px 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.seasons > :global(button) {
		flex: 0 0 auto;
		height: 44px;
		padding: 0 14px;
	}
	.list {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 4px 10px calc(var(--hqp-sa-b) + 12px);
		list-style: none;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		display: grid;
		align-content: start;
		gap: 4px;
		-webkit-mask-image: linear-gradient(180deg, black calc(100% - 32px), transparent);
		mask-image: linear-gradient(180deg, black calc(100% - 32px), transparent);
	}
	:global(.hqp[data-layout='phone-landscape']) .list,
	:global(.hqp[data-layout='large']) .list {
		padding-bottom: 12px;
	}
	.episode {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 48px;
		padding: 6px;
		border-radius: var(--hqp-r-tile);
		text-align: left;
	}
	.episode:active {
		background: var(--hqp-fill-press);
	}
	.episode[aria-current='true'] {
		background: var(--hqp-fill-row);
	}
	.still {
		position: relative;
		width: 120px;
		aspect-ratio: 16 / 9;
		border-radius: 10px;
		overflow: hidden;
		background: var(--hqp-fill-row);
		box-shadow: 0 0 0 var(--hqp-hairline) var(--hqp-glass-rim);
	}
	.episode[aria-current='true'] .still {
		box-shadow: 0 0 0 2px var(--hqp-accent);
	}
	.still img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.bar {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 5px;
		height: 3px;
		border-radius: 2px;
		background: var(--hqp-track);
		overflow: hidden;
	}
	.bar i {
		position: absolute;
		inset: 0;
		background: var(--hqp-accent);
		transform-origin: 0 50%;
		scale: var(--f) 1;
	}
	.text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.meta {
		font-size: 13px;
		line-height: 17px;
		font-weight: 600;
		color: var(--hqp-ink-3);
	}
	.now {
		color: var(--hqp-accent);
	}
	.name {
		font-size: 15px;
		line-height: 19px;
		font-weight: 600;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.done {
		color: var(--hqp-accent);
		padding-right: 6px;
	}
</style>
