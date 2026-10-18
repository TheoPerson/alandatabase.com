<script lang="ts">
	import { getHqpContext } from '../context';
	import { codecLabel, languageName } from '../logic/format';
	import { audioDetail, audioName, isAudioDescription } from '../logic/panel-labels';
	import { rovingGroup } from './a11y';
	import Icon from './Icon.svelte';

	// Audio & Subtitles (section 7.2): two radiogroups, the honest audio note, the Style link and
	// the footnote. Image subtitles are listed, disabled, with the reason.
	const ctx = getHqpContext();
	const { snapshot, prefs, ui } = ctx;

	const audio = $derived($snapshot.audio);
	const subs = $derived($snapshot.subtitles);
	const selectedAudio = $derived(audio.options.find((o) => o.selected));
	const hasForced = $derived(subs.options.some((o) => o.forced && o.isText));
	const auto = $derived($prefs.subtitleMode === 'auto');
	const note = $derived.by(() => {
		if (audio.mode === 'copy') return { tone: 'accent', text: 'Passed through untouched' };
		if (audio.mode === 'transcode') {
			const codec = codecLabel(selectedAudio?.codec ?? null);
			return {
				tone: 'warn',
				text: `Converted to AAC for this browser${codec ? `: it cannot decode ${codec}` : ''}`
			};
		}
		return null;
	});

	function chooseAudio(ordinal: number) {
		if (selectedAudio?.ordinal === ordinal) return;
		void ctx.engine.setAudio(ordinal);
		if (ui.layout === 'phone-portrait-short')
			ui.toast('Changing audio restarts the stream here (about 1 s)', 2400);
	}
	function chooseSubs(ordinal: number | null) {
		ctx.engine.setSubtitles(ordinal);
		const option = subs.options.find((o) => o.ordinal === ordinal);
		ui.announce(option ? `Subtitles ${languageName(option.language)}` : 'Subtitles off');
	}
	function subLabel(language: string | null, label: string) {
		const name = languageName(language);
		return name === 'Unknown' ? label || 'Unknown' : name;
	}
</script>

<div class="tracks">
	<section class="col" aria-labelledby="hqp-audio-h">
		<h3 id="hqp-audio-h" class="hqp-eyebrow heading">Audio</h3>
		<div role="radiogroup" aria-labelledby="hqp-audio-h" use:rovingGroup>
			{#each audio.options as option (option.ordinal)}
				<button
					type="button"
					class="hqp-row"
					role="radio"
					aria-checked={option.selected}
					tabindex={option.selected ? 0 : -1}
					onclick={() => chooseAudio(option.ordinal)}
				>
					<span class="hqp-row-check"><Icon name="check" size={20} /></span>
					<span class="text">
						<span class="hqp-row-label">{audioName(option)}</span>
						{#if audioDetail(option)}<span class="hqp-row-detail">{audioDetail(option)}</span>{/if}
					</span>
					<span class="hqp-row-tags">
						{#if option.isOriginal}<span
								class="hqp-tag"
								data-tone={option.selected ? 'accent' : undefined}>VO</span
							>{/if}
						{#if isAudioDescription(option)}<span class="hqp-tag">AD</span>{/if}
					</span>
				</button>
			{:else}
				<p class="empty">No audio tracks</p>
			{/each}
		</div>
		{#if note}
			<p class="note" data-tone={note.tone}>
				<span class="dot" aria-hidden="true"></span>{note.text}
			</p>
		{/if}
	</section>

	<section class="col" aria-labelledby="hqp-subs-h">
		<h3 id="hqp-subs-h" class="hqp-eyebrow heading">Subtitles</h3>
		<div role="radiogroup" aria-labelledby="hqp-subs-h" use:rovingGroup>
			<button
				type="button"
				class="hqp-row"
				role="radio"
				aria-checked={subs.selected === null}
				tabindex={subs.selected === null ? 0 : -1}
				onclick={() => chooseSubs(null)}
			>
				<span class="hqp-row-check"><Icon name="check" size={20} /></span>
				<span class="text">
					<span class="hqp-row-label">Off</span>
					{#if hasForced}<span class="hqp-row-detail">Forced lines still shown</span>{/if}
				</span>
				<span></span>
			</button>
			{#each subs.options.filter((o) => o.isText) as option (option.ordinal)}
				{@const checked = subs.selected === option.ordinal}
				<button
					type="button"
					class="hqp-row"
					role="radio"
					aria-checked={checked}
					tabindex={checked ? 0 : -1}
					onclick={() => chooseSubs(option.ordinal)}
				>
					<span class="hqp-row-check"><Icon name="check" size={20} /></span>
					<span class="text">
						<span class="hqp-row-label">{subLabel(option.language, option.label)}</span>
						{#if option.title && option.title !== option.label}
							<span class="hqp-row-detail">{option.title}</span>
						{:else if option.label}
							<span class="hqp-row-detail">{option.label}</span>
						{/if}
					</span>
					<span class="hqp-row-tags">
						{#if option.forced}<span class="hqp-tag">Forced</span>{/if}
						{#if option.sdh}<span class="hqp-tag">SDH</span>{/if}
						{#if auto && (checked || (subs.selected === null && subs.forced === option.ordinal))}
							<span class="hqp-tag" data-tone="accent">Auto</span>
						{/if}
					</span>
				</button>
			{/each}
			{#each subs.options.filter((o) => !o.isText) as option (option.ordinal)}
				<button
					type="button"
					class="hqp-row"
					role="radio"
					aria-checked="false"
					aria-disabled="true"
					tabindex="-1"
					disabled
				>
					<span class="hqp-row-check"></span>
					<span class="text">
						<span class="hqp-row-label">{subLabel(option.language, option.label)}</span>
						<span class="hqp-row-detail">Image subtitles · not supported here</span>
					</span>
					<span></span>
				</button>
			{/each}
		</div>
		<button type="button" class="hqp-row style-link" onclick={() => (ui.sheetPage = 'style')}>
			<span class="hqp-row-check style-icon"><Icon name="subtitles" size={20} /></span>
			<span class="text"><span class="hqp-row-label">Subtitle style</span></span>
			<Icon name="chevron-right" size={20} />
		</button>
	</section>
</div>
<p class="foot">
	<Icon name="refresh" size={16} />
	<span>Changing audio restarts the stream here (about 1 s). Subtitles switch instantly.</span>
</p>

<style>
	.tracks {
		flex: 1;
		min-height: 0;
		display: grid;
		align-content: start;
		gap: 4px 18px;
		padding: 0 10px 12px;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		-webkit-mask-image: linear-gradient(180deg, black calc(100% - 28px), transparent);
		mask-image: linear-gradient(180deg, black calc(100% - 28px), transparent);
	}
	.tracks::-webkit-scrollbar {
		display: none;
	}
	:global(.hqp[data-layout='phone-landscape']) .tracks,
	:global(.hqp[data-layout='large']) .tracks {
		grid-template-columns: 1fr 1fr;
	}
	.col {
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
	.empty {
		margin: 0;
		padding: 12px;
		color: var(--hqp-ink-3);
	}
	.note {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 6px 12px 4px;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-2);
	}
	.note .dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--hqp-accent);
	}
	.note[data-tone='warn'] .dot {
		background: var(--hqp-warn);
	}
	.style-link {
		margin-top: 6px;
		color: var(--hqp-ink);
	}
	.style-link .style-icon {
		opacity: 1;
		color: var(--hqp-ink-2);
	}
	.style-link :global(.hqp-icon:last-child) {
		color: var(--hqp-ink-3);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 22px;
		padding: 10px 0 14px;
		font-size: 13px;
		line-height: 17px;
		font-weight: 500;
		color: var(--hqp-ink-3);
		box-shadow: inset 0 var(--hqp-hairline) 0 var(--hqp-fill-press);
	}
	.foot :global(.hqp-icon) {
		flex: none;
	}
	:global(.hqp[data-layout^='phone-portrait']) .foot {
		padding-bottom: calc(var(--hqp-sa-b) + 4px);
	}
	:global(.hqp[data-layout='phone-portrait-short']) .foot {
		display: none;
	}
</style>
