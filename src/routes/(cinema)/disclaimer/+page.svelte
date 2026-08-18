<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let isSubmitting = $state(false);
</script>

<div class="gate-container">
	<div class="gate-card glass-card">
		<div class="icon-wrapper">
			<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert text-red-500"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2 0 5 1 7 2a1 1 0 0 1 1 1v7z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
		</div>
		<h1 class="title">Content Advisory</h1>
		<p class="subtitle">
			CinemaDB contains unfiltered content including R-rated movies, explicit themes, and mature TV shows. 
			This library is completely uncensored.
		</p>

		<div class="warning-box">
			<p>By proceeding, you acknowledge that you are of legal age and consent to viewing mature content.</p>
		</div>

		<form
			method="POST"
			action="?/accept"
			class="action-buttons"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					isSubmitting = false;
					await update();
				};
			}}
		>
			<Button type="button" variant="ghost" class="w-full text-muted-foreground" onclick={() => window.history.back()}>
				Go Back
			</Button>
			<Button type="submit" variant="primary" class="w-full" disabled={isSubmitting}>
				{isSubmitting ? 'Loading...' : 'I Agree, Enter Cinema'}
			</Button>
		</form>
	</div>
</div>

<style>
	.gate-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - var(--header-height, 64px));
		padding: 2rem 1rem;
		background: radial-gradient(circle at 50% 0%, rgba(20, 20, 25, 1) 0%, rgba(10, 10, 12, 1) 100%);
		position: fixed;
		inset: 0;
		z-index: 50;
		backdrop-filter: blur(20px);
	}

	.gate-card {
		width: 100%;
		max-width: 440px;
		padding: 3rem 2.5rem;
		border-radius: 1.5rem;
		background: rgba(15, 15, 18, 0.85);
		border: 1px solid rgba(239, 68, 68, 0.2);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05) inset;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.icon-wrapper {
		background: rgba(239, 68, 68, 0.1);
		padding: 1.5rem;
		border-radius: 50%;
		margin-bottom: 1.5rem;
	}

	.title {
		font-size: 1.75rem;
		font-weight: 700;
		text-align: center;
		margin-bottom: 1rem;
		color: #fff;
		letter-spacing: -0.025em;
	}

	.subtitle {
		text-align: center;
		color: #a1a1aa;
		margin-bottom: 2rem;
		font-size: 1rem;
		line-height: 1.6;
	}

	.warning-box {
		background: rgba(0, 0, 0, 0.4);
		border-left: 4px solid #ef4444;
		padding: 1.25rem;
		border-radius: 0.5rem;
		margin-bottom: 2.5rem;
		color: #d4d4d8;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		width: 100%;
	}
</style>
