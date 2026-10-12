<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
	<title>Add Custom Movie | CinemaDB</title>
</svelte:head>

<div class="container custom-movie-page">
	<div class="page-header">
		<h1 class="page-title">Private title intake</h1>
		<p class="page-subtitle">
			Custom titles are paused while their private content boundary is completed.
		</p>
	</div>

	<div class="form-wrapper glass-card" role="status" aria-labelledby="intake-status-title">
		<span class="status-mark" aria-hidden="true">◇</span>
		<h2 id="intake-status-title">No custom data is being accepted yet</h2>
		<p>
			Existing records remain untouched. Intake will return with owner-only authorization, reviewed
			visibility labels, private artwork handling, and approved source records.
		</p>
		<div class="form-actions">
			<Button type="button" variant="primary" href="/movies">Return to movies</Button>
		</div>
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

	.form-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
	}

	.status-mark {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border: 1px solid var(--border-emerald);
		border-radius: 50%;
		color: var(--accent-emerald);
		font-size: 1.4rem;
	}

	.form-wrapper h2 {
		margin: 0;
		font-size: 1.35rem;
	}

	.form-wrapper p {
		max-width: 56ch;
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.65;
	}

	.form-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1.5rem;
		width: 100%;
		border-top: 1px solid var(--border-subtle);
	}
</style>
