<script lang="ts">
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';

	let { href, label }: { href: string; label: string } = $props();
</script>

<!-- Sits in the eyebrow slot of a sub-page header: it names the parent section and goes back
     to it, with a 44px hit area that does not push the heading down. -->
<a class="back" {href}>
	<ArrowLeftIcon size={14} strokeWidth={2.5} aria-hidden="true" />
	{label}
</a>

<style>
	.back {
		display: flex;
		width: fit-content;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--touch-target);
		/* Keep the eyebrow's line box (12px text) while the target stays 44px tall. */
		margin-block: calc((var(--touch-target) - 1.2rem) / -2);
		margin-inline-start: calc(-1 * var(--space-2));
		padding-inline: var(--space-2);
		border-radius: var(--radius-sm);
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		line-height: 1.6;
		text-decoration: none;
		text-transform: uppercase;
		transition: color var(--duration-fast) var(--ease-standard);
	}
	.back:hover {
		color: var(--brand-hover);
	}
	.back :global(svg) {
		transition: transform var(--duration-fast) var(--ease-standard);
	}
	.back:hover :global(svg) {
		transform: translateX(-2px);
	}
	@media (prefers-reduced-motion: reduce) {
		.back,
		.back :global(svg) {
			transition: none;
		}
		.back:hover :global(svg) {
			transform: none;
		}
	}
</style>
