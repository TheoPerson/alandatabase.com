<script lang="ts">
	import { page } from '$app/stores';

	const status = $derived($page.status || 404);
	const message = $derived(
		$page.error?.message || 'The requested film or page could not be found.'
	);

	function goBack() {
		if (typeof window !== 'undefined') {
			if (window.history.length > 1) {
				window.history.back();
			} else {
				window.location.href = '/movies';
			}
		}
	}
</script>

<svelte:head>
	<title>{status} — {status === 404 ? 'Lost in the Vault' : 'Cinema Error'} | CinemaDB</title>
</svelte:head>

<div class="cinema-error-container">
	<div class="error-card glass-card">
		<!-- Animated Film Radar Icon -->
		<div class="symbol-box">
			<svg class="radar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle
					cx="32"
					cy="32"
					r="28"
					stroke="rgba(16, 185, 129, 0.2)"
					stroke-width="2"
					stroke-dasharray="4 4"
					class="outer-ring"
				/>
				<circle cx="32" cy="32" r="20" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1.5" />
				<circle cx="32" cy="32" r="14" fill="#0c111a" stroke="#10b981" stroke-width="2" />
				<circle cx="32" cy="32" r="4" fill="#10b981" />

				<circle cx="32" cy="24" r="1.8" fill="#10b981" />
				<circle cx="32" cy="40" r="1.8" fill="#10b981" />
				<circle cx="24" cy="32" r="1.8" fill="#10b981" />
				<circle cx="40" cy="32" r="1.8" fill="#10b981" />

				<line
					x1="32"
					y1="32"
					x2="48"
					y2="16"
					stroke="#34d399"
					stroke-width="2"
					stroke-linecap="round"
					class="radar-sweep"
				/>
			</svg>
		</div>

		<div class="status-pill">
			<span>{status === 404 ? '404 // FILM REEL NOT FOUND' : `STATUS ${status}`}</span>
		</div>

		<h1 class="error-title">
			{#if status === 404}
				Reel Missing from the Archive
			{:else}
				Playback Signal Interrupted
			{/if}
		</h1>

		<p class="error-desc">
			{#if status === 404}
				The movie title or page you are looking for has not been archived yet or has been moved.
			{:else}
				{message}
			{/if}
		</p>

		<div class="buttons-row">
			<button type="button" class="btn-action primary" onclick={goBack}>
				<span>↩ Go Back</span>
			</button>
			<a href="/movies/catalog" class="btn-action secondary">
				<span>🍿 Browse Catalog</span>
			</a>
			<a href="/search" class="btn-action ghost">
				<span>🔍 Search Cinema</span>
			</a>
		</div>
	</div>
</div>

<style>
	.cinema-error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 200px);
		padding: 3rem 1.5rem;
	}

	.error-card {
		max-width: 540px;
		width: 100%;
		background: rgba(10, 13, 20, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 3rem 2rem;
		text-align: center;
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.8),
			0 0 30px rgba(16, 185, 129, 0.06);
		backdrop-filter: blur(20px);
	}

	.symbol-box {
		width: 64px;
		height: 64px;
		margin: 0 auto 1.25rem auto;
	}

	.radar-svg {
		width: 100%;
		height: 100%;
	}

	.outer-ring {
		transform-origin: 32px 32px;
		animation: spin 20s linear infinite reverse;
	}

	.radar-sweep {
		transform-origin: 32px 32px;
		animation: spin 4s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-pill {
		display: inline-block;
		font-family: monospace;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #10b981;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		margin-bottom: 1rem;
	}

	.error-title {
		font-size: 2rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
		margin: 0 0 0.75rem 0;
	}

	.error-desc {
		font-size: 0.95rem;
		color: #a1a1aa;
		line-height: 1.5;
		margin: 0 0 2rem 0;
	}

	.buttons-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		border: 1px solid transparent;
	}

	.btn-action.primary {
		background: #10b981;
		color: #050507;
	}

	.btn-action.primary:hover {
		background: #34d399;
		transform: translateY(-2px);
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
	}

	.btn-action.secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.12);
	}

	.btn-action.secondary:hover {
		background: rgba(255, 255, 255, 0.14);
		border-color: rgba(255, 255, 255, 0.25);
		transform: translateY(-2px);
	}

	.btn-action.ghost {
		background: transparent;
		color: #a1a1aa;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.btn-action.ghost:hover {
		background: rgba(255, 255, 255, 0.05);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.18);
		transform: translateY(-1px);
	}

	.btn-action:active {
		transform: scale(0.97);
	}
</style>
