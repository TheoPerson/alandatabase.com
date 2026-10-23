<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AUTH_ERROR_ID } from './auth-form';

	const {
		eyebrow,
		title,
		description,
		error = null,
		errorKey,
		children,
		footer
	}: {
		eyebrow: string;
		title: string;
		description?: string;
		/** Server error for the form; announced through a live region. */
		error?: string | null;
		/** Changes on every submission result, so a repeated message is announced again. */
		errorKey?: unknown;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	// Decorative poster-shaped tiles; the pages have no film data, so no artwork is shown.
	const tiles = Array.from({ length: 60 }, (_, index) => index);
</script>

<div class="auth">
	<div class="backdrop" aria-hidden="true">
		<div class="wall">
			{#each tiles as tile (tile)}
				<span class="tile"></span>
			{/each}
		</div>
	</div>

	<section class="card" aria-labelledby="auth-title">
		<header class="head">
			<p class="eyebrow">{eyebrow}</p>
			<h1 id="auth-title">{title}</h1>
			{#if description}
				<p class="description">{description}</p>
			{/if}
		</header>

		<div class="alert-region" aria-live="assertive" aria-atomic="true">
			{#key errorKey}
				{#if error}
					<p id={AUTH_ERROR_ID} class="alert">{error}</p>
				{/if}
			{/key}
		</div>

		{@render children()}

		{#if footer}
			<footer class="foot">{@render footer()}</footer>
		{/if}
	</section>
</div>

<style>
	.auth {
		position: relative;
		isolation: isolate;
		display: grid;
		place-items: center;
		min-height: calc(100svh - var(--bottom-bar-height) - var(--safe-bottom));
		/* Run the backdrop under the top bar, as the detail headers do. */
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
		padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-5)) var(--page-gutter)
			var(--space-7);
		overflow: hidden;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(70% 45% at 50% 0%, var(--brand-muted), transparent 70%),
			radial-gradient(60% 50% at 85% 100%, var(--surface-overlay), transparent 70%),
			var(--surface-canvas);
	}
	.wall {
		position: absolute;
		inset: -25% -15%;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-3);
		align-content: start;
		opacity: 0.55;
		filter: blur(3px);
		transform: rotate(-9deg);
		mask-image: radial-gradient(closest-side, transparent 30%, black 75%);
	}
	.tile {
		aspect-ratio: 2 / 3;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: linear-gradient(160deg, var(--surface-overlay), var(--surface-raised));
	}
	.tile:nth-child(3n) {
		background: linear-gradient(160deg, var(--surface-interactive), var(--surface-subtle));
	}
	.tile:nth-child(7n + 2) {
		background: linear-gradient(160deg, var(--brand-muted), var(--surface-raised));
	}
	@media (min-width: 640px) {
		.wall {
			grid-template-columns: repeat(6, 1fr);
		}
	}
	@media (min-width: 1024px) {
		.auth {
			min-height: 100svh;
		}
		.wall {
			grid-template-columns: repeat(10, 1fr);
			gap: var(--space-4);
		}
	}

	.card {
		width: min(100%, 27rem);
		min-width: 0;
		padding: clamp(var(--space-5), 6vw, var(--space-6));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--surface-raised) 80%, transparent);
		box-shadow: var(--elevation-3);
		backdrop-filter: blur(20px) saturate(1.2);
		-webkit-backdrop-filter: blur(20px) saturate(1.2);
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

	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
	}
	.description {
		margin-top: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.alert {
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent);
		border-left-width: 3px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		color: var(--content-primary);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.card > :global(form) {
		margin-top: var(--space-5);
	}
	.foot {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	.foot :global(a:not(.btn)) {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--brand-primary);
		font-weight: 700;
		text-underline-offset: 3px;
	}
	.foot :global(a:not(.btn):hover) {
		color: var(--brand-hover);
		text-decoration: underline;
	}

	/* Phone landscape (about 440px tall between two bars): a wide, top-aligned card with the
	   fields side by side, so the whole form and its submit button fit above the tab bar. */
	@media (orientation: landscape) and (max-height: 500px) {
		.auth {
			align-items: start;
			padding-top: calc(var(--top-bar-height) + var(--safe-top) + var(--space-3));
			padding-bottom: var(--space-5);
		}
		.card {
			width: min(100%, 44rem);
			padding: var(--space-4) var(--space-5);
		}
		.eyebrow,
		.description {
			display: none;
		}
		h1 {
			margin-top: 0;
			font-size: var(--text-xl);
		}
		.alert,
		.card > :global(form) {
			margin-top: var(--space-3);
		}
		.card > :global(form) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-3) var(--space-4);
		}
		.card > :global(form > :not(.field)) {
			grid-column: 1 / -1;
		}
		.foot {
			margin-top: var(--space-3);
			padding-top: 0;
			border-top: 0;
		}
	}
</style>
