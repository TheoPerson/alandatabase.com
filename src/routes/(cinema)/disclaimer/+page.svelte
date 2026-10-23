<script lang="ts">
	import Button from '$lib/components/ui/button';
	import { enhance } from '$app/forms';
	import ShieldIcon from 'lucide-svelte/icons/shield-check';

	let { data } = $props();
	let isSubmitting = $state(false);

	function goBack() {
		if (window.history.length > 1) window.history.back();
		else window.location.href = '/';
	}
</script>

<svelte:head>
	<title>Content notice | Alan's Database</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="gate">
	<section class="card" aria-labelledby="gate-title">
		<span class="mark" aria-hidden="true"><ShieldIcon size={24} /></span>
		<p class="eyebrow">Before you continue</p>
		<h1 id="gate-title">Content notice</h1>
		<p class="copy">
			Alan’s Database includes mature themes, R-rated films and explicit series. Adult and explicit
			records stay quarantined, outside the standard catalogue, search and recommendations.
		</p>
		<p class="consent">
			By continuing, you confirm that you are of legal age and agree to see mature content.
		</p>

		<form
			method="POST"
			action="?/accept"
			class="actions"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					isSubmitting = false;
					await update();
				};
			}}
		>
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<Button type="submit" size="lg" loading={isSubmitting}>
				{isSubmitting ? 'Entering' : 'I agree, enter'}
			</Button>
			<Button type="button" variant="ghost" size="lg" onclick={goBack}>Go back</Button>
		</form>
	</section>
</div>

<style>
	/* Covers the cinema chrome on purpose: nothing behind it is reachable until accepted. */
	.gate {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		display: grid;
		place-items: center;
		min-height: 100dvh;
		overflow-y: auto;
		padding: max(var(--space-6), var(--safe-top)) var(--page-gutter)
			max(var(--space-6), var(--safe-bottom));
		background:
			radial-gradient(70% 45% at 50% 0%, var(--brand-muted), transparent 70%), var(--surface-canvas);
	}
	.card {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		width: min(100%, 28rem);
		padding: var(--space-6) var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-raised);
		box-shadow: var(--elevation-3);
		text-align: center;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		margin-bottom: var(--space-2);
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	.copy {
		color: var(--content-secondary);
		line-height: 1.6;
	}
	.consent {
		width: 100%;
		margin-top: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border-subtle);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--surface-subtle);
		color: var(--content-primary);
		font-size: var(--text-sm);
		line-height: 1.5;
		text-align: start;
	}
	/* Always stacked, primary on top: two long labels never squeeze side by side. */
	.actions {
		display: grid;
		gap: var(--space-2);
		width: 100%;
		margin-top: var(--space-3);
	}
	.actions :global(.btn) {
		width: 100%;
	}
	@media (prefers-reduced-motion: no-preference) {
		.card {
			animation: rise var(--duration-slow) var(--ease-out) both;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
