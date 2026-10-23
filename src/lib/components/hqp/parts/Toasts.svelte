<script lang="ts">
	import { getHqpContext } from '../context';
	import { bufferAhead } from '../logic/timeline';
	import Icon from './Icon.svelte';

	// Toasts and status pills (sections 7.9, 8): top centre under the top bar, regular glass, one at
	// a time. Engine toasts (quality, audio, errors) and UI toasts (Fit/Fill, hints) share the slot.
	const ctx = getHqpContext();
	const { snapshot, clock, ui } = ctx;

	const current = $derived.by(() => {
		const local = ui.toasts[0];
		if (local)
			return {
				key: `u${local.id}`,
				text: local.text,
				action: local.action,
				kind: 'info',
				dismiss: () => ui.dismissToast(local.id)
			};
		const remote = $snapshot.toasts[0];
		if (remote)
			return {
				key: `e${remote.id}`,
				text: remote.text,
				action: remote.action,
				kind: remote.kind,
				dismiss: () => ctx.engine.dismissToast(remote.id)
			};
		return null;
	});
	const offline = $derived(!$snapshot.online);
	const buffered = $derived(Math.round(bufferAhead($clock)));
</script>

<div class="hqp-toasts" aria-live="polite">
	{#if offline}
		<div class="toast hqp-glass" data-kind="warning">
			<Icon name="wifi-off" size={18} />
			<span>Offline · <span class="hqp-tnum">{buffered}</span> s buffered</span>
		</div>
	{:else if current}
		{#key current.key}
			<div class="toast hqp-glass" data-kind={current.kind}>
				{#if current.kind === 'error'}<Icon name="alert" size={18} />{/if}
				<span class="text">{current.text}</span>
				{#if current.action}
					<span class="sep" aria-hidden="true"></span>
					<button
						type="button"
						class="action"
						onclick={() => {
							current.action?.run();
							current.dismiss();
						}}>{current.action.label}</button
					>
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.hqp-toasts {
		position: absolute;
		left: var(--hqp-edge-x);
		right: var(--hqp-edge-x);
		top: 24px;
		z-index: var(--hqp-z-toast);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	:global(.hqp[data-layout^='phone-portrait']) .hqp-toasts {
		top: calc(var(--hqp-edge-top) + 62px);
	}
	:global(.hqp[data-layout='phone-landscape']) .hqp-toasts {
		top: 66px;
	}
	:global(.hqp[data-layout='large']) .hqp-toasts {
		top: 28px;
	}
	.toast {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		max-width: min(560px, 100%);
		padding: 0 16px;
		border-radius: var(--hqp-r-capsule);
		font-size: 14px;
		line-height: 18px;
		font-weight: 600;
		pointer-events: auto;
		animation: hqp-toast-in var(--hqp-dur-in) var(--hqp-ease-out) both;
	}
	.toast[data-kind='warning'] :global(.hqp-icon) {
		color: var(--hqp-warn);
	}
	.toast[data-kind='error'] :global(.hqp-icon) {
		color: var(--hqp-error);
	}
	.text {
		padding: 10px 0;
		text-wrap: balance;
	}
	.sep {
		flex: none;
		width: var(--hqp-hairline);
		height: 18px;
		background: var(--hqp-glass-rim);
	}
	.action {
		flex: none;
		height: 44px;
		margin: -2px -8px -2px 0;
		padding: 0 8px;
		font-weight: 700;
		color: var(--hqp-ink);
	}
	@keyframes hqp-toast-in {
		from {
			opacity: 0;
			translate: 0 -6px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation-name: hqp-toast-fade;
		}
		@keyframes hqp-toast-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
