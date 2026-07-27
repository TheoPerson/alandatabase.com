<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let props = $props();
	const form = $derived(props.form);
	let isSubmitting = $state(false);
</script>

<div class="auth-container">
	<div class="auth-card glass-panel">
		<h1 class="title">Join CinemaDB</h1>
		<p class="subtitle">Create your personal cinema archive.</p>

		{#if form?.error}
			<div class="error-banner">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			action="?/register"
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

			<Button type="submit" variant="primary" class="w-full" disabled={isSubmitting}>
				{isSubmitting ? 'Creating account...' : 'Create Account'}
			</Button>
		</form>

		<div class="auth-footer">
			<p>Already have an account? <a href="/auth/login" class="link">Sign in</a></p>
		</div>
	</div>
</div>

<style>
	.auth-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 70px - 200px); /* Account for header/footer */
		padding: 2rem 1rem;
	}

	.auth-card {
		width: 100%;
		max-width: 420px;
		padding: 2.5rem;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		text-align: center;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1rem;
		color: var(--text-secondary);
		margin-bottom: 2rem;
		text-align: center;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(239, 68, 68, 0.3);
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
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
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.input-group input {
		padding: 0.75rem 1rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all var(--transition-fast);
	}

	.input-group input:focus {
		outline: none;
		border-color: var(--border-accent);
		box-shadow: 0 0 0 3px var(--accent-gold-subtle);
	}

	:global(.w-full) {
		width: 100%;
		margin-top: 0.5rem;
	}

	.auth-footer {
		margin-top: 2rem;
		text-align: center;
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.link {
		color: var(--accent-gold);
		font-weight: 600;
		transition: color var(--transition-fast);
	}

	.link:hover {
		color: var(--accent-gold-hover);
		text-decoration: underline;
	}
</style>
