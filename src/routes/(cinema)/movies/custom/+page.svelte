<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let isSubmitting = $state(false);
	let { form } = $props();
</script>

<svelte:head>
	<title>Add Custom Movie | CinemaDB</title>
</svelte:head>

<div class="container custom-movie-page">
	<div class="page-header">
		<h1 class="page-title">Add Custom Source</h1>
		<p class="page-subtitle">Manually import a movie bypassing the TMDB registry.</p>
	</div>

	<div class="form-wrapper glass-card">
		<form
			method="POST"
			action="?/createCustomMovie"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
				};
			}}
			class="custom-movie-form"
		>
			{#if form?.error}
				<div class="error-banner">
					{form.error}
				</div>
			{/if}

			<div class="form-grid">
				<div class="input-group full-width">
					<Input
						label="Movie Title *"
						name="title"
						id="title"
						placeholder="e.g., My Private Movie"
						required
					/>
				</div>

				<div class="input-group full-width">
					<Input
						label="Custom Video Embed URL (iFrame Source) *"
						name="customVideoUrl"
						id="customVideoUrl"
						type="url"
						placeholder="https://..."
						required
					/>
				</div>

				<div class="input-group">
					<Input
						label="Poster Image URL *"
						name="posterUrl"
						id="posterUrl"
						type="url"
						placeholder="https://..."
						required
					/>
				</div>

				<div class="input-group">
					<Input
						label="Backdrop Image URL"
						name="backdropUrl"
						id="backdropUrl"
						type="url"
						placeholder="https://..."
					/>
				</div>

				<div class="input-group">
					<Input
						label="Release Year"
						name="releaseYear"
						id="releaseYear"
						type="number"
						min="1800"
						max="2100"
						placeholder="2026"
					/>
				</div>

				<div class="input-group">
					<Input
						label="Runtime (Minutes)"
						name="runtime"
						id="runtime"
						type="number"
						min="1"
						placeholder="120"
					/>
				</div>

				<div class="input-group full-width">
					<label for="overview" class="textarea-label">Synopsis / Overview</label>
					<textarea
						id="overview"
						name="overview"
						rows="4"
						class="oled-textarea"
						placeholder="A brief description of this movie..."
					></textarea>
				</div>
				
				<div class="input-group checkbox-group full-width">
					<label class="checkbox-label">
						<input type="checkbox" name="isAdult" value="true" checked class="oled-checkbox" />
						<span>Mark as Adult Content (18+)</span>
					</label>
				</div>
			</div>

			<div class="form-actions">
				<Button type="button" variant="ghost" href="/movies">Cancel</Button>
				<Button type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? 'Creating...' : 'Add Custom Movie'}
				</Button>
			</div>
		</form>
	</div>
</div>

<style>
	.custom-movie-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 3rem 1rem;
	}

	.page-header {
		margin-bottom: 2.5rem;
		text-align: center;
	}

	.page-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: #ffffff;
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
	}

	.page-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
	}

	.form-wrapper {
		padding: 2.5rem;
		background: var(--bg-surface-1);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-md);
	}

	.error-banner {
		padding: 1rem;
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.2);
		color: #f87171;
		border-radius: var(--radius-md);
		margin-bottom: 2rem;
		font-weight: 500;
		text-align: center;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 640px) {
		.form-grid {
			grid-template-columns: 1fr 1fr;
		}
		
		.full-width {
			grid-column: span 2;
		}
	}

	.textarea-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.oled-textarea {
		width: 100%;
		padding: 0.85rem 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.95rem;
		transition: all var(--transition-fast);
		resize: vertical;
	}

	.oled-textarea:focus {
		outline: none;
		border-color: var(--border-emerald);
		background: var(--bg-surface-3);
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
	}

	.checkbox-group {
		margin-top: 0.5rem;
		padding: 1rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-weight: 500;
		color: var(--text-primary);
	}

	.oled-checkbox {
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--accent-emerald);
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
	}
</style>
