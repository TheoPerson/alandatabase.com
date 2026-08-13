<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const movie = $derived(data.movie);
	const existingReview = $derived(data.existingReview);

	let isSubmitting = $state(false);
</script>

<div class="container review-page">
	<header class="page-header">
		<div class="movie-info">
			{#if movie.posterPath}
				<img
					src="https://image.tmdb.org/t/p/w92{movie.posterPath}"
					alt={movie.title}
					class="poster-thumb"
				/>
			{/if}
			<div>
				<h1 class="title">Review "{movie.title}"</h1>
				<p class="subtitle">Record your detailed thoughts on this film.</p>
			</div>
		</div>
		<Button href="/movies/{movie.id}" variant="ghost">← Back</Button>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="review-card glass-card">
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update, result }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						window.location.href = `/movies/${movie.id}`;
					} else {
						update();
					}
				};
			}}
		>
			<div class="input-group full-width">
				<label for="content">Your Review (Markdown supported)</label>
				<textarea
					id="content"
					name="content"
					rows="12"
					placeholder="What did you think about the film?"
					required>{existingReview?.content || ''}</textarea
				>
			</div>

			<div class="settings-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						name="containsSpoilers"
						checked={existingReview?.containsSpoilers || false}
					/>
					<div class="checkbox-text">
						<span class="label-title">Contains Spoilers</span>
						<span class="label-desc">Hide this review behind a spoiler warning.</span>
					</div>
				</label>
			</div>

			<div class="actions">
				<Button type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : existingReview ? 'Update Review' : 'Save Review'}
				</Button>
			</div>
		</form>
	</div>
</div>

<style>
	.review-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		max-width: 800px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.movie-info {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.poster-thumb {
		width: 60px;
		height: 90px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

	.review-card {
		padding: 2.5rem;
		border-radius: var(--radius-lg);
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.input-group textarea {
		padding: 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1.05rem;
		transition: all var(--transition-fast);
		font-family: inherit;
		resize: vertical;
		line-height: 1.6;
	}

	.input-group textarea:focus {
		outline: none;
		border-color: var(--border-accent);
		box-shadow: 0 0 0 3px var(--accent-gold-subtle);
	}

	.settings-group {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		margin-top: 0.25rem;
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--accent-gold);
	}

	.checkbox-text {
		display: flex;
		flex-direction: column;
	}

	.label-title {
		font-weight: 600;
		color: var(--text-primary);
	}

	.label-desc {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		margin-top: 0.25rem;
	}

	.actions {
		margin-top: 2.5rem;
		display: flex;
		justify-content: flex-end;
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
