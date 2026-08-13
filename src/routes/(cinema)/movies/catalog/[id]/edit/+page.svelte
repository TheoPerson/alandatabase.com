<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const movie = $derived(data.movie);

	// Populate inputs with current effective values (overrides take precedence over official TMDB)
	const currentTitle = $derived(movie.localOverrides?.title || movie.title);
	const currentOriginalTitle = $derived(movie.localOverrides?.originalTitle || movie.originalTitle);
	const currentReleaseDate = $derived(movie.localOverrides?.releaseDate || movie.releaseDate);
	const currentOverview = $derived(movie.localOverrides?.overview || movie.overview);

	let isSubmitting = $state(false);
</script>

<div class="container edit-page">
	<header class="page-header">
		<div>
			<h1 class="title">Edit Metadata</h1>
			<p class="subtitle">Override the official TMDB data for "{movie.title}".</p>
		</div>
		<Button href="/movies/{movie.id}" variant="ghost">← Back to Movie</Button>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="edit-card glass-card">
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					isSubmitting = false;
					update();
				};
			}}
		>
			<div class="form-grid">
				<div class="input-group">
					<label for="title">Title</label>
					<input type="text" id="title" name="title" value={currentTitle} />
				</div>

				<div class="input-group">
					<label for="originalTitle">Original Title</label>
					<input type="text" id="originalTitle" name="originalTitle" value={currentOriginalTitle} />
				</div>

				<div class="input-group">
					<label for="releaseDate">Release Date</label>
					<input type="date" id="releaseDate" name="releaseDate" value={currentReleaseDate} />
				</div>

				<div class="input-group full-width">
					<label for="overview">Overview</label>
					<textarea id="overview" name="overview" rows="6">{currentOverview}</textarea>
				</div>
			</div>

			<div class="settings-group">
				<label class="checkbox-label">
					<input type="checkbox" name="isLocked" checked={movie.isLocked} />
					<div class="checkbox-text">
						<span class="label-title">Lock Record</span>
						<span class="label-desc"
							>Prevent background worker from updating this movie in the future.</span
						>
					</div>
				</label>
			</div>

			<div class="actions">
				<Button type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Overrides'}
				</Button>
			</div>
		</form>
	</div>
</div>

<style>
	.edit-page {
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

	.title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--text-secondary);
	}

	.edit-card {
		padding: 2.5rem;
		border-radius: var(--radius-lg);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 600px) {
		.form-grid {
			grid-template-columns: 1fr 1fr;
		}
		.full-width {
			grid-column: 1 / -1;
		}
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

	.input-group input,
	.input-group textarea {
		padding: 0.75rem 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all var(--transition-fast);
		font-family: inherit;
	}

	.input-group input:focus,
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
