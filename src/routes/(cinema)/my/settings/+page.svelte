<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';

	let { data, form } = $props();
	
	let adultEnabled = $state(false);
	let isSaving = $state(false);

	$effect(() => {
		adultEnabled = data.user?.settings?.adultEnabled || false;
	});
</script>

<svelte:head>
	<title>Settings | CinemaDB</title>
</svelte:head>

<div class="container settings-page">
	<header class="page-header">
		<h1 class="page-title">Settings</h1>
		<p class="subtitle">Manage your account preferences and content filters.</p>
	</header>

	<section class="settings-section">
		<h2>Content Preferences</h2>
		
		<form 
			method="POST" 
			action="?/updateSettings"
			use:enhance={() => {
				isSaving = true;
				return async ({ update }) => {
					await update();
					isSaving = false;
				};
			}}
			class="settings-form"
		>
			<div class="setting-item danger-zone">
				<div class="setting-info">
					<h3>Adult Content (18+)</h3>
					<p>Enable access to explicit and 18+ content in your private cinema and searches. By enabling this, you confirm you are at least 18 years old.</p>
				</div>
				<div class="setting-control">
					<!-- Shadcn Switch works differently, it uses checked binding or form input. We add a hidden input for the form. -->
					<Switch bind:checked={adultEnabled} />
					<input type="hidden" name="adultEnabled" value={adultEnabled ? 'on' : 'off'} />
				</div>
			</div>
			
			<div class="form-actions">
				<Button type="submit" disabled={isSaving} class="bg-accent-gold text-black hover:bg-accent-gold/90">
					{isSaving ? 'Saving...' : 'Save Settings'}
				</Button>
				{#if form?.success}
					<span class="success-message">Settings saved successfully.</span>
				{/if}
				{#if form?.error}
					<span class="error-message">{form.error}</span>
				{/if}
			</div>
		</form>
	</section>
</div>

<style>
	.settings-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		max-width: 800px;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.page-title {
		font-size: 2.75rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}
	
	.settings-section h2 {
		font-size: 1.5rem;
		margin-bottom: 1.5rem;
		color: #ffffff;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.5rem;
	}
	
	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		margin-bottom: 1.5rem;
	}
	
	.setting-item.danger-zone {
		border-color: rgba(239, 68, 68, 0.3);
	}
	
	.setting-info h3 {
		font-size: 1.1rem;
		color: #ffffff;
		margin-bottom: 0.25rem;
	}
	
	.setting-info p {
		font-size: 0.9rem;
		color: var(--text-secondary);
		max-width: 500px;
		line-height: 1.4;
	}
	
	.form-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}
	
	.success-message {
		color: #10b981;
		font-size: 0.9rem;
	}
	
	.error-message {
		color: #ef4444;
		font-size: 0.9rem;
	}
</style>
