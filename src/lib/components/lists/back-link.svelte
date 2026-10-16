<script lang="ts">
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';

	let { href, label }: { href: string; label: string } = $props();
</script>

<a class="back" {href}>
	<ArrowLeftIcon size={16} aria-hidden="true" />
	{label}
</a>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--touch-target);
		margin-inline-start: calc(-1 * var(--space-2));
		padding-inline: var(--space-2);
		border-radius: var(--radius-sm);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		transition: color var(--duration-fast) var(--ease-standard);
	}
	.back:hover {
		color: var(--content-primary);
	}
	@media (prefers-reduced-motion: reduce) {
		.back {
			transition: none;
		}
	}
</style>
