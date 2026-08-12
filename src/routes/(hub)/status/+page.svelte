<script lang="ts">
	let { data } = $props();
	const telemetry = $derived(data.telemetry);
</script>

<svelte:head>
	<title>System Status | Alan OS</title>
</svelte:head>

<!-- Aurora Backdrop -->
<div class="aurora-backdrop">
	<div class="aurora-blob aurora-blob-1"></div>
	<div class="aurora-blob aurora-blob-2"></div>
	<div class="cyber-grid-overlay"></div>
</div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">📈</span> System Telemetry & Status</h1>
			<span class="tool-badge green">ALL SYSTEMS OPERATIONAL</span>
		</div>
		<p class="tool-subtitle">Real-time health monitoring, Neon Postgres database ping latency, and TMDB API response metrics.</p>
	</div>

	<div class="telemetry-grid">
		<!-- Database Health Card -->
		<div class="telemetry-card glass-card">
			<div class="card-header">
				<div class="icon-wrap db"><span class="icon">🐘</span></div>
				<span class="status-badge" class:online={telemetry.db.status === 'ONLINE'}>
					{telemetry.db.status}
				</span>
			</div>
			<div class="card-body">
				<span class="card-title">Neon Postgres Database</span>
				<span class="card-sub">{telemetry.db.provider}</span>
				<div class="metric-row">
					<span class="metric-val">{telemetry.db.latencyMs} ms</span>
					<span class="metric-lbl">Query Ping Latency</span>
				</div>
			</div>
		</div>

		<!-- TMDB API Health Card -->
		<div class="telemetry-card glass-card">
			<div class="card-header">
				<div class="icon-wrap tmdb"><span class="icon">🎬</span></div>
				<span class="status-badge" class:online={telemetry.tmdb.status === 'ONLINE'}>
					{telemetry.tmdb.status}
				</span>
			</div>
			<div class="card-body">
				<span class="card-title">TMDB Movie API</span>
				<span class="card-sub">{telemetry.tmdb.endpoint}</span>
				<div class="metric-row">
					<span class="metric-val">{telemetry.tmdb.latencyMs} ms</span>
					<span class="metric-lbl">API Response Time</span>
				</div>
			</div>
		</div>

		<!-- Server Latency Card -->
		<div class="telemetry-card glass-card">
			<div class="card-header">
				<div class="icon-wrap server"><span class="icon">⚡</span></div>
				<span class="status-badge online">ACTIVE</span>
			</div>
			<div class="card-body">
				<span class="card-title">Netlify Serverless SSR</span>
				<span class="card-sub">Environment: {telemetry.nodeEnv}</span>
				<div class="metric-row">
					<span class="metric-val">{telemetry.serverLatencyMs} ms</span>
					<span class="metric-lbl">Total Roundtrip Execution</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Raw Diagnostics Panel -->
	<div class="diagnostics-panel glass-card">
		<div class="panel-header">
			<span class="panel-title">System Diagnostics Payload</span>
			<span class="time-stamp">Checked at {new Date(telemetry.timestamp).toLocaleTimeString()}</span>
		</div>
		<pre class="json-payload">{JSON.stringify(telemetry, null, 2)}</pre>
	</div>
</main>

<style>
	.tool-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.back-link { font-size: 0.85rem; font-weight: 700; color: var(--accent-gold); }

	.title-row { display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; }

	.tool-title { font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; margin: 0; }

	.tool-badge.green {
		font-size: 0.75rem;
		font-weight: 800;
		color: #10b981;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle { color: var(--text-secondary); font-size: 0.95rem; margin: 0.25rem 0 0 0; }

	.telemetry-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.telemetry-card {
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.icon-wrap {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	.icon-wrap.db { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); }
	.icon-wrap.tmdb { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
	.icon-wrap.server { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }

	.status-badge {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: var(--radius-full);
		color: var(--color-error);
		background: rgba(239, 68, 68, 0.15);
	}

	.status-badge.online {
		color: #10b981;
		background: rgba(16, 185, 129, 0.15);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-title {
		font-size: 1.2rem;
		font-weight: 700;
	}

	.card-sub {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.metric-row {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
	}

	.metric-val {
		font-size: 2.25rem;
		font-weight: 800;
		color: var(--accent-gold);
		font-family: var(--font-mono);
	}

	.metric-lbl {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.diagnostics-panel {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.time-stamp {
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.json-payload {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--accent-cyan);
		background: var(--bg-surface-2);
		padding: 1.25rem;
		border-radius: var(--radius-md);
		overflow-x: auto;
	}
</style>
