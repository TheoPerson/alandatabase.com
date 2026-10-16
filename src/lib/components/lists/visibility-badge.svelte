<script lang="ts">
	import GlobeIcon from 'lucide-svelte/icons/globe';
	import LockIcon from 'lucide-svelte/icons/lock';

	let { isPublic }: { isPublic: boolean } = $props();
</script>

<span class="badge" class:public={isPublic}>
	{#if isPublic}
		<GlobeIcon size={12} aria-hidden="true" />
		Public
	{:else}
		<LockIcon size={12} aria-hidden="true" />
		Private
	{/if}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.public {
		border-color: var(--brand-border);
		color: var(--brand-primary);
	}
</style>
