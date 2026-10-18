<script lang="ts">
	import { getHqpContext } from '../context';
	import { errorCopy, type ErrorAction } from '../logic/panel-labels';
	import Icon from './Icon.svelte';

	// Error cards (section 8): thick glass, centred, a rose icon tile, the server's text when
	// present, the right action, and keyboard focus on the primary action.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;
	const error = $derived($snapshot.error);
	const copy = $derived(error ? errorCopy(error) : null);
	const icon = $derived(
		error?.code === 'network' || error?.code === 'library-offline' ? 'wifi-off' : 'alert'
	);

	const LABELS: Record<ErrorAction, string> = {
		retry: 'Retry',
		back: 'Back',
		signin: 'Sign in',
		fallback: 'Try 1080p (converted)',
		copy: 'Copy details'
	};

	function focusFirst(node: HTMLElement) {
		queueMicrotask(() => node.focus({ preventScroll: true }));
	}

	function signInHref() {
		const fileId = $snapshot.item?.fileId ?? '';
		return `/auth/login?returnTo=${encodeURIComponent(`/watch/${fileId}`)}`;
	}

	async function run(action: ErrorAction) {
		switch (action) {
			case 'retry':
				await ctx.engine.retry();
				break;
			case 'back':
				ctx.close();
				break;
			case 'fallback':
				// In the error state setQuality restarts the item itself: no second retry (that would
				// start a second session).
				await ctx.engine.setQuality(error?.fallback ?? '1080p');
				break;
			case 'copy':
				try {
					await navigator.clipboard.writeText(ctx.engine.diagnostics());
					ui.toast('Details copied');
				} catch {
					ui.toast('Copy failed: clipboard unavailable');
				}
				break;
		}
	}
</script>

{#if error && copy}
	<section class="hqp-error hqp-glass--thick" role="alert" aria-labelledby="hqp-error-title">
		<span class="tile" aria-hidden="true"><Icon name={icon} size={24} /></span>
		<h2 id="hqp-error-title" class="title">{copy.title}</h2>
		{#if copy.body}<p class="body">{copy.body}</p>{/if}
		<div class="actions">
			{#each copy.actions as action, i (action)}
				{#if action === 'signin'}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="hqp-cta" href={signInHref()} use:focusFirst>{LABELS[action]}</a>
				{:else if i === 0}
					<button type="button" class="hqp-cta" use:focusFirst onclick={() => run(action)}
						>{LABELS[action]}</button
					>
				{:else}
					<button type="button" class="hqp-cta" data-variant="secondary" onclick={() => run(action)}
						>{LABELS[action]}</button
					>
				{/if}
			{/each}
		</div>
	</section>
{/if}

<style>
	.hqp-error {
		position: absolute;
		inset: 0;
		margin: auto;
		z-index: var(--hqp-z-alert);
		width: min(440px, 100cqw - 24px);
		height: fit-content;
		max-height: calc(100cqh - 120px);
		overflow: auto;
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 24px 22px 22px;
		border-radius: var(--hqp-r-panel);
		text-align: center;
		animation: hqp-err-in var(--hqp-dur-panel) var(--hqp-spring) both;
	}
	.tile {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-bottom: 4px;
		border-radius: 16px;
		color: var(--hqp-error);
		background: var(--hqp-error-soft);
		box-shadow: inset 0 0 0 var(--hqp-hairline) var(--hqp-error-soft);
	}
	.title {
		margin: 0;
		font-size: 19px;
		line-height: 24px;
		font-weight: 700;
		text-wrap: balance;
	}
	.body {
		margin: 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--hqp-ink-2);
		text-wrap: pretty;
	}
	.actions {
		display: grid;
		gap: 8px;
		width: 100%;
		margin-top: 10px;
	}
	@keyframes hqp-err-in {
		from {
			opacity: 0;
			scale: 0.96;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hqp-error {
			animation: hqp-err-fade var(--hqp-dur-fade) linear both;
		}
		@keyframes hqp-err-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
