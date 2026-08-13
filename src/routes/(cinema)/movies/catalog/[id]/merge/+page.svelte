<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const movie = $derived(data.sourceMovie);

	let isSubmitting = $state(false);
</script>

<div class="container merge-page">
	<header class="page-header">
		<div>
			<h1 class="title">Merge Duplicate Movie</h1>
			<p class="subtitle">Merge "{movie.title}" into another correct entry.</p>
		</div>
		<Button href="/movies/{movie.id}" variant="ghost">← Back</Button>
	</header>

	<div class="warning-banner glass-card">
		<span class="icon">⚠️</span>
		<div class="banner-text">
			<strong>Warning: This action is destructive.</strong>
			<p>
				Merging will reassign all your reviews, lists, and ratings from this movie into the target
				movie. Afterwards, <em>this</em> movie record will be permanently deleted from the local database.
			</p>
		</div>
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="merge-card glass-card">
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update, result }) => {
					isSubmitting = false;
					if (result.type === 'success' && result.data?.newId) {
						window.location.href = `/movies/${result.data.newId}`;
					} else {
						update();
					}
				};
			}}
		>
			<div class="input-group">
				<label for="targetTmdbId">Target TMDB ID</label>
				<p class="help-text">
					Enter the TMDB ID of the movie you want to merge into. (e.g. 27205 for Inception)
				</p>
				<input
					type="number"
					id="targetTmdbId"
					name="targetTmdbId"
					placeholder="e.g. 27205"
					required
				/>
			</div>

			<div class="actions">
				<Button type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? 'Merging...' : 'Merge & Delete Duplicate'}
				</Button>
			</div>
		</form>
	</div>
</div>

<style>
	.merge-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		max-width: 700px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--text-secondary);
	}

	.warning-banner {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem;
		background: rgba(245, 158, 11, 0.1);
		border-left: 4px solid var(--accent-gold);
		margin-bottom: 2rem;
	}

	.warning-banner .icon {
		font-size: 1.5rem;
	}

	.banner-text p {
		margin-top: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.merge-card {
		padding: 2.5rem;
		border-radius: var(--radius-lg);
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.help-text {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		margin-bottom: 0.5rem;
	}

	.input-group input {
		padding: 0.75rem 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		font-family: inherit;
		max-width: 300px;
	}

	.input-group input:focus {
		outline: none;
		border-color: var(--border-accent);
		box-shadow: 0 0 0 3px var(--accent-gold-subtle);
	}

	.actions {
		margin-top: 2.5rem;
		display: flex;
		justify-content: flex-start;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
		padding: 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(239, 68, 68, 0.3);
		margin-bottom: 2rem;
	}
</style>
