<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';

	interface Props {
		title: string;
		eyebrow?: string;
		seeAllHref?: string;
		seeAllLabel?: string;
		id?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		title,
		eyebrow,
		seeAllHref,
		seeAllLabel = 'See all',
		id,
		class: className = '',
		children
	}: Props = $props();

	const headingId = $derived(`${id ?? title.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}-heading`);
</script>

<section class="section {className}" {id} aria-labelledby={headingId}>
	<header class="head">
		<div>
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h2 class="title" id={headingId}>{title}</h2>
		</div>
		{#if seeAllHref}
			<a class="see-all" href={seeAllHref}>
				<span>{seeAllLabel}</span>
				<ChevronRightIcon size={16} aria-hidden="true" />
			</a>
		{/if}
	</header>
	{@render children?.()}
</section>

<style>
	.section {
		content-visibility: auto;
		contain-intrinsic-size: auto 320px;
		margin-block: var(--space-7);
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		padding-inline: var(--page-gutter);
		margin-bottom: var(--space-4);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 700;
		transition: color var(--duration-base) var(--ease-out);
	}
	.see-all:hover {
		color: var(--brand-primary);
	}
</style>
