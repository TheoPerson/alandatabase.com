<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>An error occurred | CinemaDB</title>
</svelte:head>

<div class="error-container">
	<div class="error-card glass-card">
		<h1 class="error-code">{$page.status}</h1>
		<h2 class="error-title">
			{#if $page.status === 404}
				Page Not Found
			{:else if $page.status === 401 || $page.status === 403}
				Unauthorized Access
			{:else}
				Something went wrong
			{/if}
		</h2>
		<p class="error-message">
			{$page.error?.message || 'An unexpected error occurred while processing your request.'}
		</p>
		
		<div class="actions">
			<Button variant="default" onclick={() => window.history.back()} class="bg-accent-gold text-black hover:bg-accent-gold/90">
				Go Back
			</Button>
			<Button variant="outline" href="/">
				Return Home
			</Button>
		</div>
	</div>
</div>

<style>
	.error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 100px);
		padding: 2rem;
	}

	.error-card {
		max-width: 500px;
		width: 100%;
		padding: 3rem 2rem;
		text-align: center;
		border-top: 4px solid var(--color-error);
	}

	.error-code {
		font-size: 5rem;
		font-weight: 800;
		color: var(--color-error);
		line-height: 1;
		margin-bottom: 1rem;
		font-family: var(--font-mono);
	}

	.error-title {
		font-size: 1.75rem;
		color: #ffffff;
		margin-bottom: 1rem;
	}

	.error-message {
		color: var(--text-secondary);
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}
</style>
