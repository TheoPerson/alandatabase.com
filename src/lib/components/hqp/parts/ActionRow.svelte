<script lang="ts">
	import { getHqpContext } from '../context';
	import { audioValue, subtitleValue } from '../logic/format';
	import { tracksAria } from '../logic/labels';
	import Icon from './Icon.svelte';

	// Actions row (sections 5.1, 5.2): value-first Audio & Subtitles and Speed in one glass group,
	// Episodes and Next in another (series only): at most two glass surfaces here. Films keep
	// Playback info in the top bar only, never twice on one screen.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	const audio = $derived($snapshot.audio.options.find((o) => o.selected));
	const subs = $derived(subtitleValue($snapshot.subtitles));
	const isEpisode = $derived($snapshot.item?.kind === 'episode');
	const hasNext = $derived($snapshot.index < $snapshot.queue.length - 1);
	const hasEpisodes = $derived(isEpisode && $snapshot.queue.length > 1);
	const rate = $derived(`${$snapshot.rate}×`);
</script>

<div class="hqp-actions hqp-x-scrub" class:hqp-x-upnext={ui.layout === 'phone-portrait-short'}>
	<div class="hqp-group hqp-glass">
		<button
			type="button"
			class="hqp-cap tracks"
			aria-label={tracksAria(audio, $snapshot.subtitles)}
			aria-haspopup="dialog"
			onclick={(e) => ui.openSheet('tracks', e.currentTarget)}
		>
			<Icon name="subtitles" size={20} />
			<span class="value" aria-hidden="true">
				<span>{audioValue(audio)}</span>{#if subs !== 'Off'}<span class="subs"
						>{` · ${ui.portrait ? subs.replace(/ forced$/, '') : subs}`}</span
					>{/if}
			</span>
		</button>
		<span class="hqp-sep" aria-hidden="true"></span>
		<button
			type="button"
			class="hqp-cap speed"
			aria-label="Speed {$snapshot.rate}x"
			aria-haspopup="dialog"
			onclick={(e) => ui.openSheet('playback', e.currentTarget)}
		>
			<span class="speed-icon"><Icon name="speed" size={20} /></span>
			<span class="hqp-tnum">{rate}</span>
		</button>
	</div>
	<span class="spacer"></span>
	{#if hasEpisodes || hasNext}
		<div class="hqp-group hqp-glass">
			{#if hasEpisodes}
				<button
					type="button"
					class="hqp-cap episodes"
					aria-label="Episodes"
					aria-haspopup="dialog"
					onclick={(e) => ui.open('episodes', e.currentTarget)}
				>
					<Icon name="episodes" size={20} />
					<span class="label">Episodes</span>
				</button>
			{/if}
			{#if hasNext}
				{#if hasEpisodes}<span class="hqp-sep" aria-hidden="true"></span>{/if}
				<button
					type="button"
					class="hqp-cap next"
					aria-label="Next episode"
					onclick={() => ctx.engine.next()}
				>
					<Icon name="next" size={20} />
					<span class="label next-label">Next</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hqp-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.spacer {
		flex: 1;
	}
	.hqp-group {
		min-width: 0;
	}
	.value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tracks {
		min-width: 0;
		flex-shrink: 1;
	}
	.speed .speed-icon {
		display: none;
	}
	.hqp-cap.speed {
		padding: 0 16px;
	}
	/* Portrait: 14 px labels, speed value only, Next as a glyph; labels drop at 419 px or less. */
	:global(.hqp[data-layout^='phone-portrait']) .hqp-actions {
		margin-top: 12px;
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-cap {
		font-size: 14px;
		padding: 0 14px 0 12px;
		gap: 7px;
	}
	:global(.hqp[data-layout^='phone-portrait']) .next-label {
		display: none;
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-cap.next,
	:global(.hqp[data-layout^='phone-portrait']) .hqp-cap.speed {
		padding: 0 13px;
	}
	@media (max-width: 419px) {
		.label {
			display: none;
		}
		.hqp-cap.episodes {
			padding: 0 12px;
		}
	}
	@media (max-width: 359px) {
		.subs {
			display: none;
		}
	}
	/* Landscape and large: the speed gauge returns next to the value. */
	:global(.hqp[data-layout='phone-landscape']) .speed .speed-icon,
	:global(.hqp[data-layout='large']) .speed .speed-icon {
		display: block;
	}
	:global(.hqp[data-layout='phone-landscape']) .hqp-cap.speed {
		padding: 0 16px 0 13px;
	}
	@media (orientation: landscape) and (max-height: 379px) {
		.label {
			display: none;
		}
	}
</style>
