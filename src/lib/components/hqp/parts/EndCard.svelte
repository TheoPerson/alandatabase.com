<script lang="ts">
	import { getHqpContext } from '../context';
	import { titleText } from '../logic/format';
	import Icon from './Icon.svelte';

	// End card (section 7.5): films and the last episode. The picture dims (Frame end veil).
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;
	const item = $derived($snapshot.item);
	const shown = $derived(
		$snapshot.status === 'ended' &&
			!$snapshot.upNext &&
			!$snapshot.stillWatching &&
			!$snapshot.error
	);
	const backLabel = $derived(
		item?.kind === 'episode' ? (item.showTitle ?? item.title) : (item?.title ?? 'the title')
	);

	function focusFirst(node: HTMLElement) {
		queueMicrotask(() => node.focus({ preventScroll: true }));
	}
	function again() {
		ctx.engine.startOver();
		void ctx.engine.play();
		ui.announce('Playing again from the start');
	}
</script>

{#if shown && item}
	<section class="hqp-end hqp-glass--thick" aria-labelledby="hqp-end-title">
		<p class="eyebrow">Finished</p>
		<h2 id="hqp-end-title" class="title">{titleText(item.title)}</h2>
		<div class="actions">
			<!-- titleHref is a server-built in-site path from the launch payload -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="hqp-cta" href={item.titleHref} use:focusFirst>Back to {backLabel}</a>
			<button type="button" class="hqp-cta" data-variant="secondary" onclick={again}>
				<Icon name="refresh" size={18} />Watch again
			</button>
		</div>
	</section>
{/if}

<style>
	.hqp-end {
		position: absolute;
		inset: 0;
		margin: auto;
		z-index: var(--hqp-z-panel);
		width: min(460px, 100cqw - 24px);
		height: fit-content;
		display: grid;
		gap: 8px;
		padding: 22px;
		border-radius: var(--hqp-r-panel);
		text-align: center;
		animation: hqp-end-in var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	/* Portrait: in place of the title block and the transport, under the picture. */
	:global(.hqp[data-layout='phone-portrait']) .hqp-end {
		top: calc(var(--frame-bottom) + 18px);
		right: 12px;
		bottom: auto;
		left: 12px;
		width: auto;
		margin: 0;
	}
	.eyebrow {
		margin: 0;
		font-size: 12px;
		line-height: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hqp-accent);
	}
	.title {
		margin: 0 0 10px;
		font-size: 22px;
		line-height: 27px;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}
	.actions {
		display: grid;
		gap: 8px;
	}
	.actions .hqp-cta {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@keyframes hqp-end-in {
		from {
			opacity: 0;
			scale: 0.96;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-end {
			animation: hqp-end-fade var(--hqp-dur-fade) linear both;
		}
		@keyframes hqp-end-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
