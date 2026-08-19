<script lang="ts">
	let { data } = $props();
	const telemetry = $derived(data.telemetry);

	interface TelemetryLog {
		id: string;
		timestamp: string;
		level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'STREAM' | 'SEARCH' | 'INGEST';
		source: string;
		message: string;
		metadata?: Record<string, any>;
	}

	let logs = $state<TelemetryLog[]>([]);
	let activeFilter = $state<string>('ALL');
	let cmdInput = $state('');
	let terminalOutputEl = $state<HTMLDivElement | null>(null);

	const filteredLogs = $derived(
		logs.filter((log) => {
			if (activeFilter === 'ALL') return true;
			if (activeFilter === 'STREAM') return log.level === 'STREAM';
			if (activeFilter === 'SEARCH') return log.level === 'SEARCH';
			if (activeFilter === 'INGEST') return log.level === 'INGEST';
			if (activeFilter === 'AUTH') return log.source.includes('AUTH');
			if (activeFilter === 'ERROR') return log.level === 'ERROR' || log.level === 'WARN';
			return true;
		})
	);

	function scrollToBottom() {
		if (terminalOutputEl) {
			setTimeout(() => {
				if (terminalOutputEl) {
					terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
				}
			}, 30);
		}
	}

	function handleTerminalCommand(e: SubmitEvent) {
		e.preventDefault();
		const raw = cmdInput.trim();
		if (!raw) return;

		const time = new Date().toISOString();
		const command = raw.toLowerCase();

		if (command === 'clear') {
			logs = [];
			cmdInput = '';
			return;
		}

		if (command === 'help') {
			logs = [
				...logs,
				{
					id: crypto.randomUUID(),
					timestamp: time,
					level: 'INFO',
					source: 'TERMINAL_CLI',
					message: 'Commands: ping, stats, clear, help'
				}
			];
			cmdInput = '';
			scrollToBottom();
			return;
		}

		if (command === 'ping') {
			logs = [
				...logs,
				{
					id: crypto.randomUUID(),
					timestamp: time,
					level: 'INFO',
					source: 'PUBLIC_STATUS',
					message: 'Private infrastructure probes are disabled on this public page.'
				}
			];
			cmdInput = '';
			scrollToBottom();
			return;
		}

		if (command === 'stats') {
			logs = [
				...logs,
				{
					id: crypto.randomUUID(),
					timestamp: time,
					level: 'INFO',
					source: 'SYS_STATS',
					message: `Logs Count: ${logs.length} | DB Provider: ${telemetry.db.provider} | Node: ${telemetry.nodeEnv || 'production'}`
				}
			];
			cmdInput = '';
			scrollToBottom();
			return;
		}

		// Generic executed command
		logs = [
			...logs,
			{
				id: crypto.randomUUID(),
				timestamp: time,
				level: 'INFO',
				source: 'USER_EXEC',
				message: `$ ${raw}`
			}
		];
		cmdInput = '';
		scrollToBottom();
	}

	function copyAllLogs() {
		const text = logs
			.map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`)
			.join('\n');
		navigator.clipboard.writeText(text);
		alert('Telemetry logs copied to clipboard!');
	}
</script>

<svelte:head>
	<title>Public Status | Alan Vault</title>
</svelte:head>

<!-- Micro Grid Background -->
<div class="linear-grid-bg"></div>

<main class="tool-container">
	<!-- Header -->
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Vault Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">📡</span> Public System Status</h1>
			<span class="tool-badge green">SAFE STATIC VIEW</span>
		</div>
		<p class="tool-subtitle">
			This public page does not query private databases, activity streams, or external media
			services.
		</p>
	</div>

	<!-- Health Metrics Cards -->
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
				<span class="card-title">Postgres Database</span>
				<span class="card-sub">{telemetry.db.provider}</span>
				<div class="metric-row">
					<span class="metric-val">—</span>
					<span class="metric-lbl">Not measured publicly</span>
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
				<span class="card-title">TMDB Gateway</span>
				<span class="card-sub">{telemetry.tmdb.endpoint}</span>
				<div class="metric-row">
					<span class="metric-val">—</span>
					<span class="metric-lbl">Not measured publicly</span>
				</div>
			</div>
		</div>

		<!-- Application availability card -->
		<div class="telemetry-card">
			<div class="card-header">
				<div class="icon-wrap server"><span class="icon">▲</span></div>
				<span class="status-badge online">AVAILABLE</span>
			</div>
			<div class="card-body">
				<span class="card-title">Application Server</span>
				<span class="card-sub">Env: {telemetry.nodeEnv}</span>
				<div class="metric-row">
					<span class="metric-val">—</span>
					<span class="metric-lbl">Request timing disabled</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Local-only scratch console. It never subscribes to private telemetry. -->
	<section class="live-terminal-panel">
		<div class="terminal-header">
			<div class="terminal-title-group">
				<span class="status-radar-dot"></span>
				<span class="terminal-title">LOCAL STATUS SCRATCHPAD</span>
				<span class="log-count-badge">{filteredLogs.length} local entries</span>
			</div>

			<div class="terminal-actions">
				<button type="button" class="terminal-action-btn" onclick={copyAllLogs}>
					📋 Copy Logs
				</button>
				<button type="button" class="terminal-action-btn clear" onclick={() => (logs = [])}>
					✕ Clear
				</button>
			</div>
		</div>

		<!-- Filter Tabs Bar -->
		<div class="filter-tabs-bar">
			{#each ['ALL', 'STREAM', 'SEARCH', 'INGEST', 'AUTH', 'ERROR'] as tab}
				<button
					type="button"
					class="filter-pill"
					class:active={activeFilter === tab}
					onclick={() => (activeFilter = tab)}
				>
					{tab}
				</button>
			{/each}
		</div>

		<!-- Terminal Scrolling Output -->
		<div class="terminal-screen" bind:this={terminalOutputEl}>
			{#if filteredLogs.length === 0}
				<div class="empty-terminal">
					<span class="terminal-cursor">></span> No private activity is exposed here. Type
					<code>help</code> for local commands.
				</div>
			{:else}
				{#each filteredLogs as log (log.id)}
					<div class="terminal-log-row level-{log.level.toLowerCase()}">
						<span class="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
						<span class="log-level-tag badge-{log.level.toLowerCase()}">[{log.level}]</span>
						<span class="log-source">[{log.source}]</span>
						<span class="log-msg">{log.message}</span>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Interactive CLI Command Line -->
		<form onsubmit={handleTerminalCommand} class="terminal-cli-form">
			<span class="cli-prompt">alan@vault:~$</span>
			<input
				type="text"
				bind:value={cmdInput}
				placeholder="Type command (e.g. ping, stats, clear, help)..."
				class="cli-input"
			/>
			<button type="submit" class="cli-enter-btn">EXECUTE</button>
		</form>
	</section>
</main>

<style>
	.linear-grid-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		background-color: #050507;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 32px 32px;
		pointer-events: none;
	}

	.tool-container {
		position: relative;
		z-index: 1;
		max-width: 1100px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 6rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.tool-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.back-link {
		color: #71717a;
		font-size: 0.875rem;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.back-link:hover {
		color: #10b981;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.tool-title {
		font-size: 1.85rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.3rem 0.75rem;
		border-radius: 9999px;
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
		letter-spacing: 0.05em;
	}

	.tool-badge.offline {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.tool-subtitle {
		color: #a1a1aa;
		font-size: 0.95rem;
		margin: 0;
	}

	/* Telemetry 3-Grid Cards */
	.telemetry-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.telemetry-card {
		background: #090d14;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		transition: border-color 0.2s ease;
	}

	.telemetry-card:hover {
		border-color: rgba(16, 185, 129, 0.3);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.icon-wrap {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.icon-wrap.db {
		color: #60a5fa;
	}

	.icon-wrap.tmdb {
		color: #f43f5e;
	}

	.icon-wrap.server {
		color: #10b981;
	}

	.status-badge {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		color: #a1a1aa;
	}

	.status-badge.online {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.card-title {
		font-weight: 700;
		font-size: 1.05rem;
		color: #ffffff;
	}

	.card-sub {
		font-size: 0.8rem;
		color: #71717a;
		font-family: monospace;
	}

	.metric-row {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.metric-val {
		font-size: 1.4rem;
		font-weight: 800;
		color: #10b981;
		font-family: monospace;
	}

	.metric-lbl {
		font-size: 0.75rem;
		color: #71717a;
	}

	/* 2026 LIVE TERMINAL CONSOLE */
	.live-terminal-panel {
		background: #06090e;
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: 16px;
		overflow: hidden;
		box-shadow:
			0 0 40px rgba(0, 0, 0, 0.8),
			0 0 15px rgba(16, 185, 129, 0.05);
		display: flex;
		flex-direction: column;
	}

	.terminal-header {
		background: #090e17;
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.terminal-title-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.status-radar-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #ef4444;
	}

	.status-radar-dot.pulsing {
		background: #10b981;
		box-shadow: 0 0 10px #10b981;
		animation: dotPulse 1.5s infinite;
	}

	@keyframes dotPulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.6;
		}
	}

	.terminal-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: 0.05em;
		font-family: monospace;
	}

	.log-count-badge {
		font-size: 0.7rem;
		font-weight: 700;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.terminal-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.terminal-action-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #d4d4d8;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.terminal-action-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.terminal-action-btn.clear:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.4);
	}

	/* Filter Tabs Bar */
	.filter-tabs-bar {
		display: flex;
		gap: 0.5rem;
		padding: 0.6rem 1.25rem;
		background: #070b12;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		overflow-x: auto;
	}

	.filter-pill {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #71717a;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		font-family: monospace;
		transition: all 0.2s ease;
	}

	.filter-pill:hover {
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.filter-pill.active {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border-color: #10b981;
	}

	/* Terminal Screen */
	.terminal-screen {
		height: 380px;
		overflow-y: auto;
		padding: 1rem 1.25rem;
		font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
		font-size: 0.82rem;
		line-height: 1.6;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		background: #04060a;
	}

	.empty-terminal {
		color: #71717a;
		font-style: italic;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.terminal-cursor {
		color: #10b981;
		font-weight: 900;
		animation: cursorBlink 1s infinite;
	}

	@keyframes cursorBlink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	.terminal-log-row {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		word-break: break-all;
	}

	.log-time {
		color: #52525b;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.log-level-tag {
		font-weight: 800;
		font-size: 0.72rem;
		padding: 0.05rem 0.35rem;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.badge-info {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}
	.badge-success {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}
	.badge-stream {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}
	.badge-search {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}
	.badge-ingest {
		background: rgba(236, 72, 153, 0.15);
		color: #f472b6;
	}
	.badge-warn {
		background: rgba(249, 115, 22, 0.15);
		color: #fb923c;
	}
	.badge-error {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.log-source {
		color: #71717a;
		font-weight: 600;
		flex-shrink: 0;
	}

	.log-msg {
		color: #e4e4e7;
	}

	.level-error .log-msg {
		color: #f87171;
	}
	.level-stream .log-msg {
		color: #e9d5ff;
	}
	.level-search .log-msg {
		color: #fef08a;
	}
	.level-ingest .log-msg {
		color: #fbcfe8;
	}

	/* Interactive CLI Command Form */
	.terminal-cli-form {
		background: #080d16;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.cli-prompt {
		color: #10b981;
		font-family: monospace;
		font-weight: 800;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.cli-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: #ffffff;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.cli-input::placeholder {
		color: #52525b;
	}

	.cli-enter-btn {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: #10b981;
		font-weight: 800;
		font-size: 0.72rem;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		font-family: monospace;
		letter-spacing: 0.05em;
		transition: all 0.2s ease;
	}

	.cli-enter-btn:hover {
		background: #10b981;
		color: #050507;
	}
</style>
