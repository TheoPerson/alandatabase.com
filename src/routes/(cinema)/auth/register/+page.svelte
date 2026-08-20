<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let isSubmitting = $state(false);
</script>

<div class="auth-container">
	<div class="auth-card glass-card">
		<h1 class="title">Join CinemaDB</h1>
		<p class="subtitle">Create your personal cinema archive.</p>

		{#if form?.error}
			<div class="error-banner">
				{form.error}
			</div>
		{/if}

		{#if data.allowSetup}
			<form
				method="POST"
				action="?/register&returnTo={data.returnTo || ''}"
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
					<label for="username">Username</label>
					<input
						type="text"
						id="username"
						name="username"
						required
						minlength="3"
						placeholder="cinephile99"
						autocomplete="username"
					/>
				</div>

				<div class="input-group">
					<label for="email">Email</label>
					<input
						type="email"
						id="email"
						name="email"
						required
						placeholder="you@example.com"
						autocomplete="email"
					/>
				</div>

				<div class="input-group">
					<label for="password">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						minlength="6"
						placeholder="••••••••"
						autocomplete="new-password"
					/>
				</div>

				<Button type="submit" disabled={isSubmitting} class="w-full">
					{isSubmitting ? 'Creating account...' : 'Create Account'}
				</Button>
			</form>
		{:else}
			<div class="empty-state">
				<p>Registration is currently disabled for security reasons.</p>
				<p class="text-sm mt-4 text-muted-foreground">
					If you are the owner, set ALLOW_OWNER_SETUP=true in your environment variables to
					bootstrap your account.
				</p>
			</div>
		{/if}

		<div class="auth-footer">
			<p>
				Already have an account? <a
					href="/auth/login{data.returnTo ? `?returnTo=${data.returnTo}` : ''}">Log in</a
				>
			</p>
		</div>
	</div>
</div>

<style>
	.auth-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - var(--header-height, 64px));
		padding: 2rem 1rem;
		background: radial-gradient(circle at 50% 0%, rgba(20, 20, 25, 1) 0%, rgba(10, 10, 12, 1) 100%);
	}

	.auth-card {
		width: 100%;
		max-width: 400px;
		padding: 2.5rem;
		border-radius: 1rem;
		background: rgba(20, 20, 25, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(16px);
	}

	.title {
		font-size: 1.875rem;
		font-weight: 700;
		text-align: center;
		margin-bottom: 0.5rem;
		color: #fff;
		letter-spacing: -0.025em;
	}

	.subtitle {
		text-align: center;
		color: #a1a1aa;
		margin-bottom: 2rem;
		font-size: 0.95rem;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		border: 1px solid rgba(239, 68, 68, 0.2);
		text-align: center;
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
		font-size: 0.875rem;
		font-weight: 500;
		color: #d4d4d8;
	}

	.input-group input {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		color: #fff;
		font-size: 1rem;
		transition: all 0.2s;
	}

	.input-group input:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(0, 0, 0, 0.4);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.05);
	}

	.auth-footer {
		margin-top: 2rem;
		text-align: center;
		font-size: 0.875rem;
		color: #a1a1aa;
	}

	.empty-state {
		text-align: center;
		padding: 2rem 0;
		color: #a1a1aa;
	}

	.auth-footer a {
		color: #fff;
		font-weight: 500;
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.2s;
	}

	.auth-footer a:hover {
		color: #a1a1aa;
	}
</style>
