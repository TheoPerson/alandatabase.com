<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	const status = $derived($page.status || 404);
	const message = $derived(
		$page.error?.message || 'The requested vault resource could not be found.'
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
	<title>{status} — {status === 404 ? 'Lost in the Vault' : 'System Notice'} | Alan Database</title>
	<meta name="description" content="Vault resource not found or access restricted." />
</svelte:head>

<div class="error-wrapper">
	<!-- Ambient Background Glow -->
	<div class="ambient-glow"></div>

	<div class="error-content-card">
		<!-- Animated Film Radar Symbol -->
		<div class="symbol-container">
			<svg class="radar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle
					cx="32"
					cy="32"
					r="28"
					stroke="rgba(16, 185, 129, 0.15)"
					stroke-width="2"
					stroke-dasharray="4 4"
					class="outer-ring"
				/>
				<circle cx="32" cy="32" r="20" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1.5" />
				<circle cx="32" cy="32" r="14" fill="#0c111a" stroke="#10b981" stroke-width="2" />
				<circle cx="32" cy="32" r="4" fill="#10b981" />

				<!-- Film Holes -->
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

		<!-- Status Code & Tag -->
		<div class="status-header">
			<span class="status-pill"
				>{status === 404 ? '404 // MISSING REEL' : `STATUS CODE ${status}`}</span
			>
		</div>

		<!-- Main Headline -->
		<h1 class="error-title">
			{#if status === 404}
				Lost in the Cutting Room
			{:else if status === 401 || status === 403}
				Restricted Vault Access
			{:else}
				Transmission Interrupted
			{/if}
		</h1>

		<!-- Explanatory Subtitle -->
		<p class="error-description">
			{#if status === 404}
				The film reel or page you are trying to access does not exist in our catalog archive or has
				been moved.
			{:else}
				{message}
			{/if}
		</p>

		<!-- Action Grid Buttons -->
		<div class="actions-grid">
			<button type="button" class="btn-primary" onclick={goBack}>
				<span class="btn-icon">↩</span>
				<span>Go Back</span>
			</button>

			<a href="/movies" class="btn-secondary">
				<span class="btn-icon">🍿</span>
				<span>CinemaDB Catalog</span>
			</a>

			<a href="/search" class="btn-ghost">
				<span class="btn-icon">🔍</span>
				<span>Search Vault</span>
			</a>

			<a href="/" class="btn-ghost">
				<span class="btn-icon">⚡</span>
				<span>Alan Vault Hub</span>
			</a>
		</div>

		<!-- Keyboard Shortcut Hint -->
		<div class="footer-hint">
			<span
				>Tip: Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to open the Command Palette from anywhere</span
			>
		</div>
	</div>
</div>

<style>
	.error-wrapper {
		min-height: 100vh;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #050507;
		color: #ffffff;
		padding: 2rem 1.5rem;
		position: relative;
		overflow: hidden;
		font-family:
			'Plus Jakarta Sans',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	.ambient-glow {
		position: absolute;
		width: 600px;
		height: 600px;
		background: radial-gradient(circle, rgba(16, 185, 129, 0.07) 0%, rgba(5, 5, 7, 0) 70%);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 1;
	}

	.error-content-card {
		position: relative;
		z-index: 2;
		max-width: 580px;
		width: 100%;
		background: rgba(10, 13, 20, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 24px;
		padding: 3rem 2.5rem;
		text-align: center;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.8),
			0 0 30px rgba(16, 185, 129, 0.05);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.symbol-container {
		width: 72px;
		height: 72px;
		margin: 0 auto 1.5rem auto;
	}

	.radar-svg {
		width: 100%;
		height: 100%;
	}

	.outer-ring {
		transform-origin: 32px 32px;
		animation: radarSpin 20s linear infinite reverse;
	}

	.radar-sweep {
		transform-origin: 32px 32px;
		animation: radarSpin 4s linear infinite;
	}

	@keyframes radarSpin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-header {
		margin-bottom: 1rem;
	}

	.status-pill {
		display: inline-block;
		font-family: monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #10b981;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.3rem 0.8rem;
		border-radius: 9999px;
	}

	.error-title {
		font-size: 2.25rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.03em;
		margin: 0 0 0.75rem 0;
		line-height: 1.2;
	}

	.error-description {
		font-size: 0.95rem;
		color: #a1a1aa;
		line-height: 1.6;
		margin: 0 0 2.25rem 0;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}

	@media (min-width: 480px) {
		.actions-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.btn-primary,
	.btn-secondary,
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.88rem;
		font-weight: 700;
		padding: 0.75rem 1.25rem;
		border-radius: 12px;
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		border: 1px solid transparent;
	}

	.btn-primary {
		background: #10b981;
		color: #050507;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
	}

	.btn-primary:hover {
		background: #34d399;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.12);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.14);
		border-color: rgba(255, 255, 255, 0.25);
		transform: translateY(-2px);
	}

	.btn-ghost {
		background: transparent;
		color: #a1a1aa;
		border-color: rgba(255, 255, 255, 0.06);
	}

	.btn-ghost:hover {
		background: rgba(255, 255, 255, 0.05);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}

	.btn-primary:active,
	.btn-secondary:active,
	.btn-ghost:active {
		transform: scale(0.97);
	}

	.footer-hint {
		font-size: 0.78rem;
		color: #71717a;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding-top: 1.25rem;
	}

	kbd {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		padding: 0.15rem 0.4rem;
		font-size: 0.72rem;
		font-family: monospace;
		color: #e4e4e7;
	}
</style>
