<script lang="ts">
	import { getHqpContext } from '../context';

	// Eased scrims for text over the picture: landscape and large only (section 9.4). They fade
	// with the chrome; the scrub dim and the up next backdrop live here too.
	const { ui } = getHqpContext();
</script>

{#if !ui.portrait}
	<div class="hqp-scrim hqp-scrim-top hqp-fade" aria-hidden="true"></div>
	<div class="hqp-scrim hqp-scrim-bottom hqp-fade" aria-hidden="true"></div>
	{#if ui.layout === 'phone-landscape'}
		<div
			class="hqp-scrim hqp-scrim-centre hqp-fade hqp-x-scrub hqp-x-upnext"
			aria-hidden="true"
		></div>
	{/if}
	<div class="hqp-dim" aria-hidden="true"></div>
{/if}

<style>
	.hqp-scrim {
		position: absolute;
		left: 0;
		right: 0;
		z-index: var(--hqp-z-scrim);
		pointer-events: none;
	}
	.hqp-scrim-top {
		top: 0;
		height: 34%;
		background: linear-gradient(
			180deg,
			var(--hqp-scrim-a),
			var(--hqp-scrim-b) 30%,
			var(--hqp-scrim-c) 62%,
			var(--hqp-scrim-d) 84%,
			var(--hqp-scrim-0)
		);
	}
	.hqp-scrim-bottom {
		bottom: 0;
		height: 46%;
		background: linear-gradient(
			0deg,
			var(--hqp-scrim-a),
			var(--hqp-scrim-b) 34%,
			var(--hqp-scrim-c) 64%,
			var(--hqp-scrim-d) 86%,
			var(--hqp-scrim-0)
		);
	}
	.hqp-scrim-centre {
		inset: 0;
		background: radial-gradient(
			closest-side,
			var(--hqp-scrim-centre),
			var(--hqp-scrim-centre-mid) 55%,
			var(--hqp-scrim-0)
		);
		width: 70cqh;
		height: 70cqh;
		margin: auto;
	}
	:global(.hqp[data-layout='large']) .hqp-scrim-top {
		height: 26%;
	}
	:global(.hqp[data-layout='large']) .hqp-scrim-bottom {
		height: 40%;
	}
	:global(.hqp[data-upnext]) .hqp-scrim {
		opacity: 0;
		visibility: hidden;
	}

	/* Scrub dims the picture to 55% (landscape, large); a side panel dims it lightly. */
	.hqp-dim {
		position: absolute;
		inset: 0;
		z-index: var(--hqp-z-dim);
		background: var(--hqp-dim);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--hqp-dur-out) var(--hqp-ease-out);
	}
	:global(.hqp[data-scrub]) .hqp-dim {
		opacity: 0.9;
	}
	:global(.hqp[data-overlay='sheet']) .hqp-dim,
	:global(.hqp[data-overlay='episodes']) .hqp-dim {
		opacity: 0.5;
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-dim {
			transition-duration: var(--hqp-dur-fade);
		}
	}
</style>
