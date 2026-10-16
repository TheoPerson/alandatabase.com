<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import Button from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import BackLink from '$lib/components/lists/back-link.svelte';
	import ListField from '$lib/components/lists/list-field.svelte';
	import {
		LIST_DESCRIPTION_MAX,
		LIST_NAME_MAX,
		validateListForm,
		type ListFormProblem
	} from '$lib/components/lists/list-form';
	import { addToast } from '$lib/stores/toast';

	let { form } = $props();

	let name = $state('');
	let description = $state('');
	let isPublic = $state(false);
	let submitting = $state(false);
	let problem = $state<ListFormProblem | null>(null);
	let nameInput = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	let descriptionInput = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

	// Editing a field clears the previous verdict; submitting asks for a new one.
	let edited = $state(false);
	$effect(() => {
		void name;
		void description;
		problem = null;
		edited = true;
	});

	// Server wording names the field it rejects; anything else is a form-level error.
	const serverError = $derived(
		form && 'error' in form && typeof form.error === 'string' && !edited && !problem
			? form.error
			: null
	);
	const serverField = $derived(
		serverError?.startsWith('List name')
			? 'name'
			: serverError?.startsWith('Description')
				? 'description'
				: null
	);
	const nameError = $derived(
		problem?.field === 'name' ? problem.message : serverField === 'name' ? serverError : null
	);
	const descriptionError = $derived(
		problem?.field === 'description'
			? problem.message
			: serverField === 'description'
				? serverError
				: null
	);
	const formError = $derived(serverError && !serverField ? serverError : null);
	// Without JavaScript the action answers in place: offer the new list as a link.
	const createdId = $derived(
		form && 'listId' in form && typeof form.listId === 'string' ? form.listId : null
	);
</script>

<svelte:head>
	<title>New list | Alan's Database</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="create">
	<BackLink href="/my/lists" label="Lists" />

	<header class="head">
		<p class="eyebrow">Library</p>
		<h1>New list</h1>
		<p class="summary">Name it, describe it if you like, then add films from their pages.</p>
	</header>

	{#if createdId}
		<p class="notice" role="status">
			List created. <a href={`/my/lists/${createdId}`}>Open your new list</a>
		</p>
	{/if}

	<form
		method="POST"
		class="panel"
		novalidate
		aria-describedby={formError ? 'form-error' : undefined}
		use:enhance={({ cancel }) => {
			edited = false;
			const found = validateListForm(name, description);
			if (found) {
				problem = found;
				cancel();
				(found.field === 'name' ? nameInput : descriptionInput)?.focus();
				return;
			}
			problem = null;
			submitting = true;
			return async ({ result, update }) => {
				if (result.type === 'success' && typeof result.data?.listId === 'string') {
					addToast('List created', 'success');
					await goto(`/my/lists/${result.data.listId}`);
				} else {
					await update({ reset: false });
					await tick();
					if (nameError) nameInput?.focus();
					else if (descriptionError) descriptionInput?.focus();
				}
				submitting = false;
			};
		}}
	>
		{#if formError}
			<p class="form-error" id="form-error" role="alert">{formError}</p>
		{/if}

		<ListField
			id="list-name"
			name="name"
			label="Name"
			max={LIST_NAME_MAX}
			placeholder="Late-night noir"
			required
			bind:value={name}
			bind:ref={nameInput}
			error={nameError}
		/>

		<ListField
			id="list-description"
			name="description"
			label="Description"
			max={LIST_DESCRIPTION_MAX}
			multiline
			placeholder="What ties these films together?"
			bind:value={description}
			bind:ref={descriptionInput}
			error={descriptionError}
		/>

		<label class="toggle" for="list-public">
			<span class="toggle-text">
				<span class="toggle-title" id="list-public-label">Public list</span>
				<span class="toggle-hint" id="list-public-hint">
					{isPublic
						? 'Anyone with the link can view it. Only you can change it.'
						: 'Only you can see it.'}
				</span>
			</span>
			<Switch
				id="list-public"
				name="isPublic"
				bind:checked={isPublic}
				aria-labelledby="list-public-label"
				aria-describedby="list-public-hint"
			/>
		</label>

		<div class="actions">
			<Button href="/my/lists" variant="ghost">Cancel</Button>
			<Button type="submit" variant="primary" loading={submitting}>
				{submitting ? 'Creating' : 'Create list'}
			</Button>
		</div>
		<p class="sr-only" aria-live="polite">{submitting ? 'Creating your list' : ''}</p>
	</form>
</div>

<style>
	.create {
		width: 100%;
		max-width: var(--container-reading);
		margin: 0 auto;
		padding: var(--space-4) var(--page-gutter) var(--space-8);
	}
	.head {
		margin: var(--space-2) 0 var(--space-6);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
	}
	.summary {
		margin-top: var(--space-2);
		color: var(--content-secondary);
	}
	.panel {
		display: grid;
		gap: var(--space-5);
		padding: var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.form-error,
	.notice {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.form-error {
		border: 1px solid var(--color-error);
		color: var(--color-error);
	}
	.notice {
		margin-bottom: var(--space-4);
		border: 1px solid var(--brand-border);
		color: var(--content-primary);
	}
	.notice a {
		color: var(--brand-primary);
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: var(--touch-target);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.toggle-text {
		display: grid;
		gap: 0.15rem;
	}
	.toggle-title {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.toggle-hint {
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-3);
	}
	@media (max-width: 479px) {
		.panel {
			padding: var(--space-4);
		}
		.actions :global(.btn) {
			flex: 1 1 auto;
		}
	}
</style>
