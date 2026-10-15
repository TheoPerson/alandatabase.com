<script lang="ts">
	import { errorCopy } from '$lib/errors/copy';
	import Button from '../button/button.svelte';
	import Logo from '../logo/logo.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import HomeIcon from 'lucide-svelte/icons/house';
	import RefreshIcon from 'lucide-svelte/icons/refresh-cw';

	interface Props {
		status: number;
		message?: string;
		// Pages outside the cinema layout have no top bar, so the card carries the brand itself.
		standalone?: boolean;
	}

	let { status, message, standalone = false }: Props = $props();

	const copy = $derived(errorCopy(status, message));

	function goBack() {
		if (window.history.length > 1) window.history.back();
		else window.location.href = '/';
	}
</script>

<svelte:head>
	<title>{status} | Alan's Database</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="error-page" class:standalone aria-labelledby="error-title">
	{#if standalone}
		<a href="/" class="brand" aria-label="Alan's Database home">
			<Logo size={28} />
			<span class="word">ALAN<span class="accent">DB</span></span>
		</a>
	{/if}
	<p class="code" aria-label={`Error ${status}`}>{status}</p>
	<h1 id="error-title">{copy.title}</h1>
	<p class="description">{copy.description}</p>
	<div class="actions">
		{#if copy.retryable}
			<Button onclick={() => window.location.reload()}>
				<RefreshIcon size={18} aria-hidden="true" />
				Try again
			</Button>
		{:else}
			<Button href="/">
				<HomeIcon size={18} aria-hidden="true" />
				Back to home
			</Button>
		{/if}
		<Button variant="outline" onclick={goBack}>
			<ArrowLeftIcon size={18} aria-hidden="true" />
			Go back
		</Button>
		{#if copy.retryable}
			<Button variant="ghost" href="/">Home</Button>
		{:else}
			<Button variant="ghost" href="/movies">Browse movies</Button>
		{/if}
	</div>
</section>

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60dvh;
		padding: calc(var(--top-bar-height) + var(--space-7)) var(--page-gutter) var(--space-8);
		text-align: center;
	}
	.standalone {
		min-height: 100dvh;
		padding-top: var(--space-7);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: var(--space-7);
		font-weight: 900;
		letter-spacing: 0.04em;
	}
	.accent {
		color: var(--brand-primary);
	}
	.code {
		color: var(--brand-primary);
		font-size: var(--type-display);
		font-weight: 900;
		line-height: 1;
		letter-spacing: var(--tracking-tight);
	}
	h1 {
		margin-top: var(--space-3);
		font-size: var(--type-headline);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.description {
		max-width: 34rem;
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--type-body);
		line-height: 1.6;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}
</style>
