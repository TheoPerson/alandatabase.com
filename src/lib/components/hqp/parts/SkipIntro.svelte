<script lang="ts">
	import { getHqpContext } from '../context';

	// Skip intro (section 7.8): a white capsule bottom right. Visible without the chrome for the
	// first 8 s of the opening chapter, then only with the chrome.
	const ctx = getHqpContext();
	const { snapshot, clock, ui } = ctx;
	const skip = $derived($snapshot.skipIntro);
	const chapterStart = $derived.by(() => {
		if (!skip) return 0;
		const chapter = $snapshot.chapters.find((c) => Math.abs(c.end - skip.end) < 0.5);
		return chapter?.start ?? 0;
	});
	const early = $derived(skip !== null && $clock.position - chapterStart < 8);
	const visible = $derived(
		skip !== null &&
			$clock.position < skip.end &&
			(early || ui.chrome) &&
			!ui.scrub &&
			!ui.locked &&
			ui.overlay === null
	);
</script>

{#if visible && skip}
	<button
		type="button"
		class="hqp-skip hqp-cta"
		onclick={() => {
			ctx.engine.seek(skip.end);
			ui.announce('Intro skipped');
		}}
	>
		Skip intro
	</button>
{/if}

<style>
	.hqp-skip {
		position: absolute;
		right: var(--hqp-edge-x);
		bottom: calc(var(--hqp-edge-bottom) + 108px);
		z-index: var(--hqp-z-toast);
		min-height: 44px;
		padding: 0 20px;
		font-size: 15px;
		box-shadow: var(--hqp-glass-shadow);
		animation: hqp-skip-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	/* Portrait: on the picture's bottom right corner, clear of the transport. */
	:global(.hqp[data-layout^='phone-portrait']) .hqp-skip {
		right: 12px;
		bottom: auto;
		top: calc(var(--frame-bottom) - 56px);
	}
	:global(.hqp[data-layout='large']) .hqp-skip {
		bottom: 132px;
	}
	@keyframes hqp-skip-in {
		from {
			opacity: 0;
			translate: 6px 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-skip {
			animation: none;
		}
	}
</style>
