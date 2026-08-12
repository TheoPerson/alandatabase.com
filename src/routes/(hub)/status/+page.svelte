<script lang="ts">
	let { data } = $props();
	const telemetry = $derived(data.telemetry);
</script>

<svelte:head>
	<title>System Status & Telemetry | Alan Vault</title>
</svelte:head>

<!-- Micro Grid Background -->
<div class="linear-grid-bg"></div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Vault Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">📈</span> System Telemetry & Status</h1>
			<span class="tool-badge green">ALL SYSTEMS OPERATIONAL</span>
		</div>
		<p class="tool-subtitle">
			Real-time health monitoring, Neon Postgres database ping latency, and TMDB API response
			metrics.
		</p>
	</div>

	<div class="telemetry-grid">
		<!-- Database Health Card -->
		<div class="telemetry-card">
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
		<div class="telemetry-card">
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

		<!-- Server Latency Card (Vercel Edge) -->
		<div class="telemetry-card">
			<div class="card-header">
				<div class="icon-wrap server"><span class="icon">▲</span></div>
				<span class="status-badge online">ACTIVE</span>
			</div>
			<div class="card-body">
				<span class="card-title">Vercel Edge SSR & Functions</span>
				<span class="card-sub">Environment: {telemetry.nodeEnv}</span>
				<div class="metric-row">
					<span class="metric-val">{telemetry.serverLatencyMs} ms</span>
					<span class="metric-lbl">Total Roundtrip Execution</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Raw Diagnostics Panel -->
	<div class="diagnostics-panel">
		<div class="panel-header">
			<span class="panel-title">SYSTEM DIAGNOSTICS PAYLOAD</span>
			<span class="time-stamp">Checked at {new Date(telemetry.timestamp).toLocaleTimeString()}</span
			>
		</div>
		<pre class="json-payload">{JSON.stringify(
				{ ...telemetry, host: 'Vercel Edge Platform' },
				null,
				2
			)}</pre>
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

	.tool-badge.green {
		font-size: 0.75rem;
		font-weight: 800;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
	}

	.tool-subtitle {
		color: #a1a1aa;
		font-size: 0.95rem;
		margin: 0.35rem 0 0 0;
	}

	.telemetry-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.telemetry-card {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		backdrop-filter: blur(16px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.icon-wrap {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	.icon-wrap.db {
		background: rgba(59, 130, 246, 0.12);
		border: 1px solid rgba(59, 130, 246, 0.25);
	}
	.icon-wrap.tmdb {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
	}
	.icon-wrap.server {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.15);
	}

	.status-badge.online {
		color: #10b981;
		background: rgba(16, 185, 129, 0.15);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 800;
		color: #f4f4f5;
	}

	.card-sub {
		font-size: 0.85rem;
		color: #71717a;
	}

	.metric-row {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
	}

	.metric-val {
		font-size: 2.25rem;
		font-weight: 800;
		color: #10b981;
		font-family: var(--font-mono);
	}

	.metric-lbl {
		font-size: 0.8rem;
		color: #a1a1aa;
	}

	.diagnostics-panel {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		backdrop-filter: blur(16px);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
	}

	.time-stamp {
		font-size: 0.8rem;
		color: #71717a;
	}

	.json-payload {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: #10b981;
		background: #09090d;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		overflow-x: auto;
	}
</style>
