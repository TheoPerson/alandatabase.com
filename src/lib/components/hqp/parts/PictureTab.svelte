<script lang="ts">
	import type { QualityLevel } from '$lib/media/types';
	import type { QualityChoice } from '$lib/player/hqp/types';
	import { getHqpContext } from '../context';
	import { fillCrop } from '../logic/layout';
	import { qualityRows } from '../logic/panel-labels';
	import { rovingGroup } from './a11y';
	import Icon from './Icon.svelte';

	// Picture (section 7.2): quality ladder with the reason of the active session, Fit / Fill with
	// the crop, the HDR row and, in iOS Safari tab mode, the Home Screen row.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	const quality = $derived($snapshot.quality);
	const session = $derived($snapshot.session);
	const levels = $derived(
		quality.available.length
			? quality.available
			: (session?.qualities ?? (['original'] as QualityLevel[]))
	);
	const rows = $derived(qualityRows(levels, session?.video.mode ?? null));
	const reason = $derived(session?.video.reason ?? null);
	const ar = $derived($snapshot.aspect ?? 16 / 9);
	const crop = $derived(
		fillCrop(ui.viewport.width ? ui.viewport : { width: 16, height: 9 }, ar).cropPercent
	);
	const hdrSource = $derived($snapshot.item ? $snapshot.item.file.hdr !== 'sdr' : false);
	const hdr = $derived(
		!hdrSource
			? 'SDR source'
			: $snapshot.hdrShown
				? 'HDR shown on this display'
				: 'Tone-mapped to SDR'
	);

	function choose(choice: QualityChoice) {
		if (quality.choice === choice) return;
		void ctx.engine.setQuality(choice);
	}
	function label(choice: QualityChoice, text: string) {
		if (choice !== 'auto' || !quality.active) return text;
		return `${text} · playing ${quality.active === 'original' ? 'Original' : quality.active}`;
	}
</script>

<div class="picture">
	<section aria-labelledby="hqp-quality-h">
		<h3 id="hqp-quality-h" class="hqp-eyebrow heading">Quality</h3>
		<div role="radiogroup" aria-labelledby="hqp-quality-h" use:rovingGroup>
			{#each rows as row (row.choice)}
				{@const checked = quality.choice === row.choice}
				<button
					type="button"
					class="hqp-row"
					role="radio"
					aria-checked={checked}
					tabindex={checked ? 0 : -1}
					onclick={() => choose(row.choice)}
				>
					<span class="hqp-row-check"><Icon name="check" size={20} /></span>
					<span class="text">
						<span class="hqp-row-label">{label(row.choice, row.label)}</span>
						{#if row.detail}<span class="hqp-row-detail">{row.detail}</span>{/if}
					</span>
					<span class="hqp-row-tags">
						{#if row.tag}<span class="hqp-tag" data-tone={row.tag === 'DIRECT' ? 'accent' : 'warn'}
								>{row.tag}</span
							>{/if}
					</span>
				</button>
			{/each}
		</div>
		{#if reason}<p class="reason">{reason}</p>{/if}
	</section>

	<section aria-labelledby="hqp-frame-h">
		<h3 id="hqp-frame-h" class="hqp-eyebrow heading">Frame</h3>
		<div class="hqp-seg frame" role="radiogroup" aria-labelledby="hqp-frame-h" use:rovingGroup>
			<button
				type="button"
				role="radio"
				aria-checked={$snapshot.frameMode === 'fit'}
				tabindex={$snapshot.frameMode === 'fit' ? 0 : -1}
				onclick={() => ctx.setFrame('fit')}>Fit</button
			>
			<button
				type="button"
				role="radio"
				aria-checked={$snapshot.frameMode === 'fill'}
				tabindex={$snapshot.frameMode === 'fill' ? 0 : -1}
				onclick={() => ctx.setFrame('fill')}
				>Fill{#if !ui.portrait && crop > 0}&nbsp;· crops {crop}%{/if}</button
			>
		</div>
		{#if ui.portrait}<p class="reason">Fill applies in landscape.</p>{/if}

		<h3 class="hqp-eyebrow heading">Dynamic range</h3>
		<p class="status-row" data-on={$snapshot.hdrShown ? '' : undefined}>
			<span class="dot" aria-hidden="true"></span>{hdr}
		</p>

		{#if ui.iosTab}
			<button type="button" class="hqp-row home" onclick={() => ui.open('homescreen')}>
				<span class="hqp-row-check" style:opacity="1"><Icon name="add-square" size={20} /></span>
				<span class="text">
					<span class="hqp-row-label">Add to Home Screen</span>
					<span class="hqp-row-detail">Plays full screen</span>
				</span>
				<Icon name="chevron-right" size={20} />
			</button>
		{/if}
	</section>
</div>

<style>
	.picture {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		display: grid;
		align-content: start;
		gap: 4px 18px;
		padding: 0 10px calc(var(--hqp-sa-b) + 14px);
	}
	:global(.hqp[data-layout='phone-landscape']) .picture,
	:global(.hqp[data-layout='large']) .picture {
		grid-template-columns: 1fr 1fr;
		padding-bottom: 14px;
	}
	section {
		min-width: 0;
	}
	.heading {
		margin: 0;
		padding: 12px 12px 6px;
		color: var(--hqp-ink-3);
	}
	.text {
		min-width: 0;
	}
	.reason {
		margin: 6px 12px 0;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-3);
	}
	.frame {
		margin: 0 6px;
	}
	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 12px;
		min-height: 32px;
		font-size: 15px;
		font-weight: 600;
		color: var(--hqp-ink-2);
	}
	.status-row .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--hqp-ink-3);
	}
	.status-row[data-on] {
		color: var(--hqp-ink);
	}
	.status-row[data-on] .dot {
		background: var(--hqp-accent);
	}
	.home {
		margin-top: 10px;
	}
</style>
