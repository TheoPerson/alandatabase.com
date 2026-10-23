<script lang="ts">
	import { getHqpContext } from '../context';

	// After 3 autoplays without input (section 7.4): "Still watching?" and no autoplay.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	function focusFirst(node: HTMLElement) {
		queueMicrotask(() => node.focus({ preventScroll: true }));
	}
</script>

{#if $snapshot.stillWatching && !$snapshot.error}
	<div
		class="hqp-card hqp-glass--thick"
		role="alertdialog"
		aria-labelledby="hqp-still-title"
		aria-describedby="hqp-still-body"
	>
		<h2 id="hqp-still-title" class="title">Still watching?</h2>
		<p id="hqp-still-body" class="body">
			{$snapshot.item?.showTitle ?? $snapshot.item?.title ?? ''} paused after three episodes in a row.
		</p>
		<div class="actions">
			<button
				type="button"
				class="hqp-cta"
				use:focusFirst
				onclick={() => {
					ctx.engine.confirmStillWatching();
					ui.announce('Continuing');
				}}>Continue</button
			>
			<button type="button" class="hqp-cta" data-variant="secondary" onclick={() => ctx.close()}
				>Stop</button
			>
		</div>
	</div>
{/if}

<style>
	.hqp-card {
		position: absolute;
		inset: 0;
		margin: auto;
		z-index: var(--hqp-z-alert);
		width: min(420px, 100cqw - 24px);
		height: fit-content;
		display: grid;
		gap: 10px;
		padding: 22px;
		border-radius: var(--hqp-r-panel);
		text-align: center;
		animation: hqp-pop var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	/* Portrait: in place of the title block and the transport, under the picture. */
	:global(.hqp[data-layout='phone-portrait']) .hqp-card {
		top: calc(var(--frame-bottom) + 18px);
		right: 12px;
		bottom: auto;
		left: 12px;
		width: auto;
		margin: 0;
	}
	.title {
		margin: 0;
		font-size: 22px;
		line-height: 27px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.body {
		margin: 0 0 6px;
		font-size: 15px;
		line-height: 20px;
		color: var(--hqp-ink-2);
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	@keyframes hqp-pop {
		from {
			opacity: 0;
			scale: 0.96;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-card {
			animation: hqp-fade var(--hqp-dur-fade) linear both;
		}
		@keyframes hqp-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
