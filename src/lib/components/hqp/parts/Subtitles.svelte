<script lang="ts">
	import { getHqpContext } from '../context';
	import { frenchTypography, isFrench } from '../logic/format';

	// Visual captions rendered from the engine's cues inside the frame (a size container, so cqh is
	// the picture height). aria-hidden: native <track>s carry the accessible captions.
	const { snapshot, cues, prefs, ui } = getHqpContext();

	const SIZES = { s: '4.2cqh', m: '4.8cqh', l: '5.6cqh', xl: '6.4cqh' } as const;
	const style = $derived($prefs.subtitleStyle);
	const subs = $derived($snapshot.subtitles);
	const language = $derived.by(() => {
		const ordinal = subs.selected ?? subs.forced;
		return subs.options.find((o) => o.ordinal === ordinal)?.language ?? null;
	});
	const french = $derived(isFrench(language));
	const sample = $derived(ui.overlay === 'sheet' && ui.sheetPage === 'style' && $cues.length === 0);
	const lifted = $derived(style.position === 'auto' && ui.chrome && !ui.locked);
	const hidden = $derived(ui.scrub !== null || $snapshot.upNext !== null);

	const fix = (text: string) => (french ? frenchTypography(text) : text);
</script>

<div
	class="hqp-subs"
	aria-hidden="true"
	data-look={style.background}
	data-color={style.color}
	data-low={style.position === 'low' ? '' : undefined}
	data-lifted={lifted ? '' : undefined}
	data-hidden={hidden ? '' : undefined}
	style:--hqp-sub-size={SIZES[style.size]}
>
	{#if sample}
		<p class="cue"><span class="line">Subtitles look like this.</span></p>
	{/if}
	{#each $cues as cue (cue.id)}
		<p class="cue">
			{#each cue.lines as line, i (i)}
				<span class="line"
					>{#each line as span, j (j)}{#if span.italic && span.bold}<b><i>{fix(span.text)}</i></b
							>{:else if span.italic}<i>{fix(span.text)}</i>{:else if span.bold}<b
								>{fix(span.text)}</b
							>{:else}{fix(span.text)}{/if}{/each}</span
				>
			{/each}
		</p>
	{/each}
</div>

<style>
	.hqp-subs {
		position: absolute;
		left: 6%;
		right: 6%;
		bottom: 6.5cqh;
		z-index: var(--hqp-z-subs);
		display: grid;
		justify-items: center;
		gap: 0.2em;
		text-align: center;
		pointer-events: none;
		font-family: var(--hqp-caption-font);
		font-size: clamp(15px, var(--hqp-sub-size, 4.8cqh), 44px);
		line-height: 1.22;
		font-weight: 600;
		letter-spacing: 0.005em;
		color: var(--hqp-sub-white);
		text-shadow: var(--hqp-sub-shadow);
		text-wrap: balance;
		transition:
			translate var(--hqp-dur-out) var(--hqp-ease-out),
			opacity var(--hqp-dur-in) var(--hqp-ease-out);
	}
	.hqp-subs[data-lifted] {
		translate: 0 calc(-1 * var(--hqp-sub-lift));
	}
	.hqp-subs[data-low] {
		bottom: 3cqh;
	}
	.hqp-subs[data-hidden] {
		opacity: 0;
	}
	.hqp-subs[data-color='yellow'] {
		color: var(--hqp-sub-yellow);
	}
	.hqp-subs[data-look='outline'] {
		text-shadow: var(--hqp-sub-outline);
	}
	.hqp-subs[data-look='box'] {
		text-shadow: none;
	}
	.cue {
		margin: 0;
		display: grid;
		justify-items: center;
	}
	.line {
		display: block;
		max-width: 100%;
	}
	.hqp-subs[data-look='box'] .cue {
		gap: 0.08em;
	}
	.hqp-subs[data-look='box'] .line {
		width: fit-content;
		padding: 0.04em 0.32em 0.08em;
		border-radius: 6px;
		background: var(--hqp-sub-box);
	}
	/* Side panels: captions move into the free area left of the panel. Inside the frame, 100% is the
	   frame width and vw the player width, so the panel edge maps into frame coordinates. */
	:global(.hqp[data-layout='phone-landscape']:is([data-overlay='sheet'], [data-overlay='episodes']))
		.hqp-subs {
		left: 3%;
		right: calc((100vw + 100%) / 2 - 100vw + var(--hqp-edge-x) + min(560px, 60vw) + 16px);
	}
	:global(.hqp[data-layout='phone-landscape'][data-info]) .hqp-subs {
		left: 3%;
		right: calc((100vw + 100%) / 2 - 100vw + var(--hqp-edge-x) + 380px + 16px);
	}
	:global(.hqp[data-layout='large']:is([data-overlay='sheet'], [data-overlay='episodes']))
		.hqp-subs {
		left: 4%;
		right: calc((100vw + 100%) / 2 - 100vw + var(--hqp-edge-x) + min(600px, 100vw - 96px) + 24px);
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-subs {
			transition: opacity var(--hqp-dur-fade) linear;
		}
	}
</style>
