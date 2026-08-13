<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
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

	<Card padding="lg">
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
				<Input
					label="List Name"
					type="text"
					id="name"
					name="name"
					placeholder="e.g. Best Sci-Fi of the 90s"
					required
				/>
			</div>

			<div class="input-group mt-4">
				<label for="description" class="input-label">Description (Optional)</label>
				<textarea
					id="description"
					name="description"
					rows="3"
					placeholder="What is this list about?"
					class="textarea-field"></textarea>
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
	</Card>
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

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.mt-4 { margin-top: 1rem; }
	.mt-6 { margin-top: 1.5rem; }
	.mt-8 { margin-top: 2rem; }
	.text-right { text-align: right; }

	.input-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.textarea-field {
		padding: 0.75rem 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.95rem;
		resize: vertical;
	}

	.textarea-field:focus {
		outline: none;
		border-color: var(--accent-emerald);
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
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
		accent-color: var(--accent-emerald);
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
