<script lang="ts">
	let { data } = $props();
	const envVars = $derived(data.envVariables);
	const sysInfo = $derived(data.systemInfo);
</script>

<svelte:head>
	<title>System Setup | Alan OS</title>
</svelte:head>

<!-- Aurora Backdrop -->
<div class="aurora-backdrop">
	<div class="aurora-blob aurora-blob-1"></div>
	<div class="aurora-blob aurora-blob-3"></div>
	<div class="cyber-grid-overlay"></div>
</div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">⚙️</span> System Setup & Inspector</h1>
			<span class="tool-badge">ENV CONTROL</span>
		</div>
		<p class="tool-subtitle">Inspect environment configuration variables, database pooler settings, and system runtime parameters.</p>
	</div>

	<!-- System Architecture Cards -->
	<div class="arch-grid">
		<div class="arch-card glass-card">
			<span class="arch-label">Node Runtime</span>
			<span class="arch-val">{sysInfo.nodeVersion}</span>
		</div>
		<div class="arch-card glass-card">
			<span class="arch-label">Svelte Adapter</span>
			<span class="arch-val">{sysInfo.adapter}</span>
		</div>
		<div class="arch-card glass-card">
			<span class="arch-label">Framework Engine</span>
			<span class="arch-val">{sysInfo.framework}</span>
		</div>
	</div>

	<!-- Environment Variables Table -->
	<div class="table-container glass-card">
		<div class="table-header">
			<span class="table-title">Environment Variables Status</span>
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
						<span class="status-pill" class:ok={ev.status === 'CONFIGURED'}>{ev.status}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</main>

<style>
	.tool-container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem 5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.back-link { font-size: 0.85rem; font-weight: 700; color: var(--accent-gold); }

	.title-row { display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; }

	.tool-title { font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; margin: 0; }

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-tertiary);
		background: var(--bg-surface-3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle { color: var(--text-secondary); font-size: 0.95rem; margin: 0.25rem 0 0 0; }

	.arch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.arch-card {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.arch-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.arch-val {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.table-container {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.table-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(14, 17, 26, 0.6);
	}

	.table-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.table-body {
		display: flex;
		flex-direction: column;
	}

	.table-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.table-row:last-child { border-bottom: none; }

	.col-name {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.var-key {
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--text-primary);
	}

	.var-cat {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.col-masked code {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--accent-gold);
		background: var(--bg-surface-2);
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-sm);
	}

	.status-pill {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: var(--radius-full);
		color: var(--text-tertiary);
		background: var(--bg-surface-3);
	}

	.status-pill.ok {
		color: #10b981;
		background: rgba(16, 185, 129, 0.15);
	}
</style>
