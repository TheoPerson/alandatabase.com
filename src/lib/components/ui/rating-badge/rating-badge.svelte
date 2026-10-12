<script lang="ts">
	interface Props {
		value: string;
		source?: string;
		class?: string;
	}
	let { value, source = 'TMDB', class: className = '' }: Props = $props();
</script>

<span class="rating {className}" title="{source} rating">
	<span class="star" aria-hidden="true">★</span>
	<span class="value">{value}</span>
	<span class="sr-only">{source} rating</span>
</span>

<style>
	.rating {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-xs);
		background: rgba(8, 9, 11, 0.78);
		backdrop-filter: blur(8px);
		color: var(--content-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		line-height: 1;
	}
	.star {
		color: var(--rating-star);
	}
</style>
