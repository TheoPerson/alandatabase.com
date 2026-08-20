<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Admin Console | Alan's Database</title>
	<meta
		name="description"
		content="Owner-only administration console for Alan's Database production surfaces."
	/>
	<link rel="canonical" href="https://alandatabase.com/admin" />
</svelte:head>

<main class="admin-shell">
	<header class="admin-header">
		<div>
			<a class="back-link" href="/">← Alan's Database</a>
			<p class="eyebrow">Owner console / V3</p>
			<h1>Project surfaces, kept deliberate.</h1>
			<p class="lede">
				You are signed in as <strong>{data.user.displayName || data.user.email}</strong>. Public
				movie browsing stays open; operational and personal surfaces remain owner-gated.
			</p>
		</div>
		<div class="header-actions">
			<a class="button secondary" href="https://auth.alandatabase.com/auth/logout">Sign out</a>
			<a class="button primary" href="https://alandatabase.com/movies">Open cinema</a>
		</div>
	</header>

	<section class="surface-grid" aria-label="Project surfaces">
		{#each data.surfaces as surface}
			<a class="surface-card" href={surface.href}>
				<div class="surface-topline">
					<span class="surface-dot"></span>
					<span class="surface-access">{surface.access}</span>
				</div>
				<h2>{surface.name}</h2>
				<p>{surface.host}</p>
				<span class="surface-link">Open surface ↗</span>
			</a>
		{/each}
	</section>

	<footer class="admin-footer">
		<span>Alan's Database</span>
		<span>Owner-only console · No secrets displayed</span>
	</footer>
</main>

<style>
	:global(body) {
		background: #07090c;
	}

	.admin-shell {
		width: min(100% - 2rem, 1180px);
		margin: 0 auto;
		padding: clamp(2rem, 6vw, 5rem) 0 3rem;
		color: #f4f4f5;
	}

	.admin-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: 3rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.back-link {
		color: #a1a1aa;
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back-link:hover {
		color: #34d399;
	}

	.eyebrow {
		margin: 3rem 0 0.75rem;
		color: #34d399;
		font:
			700 0.7rem/1.2 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 680px;
		margin: 0;
		font-size: clamp(2.4rem, 7vw, 5.4rem);
		line-height: 0.96;
		letter-spacing: -0.06em;
	}

	.lede {
		max-width: 620px;
		margin: 1.25rem 0 0;
		color: #a1a1aa;
		font-size: 1rem;
		line-height: 1.65;
	}

	.lede strong {
		color: #f4f4f5;
	}

	.header-actions {
		display: flex;
		flex-shrink: 0;
		gap: 0.65rem;
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.7rem 1rem;
		font-size: 0.8rem;
		font-weight: 800;
		text-decoration: none;
		white-space: nowrap;
	}

	.button.primary {
		background: #34d399;
		color: #04110c;
	}

	.button.secondary {
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: #d4d4d8;
	}

	.surface-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		padding: 2rem 0 4rem;
	}

	.surface-card {
		min-height: 180px;
		padding: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		background: linear-gradient(145deg, rgba(19, 25, 30, 0.95), rgba(9, 12, 16, 0.95));
		color: inherit;
		text-decoration: none;
		transition:
			transform 160ms ease,
			border-color 160ms ease;
	}

	.surface-card:hover {
		transform: translateY(-3px);
		border-color: rgba(52, 211, 153, 0.55);
	}

	.surface-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.surface-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #34d399;
		box-shadow: 0 0 16px rgba(52, 211, 153, 0.7);
	}

	.surface-access {
		color: #71717a;
		font:
			700 0.65rem/1.2 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: right;
	}

	.surface-card h2 {
		margin: 2.25rem 0 0.35rem;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
	}

	.surface-card p {
		margin: 0;
		color: #71717a;
		font:
			0.75rem/1.4 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		overflow-wrap: anywhere;
	}

	.surface-link {
		display: inline-block;
		margin-top: 1.25rem;
		color: #34d399;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.admin-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		color: #71717a;
		font:
			0.7rem/1.4 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	@media (max-width: 760px) {
		.admin-header {
			align-items: start;
			flex-direction: column;
		}

		.surface-grid {
			grid-template-columns: 1fr;
		}

		.admin-footer {
			flex-direction: column;
		}
	}
</style>
