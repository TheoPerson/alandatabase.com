<script lang="ts">
	import { formatTime } from '$lib/player/format-time';
	import { getHqpContext } from '../context';

	// "Resumed at 41:12 · Start over" for 6 s (section 7.7): under the title block in portrait
	// (TitleBlock renders it in place of the badges), above the timeline elsewhere.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;
	const resume = $derived($snapshot.resume);

	let expired = $state(false);
	$effect(() => {
		expired = false;
		if (!resume) return;
		const left = resume.until - Date.now();
		if (left <= 0) {
			expired = true;
			return;
		}
		if (left > 2_147_000_000) return;
		const timer = setTimeout(() => (expired = true), left);
		return () => clearTimeout(timer);
	});
	const shown = $derived(resume !== null && !expired && $snapshot.status !== 'error');

	function startOver() {
		ctx.engine.startOver();
		ui.announce('Playing from the start');
		expired = true;
	}
</script>

{#if shown && resume}
	<div class="hqp-resume hqp-glass" data-portrait={ui.portrait ? '' : undefined}>
		<span class="text">Resumed at <span class="hqp-tnum">{formatTime(resume.from)}</span></span>
		<span class="sep" aria-hidden="true"></span>
		<button type="button" class="start" onclick={startOver}>Start over</button>
	</div>
{/if}

<style>
	.hqp-resume {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 36px;
		padding: 0 0 0 14px;
		border-radius: var(--hqp-r-capsule);
		font-size: 14px;
		line-height: 18px;
		font-weight: 600;
		white-space: nowrap;
		animation: hqp-resume-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	.hqp-resume:not([data-portrait]) {
		position: absolute;
		left: var(--hqp-edge-x);
		bottom: calc(var(--hqp-edge-bottom) + 108px);
		z-index: var(--hqp-z-toast);
	}
	:global(.hqp[data-layout='large']) .hqp-resume:not([data-portrait]) {
		bottom: 132px;
	}
	:global(.hqp:is([data-overlay='sheet'], [data-overlay='episodes'])) .hqp-resume,
	:global(.hqp[data-scrub]) .hqp-resume {
		visibility: hidden;
	}
	.text {
		color: var(--hqp-ink-2);
	}
	.text .hqp-tnum {
		color: var(--hqp-ink);
	}
	.sep {
		width: var(--hqp-hairline);
		height: 18px;
		margin-left: 8px;
		background: var(--hqp-glass-rim);
	}
	.start {
		height: 44px;
		margin: -4px 0;
		padding: 0 16px 0 10px;
		font-weight: 700;
		color: var(--hqp-ink);
		border-radius: var(--hqp-r-capsule);
	}
	@keyframes hqp-resume-in {
		from {
			opacity: 0;
			translate: 0 6px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-resume {
			animation-name: hqp-resume-fade;
		}
		@keyframes hqp-resume-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
