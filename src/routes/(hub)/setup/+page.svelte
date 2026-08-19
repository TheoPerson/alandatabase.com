<script lang="ts">
	let { data } = $props();
	const envVars = $derived(data.envVariables);
	const sysInfo = $derived(data.systemInfo);
</script>

<svelte:head>
	<title>System Setup | Alan Vault</title>
</svelte:head>

<!-- Micro Grid Background -->
<div class="linear-grid-bg"></div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Vault Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">⚙️</span> System Setup & Inspector</h1>
			<span class="tool-badge">ENV CONTROL</span>
		</div>
		<p class="tool-subtitle">
			Configuration values and deployment fingerprints are intentionally kept server-side.
		</p>
	</div>

	<!-- System Architecture Cards -->
	<div class="arch-grid">
		<div class="arch-card">
			<span class="arch-label">Node Runtime</span>
			<span class="arch-val">{sysInfo.nodeVersion}</span>
		</div>
		<div class="arch-card">
			<span class="arch-label">Svelte Adapter</span>
			<span class="arch-val">{sysInfo.adapter}</span>
		</div>
		<div class="arch-card">
			<span class="arch-label">Framework Engine</span>
			<span class="arch-val">{sysInfo.framework}</span>
		</div>
	</div>

	<!-- Environment Variables Table -->
	<div class="table-container">
		<div class="table-header">
			<span class="table-title">ENVIRONMENT VARIABLES STATUS</span>
		</div>
		<div class="table-body">
			{#each envVars as ev}
				<div class="table-row">
					<div class="col-name">
						<span class="var-key">{ev.key}</span>
						<span class="var-cat">{ev.category}</span>
					</div>
					<div class="col-masked">
						<code>{ev.masked}</code>
					</div>
					<div class="col-status">
						<span class="status-pill">{ev.status}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</main>

<style>
	.linear-grid-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		background-color: #050507;
		background-image:
			linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
		background-size: 32px 32px;
		pointer-events: none;
	}

	.tool-container {
		position: relative;
		z-index: 1;
		max-width: 1140px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 6rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.back-link {
		font-size: 0.85rem;
		font-weight: 700;
		color: #10b981;
		text-decoration: none;
		transition: opacity 120ms ease;
	}

	.back-link:hover {
		opacity: 0.8;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.tool-title {
		font-size: 2rem;
		font-weight: 800;
		color: #f4f4f5;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
	}

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.tool-subtitle {
		color: #a1a1aa;
		font-size: 0.95rem;
		margin: 0.35rem 0 0 0;
	}

	.arch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.arch-card {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		backdrop-filter: blur(16px);
	}

	.arch-label {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
		text-transform: uppercase;
	}

	.arch-val {
		font-size: 1.15rem;
		font-weight: 800;
		color: #f4f4f5;
	}

	.table-container {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		overflow: hidden;
		backdrop-filter: blur(16px);
	}

	.table-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(18, 18, 24, 0.5);
	}

	.table-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
	}

	.table-body {
		display: flex;
		flex-direction: column;
	}

	.table-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.table-row:last-child {
		border-bottom: none;
	}

	.col-name {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.var-key {
		font-weight: 700;
		font-family: var(--font-mono);
		color: #f4f4f5;
	}

	.var-cat {
		font-size: 0.75rem;
		color: #71717a;
	}

	.col-masked code {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: #10b981;
		background: #09090d;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.status-pill {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
	}
</style>
