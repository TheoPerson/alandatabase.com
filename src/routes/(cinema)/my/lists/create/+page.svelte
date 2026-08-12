<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { form } = $props();
	let isSubmitting = $state(false);
</script>

<div class="container create-page">
	<header class="page-header">
		<div>
			<h1 class="title">Create New List</h1>
			<p class="subtitle">Organize movies your way.</p>
		</div>
		<Button href="/my/lists" variant="ghost">← Cancel</Button>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="form-card glass-panel">
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update, result }) => {
					isSubmitting = false;
					if (result.type === 'success' && result.data?.listId) {
						window.location.href = `/my/lists/${result.data.listId}`;
					} else {
						update();
					}
				};
			}}
		>
			<div class="input-group">
				<label for="name">List Name</label>
				<input
					type="text"
					id="name"
					name="name"
					placeholder="e.g. Best Sci-Fi of the 90s"
					required
				/>
			</div>

			<div class="input-group mt-4">
				<label for="description">Description (Optional)</label>
				<textarea
					id="description"
					name="description"
					rows="3"
					placeholder="What is this list about?"></textarea>
			</div>

			<div class="settings-group mt-6">
				<label class="checkbox-label">
					<input type="checkbox" name="isPublic" />
					<div class="checkbox-text">
						<span class="label-title">Public List</span>
						<span class="label-desc">Allow anyone to view this list.</span>
					</div>
				</label>
			</div>

			<div class="actions mt-8 text-right">
				<Button type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? 'Creating...' : 'Create List'}
				</Button>
			</div>
		</form>
	</div>
</div>

<style>
	.create-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		max-width: 600px;
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
	}

	.subtitle {
		color: var(--text-secondary);
	}

	.form-card {
		padding: 2.5rem;
		border-radius: var(--radius-lg);
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.input-group input,
	.input-group textarea {
		padding: 0.75rem 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 1rem;
	}

	.input-group input:focus,
	.input-group textarea:focus {
		outline: none;
		border-color: var(--border-accent);
		box-shadow: 0 0 0 3px var(--accent-gold-subtle);
	}

	.settings-group {
		border-top: 1px solid var(--border-subtle);
		padding-top: 1.5rem;
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

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
		padding: 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(239, 68, 68, 0.3);
		margin-bottom: 2rem;
	}
</style>
