<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let props = $props();
	const form = $derived(props.form);
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Sign In | CinemaDB</title>
	<meta name="description" content="Log in to your personal cinema vault." />
</svelte:head>

<div class="auth-container linear-grid-bg">
	<div class="auth-card glass-card">
		<div class="auth-header">
			<span class="auth-badge">SECURE VAULT AUTHENTICATION</span>
			<h1 class="title">Sign In</h1>
			<p class="subtitle">Access your personal cinema database, ratings & watch history.</p>
		</div>

		{#if form?.error}
			<div class="error-banner">
				<span class="error-icon">⚠️</span>
				<span>{form.error}</span>
			</div>
		{/if}

		<form
			method="POST"
			action="?/login"
			class="auth-form"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					isSubmitting = false;
					await update();
				};
			}}
		>
			<div class="input-group">
				<label for="identifier">Username or Email</label>
				<input
					type="text"
					id="identifier"
					name="identifier"
					required
					placeholder="your_username or name@example.com"
					autocomplete="username"
				/>
			</div>

			<div class="input-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					placeholder="••••••••••••"
					autocomplete="current-password"
				/>
			</div>

			<Button type="submit" variant="primary" class="w-full" disabled={isSubmitting}>
				{isSubmitting ? 'Authenticating...' : 'Sign In to Vault'}
			</Button>
		</form>

		<div class="auth-footer">
			<p>
				Don't have a personal archive account? <a href="/auth/register" class="link"
					>Create an account</a
				>
			</p>
		</div>
	</div>
</div>

<style>
	.auth-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 70px - 150px);
		padding: 2.5rem 1rem;
	}

	.auth-card {
		width: 100%;
		max-width: 440px;
		padding: 2.5rem;
		border-radius: var(--radius-lg);
		background: rgba(10, 10, 15, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
	}

	.auth-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.auth-badge {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #10b981;
		background: rgba(16, 185, 129, 0.1);
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		border: 1px solid rgba(16, 185, 129, 0.2);
		display: inline-block;
		margin-bottom: 0.75rem;
	}

	.title {
		font-size: 2.2rem;
		font-weight: 800;
		color: #ffffff;
		margin-bottom: 0.4rem;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 0.92rem;
		color: #a1a1aa;
		line-height: 1.5;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(239, 68, 68, 0.12);
		color: #fca5a5;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid rgba(239, 68, 68, 0.3);
		margin-bottom: 1.5rem;
		font-size: 0.88rem;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #d4d4d8;
	}

	.input-group input {
		padding: 0.85rem 1rem;
		background: rgba(18, 18, 24, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: 0.95rem;
		transition: all 150ms ease;
	}

	.input-group input:focus {
		outline: none;
		border-color: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
	}

	:global(.w-full) {
		width: 100%;
		margin-top: 0.5rem;
	}

	.auth-footer {
		margin-top: 2rem;
		text-align: center;
		font-size: 0.88rem;
		color: #71717a;
		padding-top: 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.link {
		color: #10b981;
		font-weight: 600;
		transition: color 150ms ease;
	}

	.link:hover {
		color: #34d399;
		text-decoration: underline;
	}
</style>
