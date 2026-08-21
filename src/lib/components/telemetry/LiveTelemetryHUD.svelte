<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface TelemetryLog {
		id: string;
		timestamp: string;
		level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'STREAM' | 'SEARCH' | 'INGEST';
		source: string;
		message: string;
		metadata?: Record<string, any>;
	}

	let isOpen = $state(false);
	let isMinimized = $state(false);
	let autoOpen = $state(false);
	let logs = $state<TelemetryLog[]>([]);
	let isConnected = $state(false);
	let isPaused = $state(false);
	let activeFilter = $state<string>('ALL');
	let cmdInput = $state('');
	let terminalScrollEl = $state<HTMLDivElement | null>(null);
	let eventSource: EventSource | null = null;

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

	function connectSSE() {
		if (typeof window === 'undefined') return;

		eventSource = new EventSource('/api/telemetry/events');

		eventSource.onopen = () => {
			isConnected = true;
		};

		eventSource.onmessage = (e) => {
			if (isPaused) return;
			try {
				const log = JSON.parse(e.data) as TelemetryLog;
				logs = [...logs.slice(-100), log];
				scrollToBottom();
			} catch {}
		};

		eventSource.onerror = () => {
			isConnected = false;
		};
	}

	function scrollToBottom() {
		if (terminalScrollEl) {
			setTimeout(() => {
				if (terminalScrollEl) {
					terminalScrollEl.scrollTop = terminalScrollEl.scrollHeight;
				}
			}, 30);
		}
	}

	function handleCommand(e: SubmitEvent) {
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
					source: 'HUD_CLI',
					message: 'Available commands: ping, stats, clear, help'
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
					level: 'SUCCESS',
					source: 'PING',
					message: `PONG! Edge Platform Active | SSE: Connected`
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
					source: 'HUD_STATS',
					message: `Events Buffer: ${logs.length} | Status: Connected | Auto-Open: ${autoOpen}`
				}
			];
			cmdInput = '';
			scrollToBottom();
			return;
		}

		logs = [
			...logs,
			{
				id: crypto.randomUUID(),
				timestamp: time,
				level: 'INFO',
				source: 'USER',
				message: `$ ${raw}`
			}
		];
		cmdInput = '';
		scrollToBottom();
	}

	function toggleAutoOpen() {
		autoOpen = !autoOpen;
		if (typeof window !== 'undefined') {
			localStorage.setItem('alan_radar_auto_open', autoOpen ? 'true' : 'false');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
			e.preventDefault();
			isOpen = !isOpen;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('alan_radar_auto_open');
			if (saved === 'true') {
				autoOpen = true;
				isOpen = true;
			}
			window.addEventListener('keydown', handleKeydown);
		}
		connectSSE();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
		if (eventSource) eventSource.close();
	});
</script>

<!-- Floating HUD Trigger / Dock Button -->
<div class="telemetry-hud-root">
	{#if !isOpen}
		<button
			type="button"
			class="hud-trigger-btn"
			onclick={() => (isOpen = true)}
			title="Open Live Telemetry Radar (Ctrl+Shift+L)"
		>
			<span class="radar-dot" class:online={isConnected}></span>
			<span class="hud-label">LIVE RADAR</span>
			{#if logs.length > 0}
				<span class="event-badge">{logs.length}</span>
			{/if}
		</button>
	{:else}
		<!-- Pop-out Floating HUD Console -->
		<div class="hud-window glass-card" class:minimized={isMinimized}>
			<!-- Window Header -->
			<div class="hud-header">
				<div class="hud-brand">
					<span class="radar-dot" class:online={isConnected}></span>
					<span class="hud-title">ALAN RADAR • LIVE TELEMETRY</span>
					<span class="badge-count">{filteredLogs.length} events</span>
				</div>

				<div class="hud-controls">
					<button
						type="button"
						class="hud-btn"
						onclick={() => (isPaused = !isPaused)}
						title={isPaused ? 'Resume live feed' : 'Pause live feed'}
					>
						{isPaused ? '▶' : '⏸'}
					</button>
					<button
						type="button"
						class="hud-btn"
						onclick={() => (isMinimized = !isMinimized)}
						title={isMinimized ? 'Expand window' : 'Minimize window'}
					>
						{isMinimized ? '▢' : '—'}
					</button>
					<button
						type="button"
						class="hud-btn close"
						onclick={() => (isOpen = false)}
						title="Close Radar"
					>
						✕
					</button>
				</div>
			</div>

			{#if !isMinimized}
				<!-- Filter Chips Bar -->
				<div class="hud-filters">
					{#each ['ALL', 'STREAM', 'SEARCH', 'INGEST', 'AUTH', 'ERROR'] as tab}
						<button
							type="button"
							class="filter-chip"
							class:active={activeFilter === tab}
							onclick={() => (activeFilter = tab)}
						>
							{tab}
						</button>
					{/each}
				</div>

				<!-- Scrolling Logs Terminal Screen -->
				<div class="hud-screen" bind:this={terminalScrollEl}>
					{#if filteredLogs.length === 0}
						<div class="empty-feed">
							<span class="cursor">></span> Listening to live events... Search or stream a movie to see
							telemetry.
						</div>
					{:else}
						{#each filteredLogs as log (log.id)}
							<div class="log-line log-{log.level.toLowerCase()}">
								<span class="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
								<span class="lvl tag-{log.level.toLowerCase()}">[{log.level}]</span>
								<span class="src">[{log.source}]</span>
								<span class="msg">{log.message}</span>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Command Line Form & Auto-Open Setting -->
				<div class="hud-footer">
					<form onsubmit={handleCommand} class="hud-cli-form">
						<span class="prompt">$</span>
						<input
							type="text"
							bind:value={cmdInput}
							placeholder="Type command (ping, stats, clear, help)..."
							class="hud-input"
						/>
					</form>

					<div class="hud-options">
						<label class="auto-open-toggle" title="Automatically pop out on page load">
							<input type="checkbox" checked={autoOpen} onchange={toggleAutoOpen} />
							<span>Auto-open on start</span>
						</label>
						<button type="button" class="clear-btn" onclick={() => (logs = [])}>Clear</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.telemetry-hud-root {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 9999;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
	}

	/* Trigger Button */
	.hud-trigger-btn {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: rgba(9, 13, 20, 0.95);
		border: 1px solid rgba(16, 185, 129, 0.35);
		padding: 0.5rem 0.9rem;
		border-radius: 9999px;
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.6),
			0 0 12px rgba(16, 185, 129, 0.15);
		cursor: pointer;
		backdrop-filter: blur(12px);
		transition: all 0.2s ease;
	}

	.hud-trigger-btn:hover {
		border-color: #10b981;
		transform: translateY(-2px);
		box-shadow:
			0 6px 24px rgba(0, 0, 0, 0.8),
			0 0 16px rgba(16, 185, 129, 0.3);
	}

	.radar-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
	}

	.radar-dot.online {
		background: #10b981;
		box-shadow: 0 0 8px #10b981;
		animation: radarGlow 2s infinite;
	}

	@keyframes radarGlow {
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

	.hud-label {
		font-family: monospace;
	}

	.event-badge {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 9999px;
		font-weight: 700;
	}

	/* Pop-out HUD Window */
	.hud-window {
		width: 440px;
		max-width: calc(100vw - 2rem);
		background: rgba(6, 9, 14, 0.96);
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: 14px;
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.9),
			0 0 20px rgba(16, 185, 129, 0.08);
		backdrop-filter: blur(16px);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.hud-window.minimized {
		width: 320px;
	}

	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.hud-header {
		background: rgba(9, 14, 23, 0.95);
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hud-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hud-title {
		font-size: 0.75rem;
		font-weight: 800;
		color: #ffffff;
		font-family: monospace;
		letter-spacing: 0.05em;
	}

	.badge-count {
		font-size: 0.65rem;
		font-weight: 700;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.hud-controls {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.hud-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #a1a1aa;
		font-size: 0.7rem;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.hud-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.hud-btn.close:hover {
		background: rgba(239, 68, 68, 0.25);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.4);
	}

	/* Filter Chips */
	.hud-filters {
		display: flex;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: rgba(7, 11, 18, 0.9);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		overflow-x: auto;
	}

	.filter-chip {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #71717a;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		cursor: pointer;
		font-family: monospace;
		transition: all 0.15s ease;
	}

	.filter-chip.active {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border-color: #10b981;
	}

	/* Terminal Screen */
	.hud-screen {
		height: 240px;
		overflow-y: auto;
		padding: 0.75rem;
		font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
		font-size: 0.74rem;
		line-height: 1.5;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		background: #030508;
	}

	.empty-feed {
		color: #71717a;
		font-style: italic;
		font-size: 0.72rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.cursor {
		color: #10b981;
		font-weight: 800;
		animation: radarGlow 1s infinite;
	}

	.log-line {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		word-break: break-all;
	}

	.time {
		color: #52525b;
		font-size: 0.68rem;
		flex-shrink: 0;
	}
	.lvl {
		font-weight: 800;
		font-size: 0.66rem;
		padding: 0.05rem 0.25rem;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.src {
		color: #71717a;
		font-weight: 600;
		flex-shrink: 0;
		font-size: 0.68rem;
	}
	.msg {
		color: #e4e4e7;
	}

	.tag-info {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}
	.tag-success {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}
	.tag-stream {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}
	.tag-search {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}
	.tag-ingest {
		background: rgba(236, 72, 153, 0.15);
		color: #f472b6;
	}
	.tag-error {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.log-error .msg {
		color: #f87171;
	}
	.log-stream .msg {
		color: #e9d5ff;
	}
	.log-search .msg {
		color: #fef08a;
	}

	/* Footer & CLI Input */
	.hud-footer {
		background: rgba(8, 12, 20, 0.95);
		padding: 0.5rem 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hud-cli-form {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.prompt {
		color: #10b981;
		font-family: monospace;
		font-weight: 800;
		font-size: 0.75rem;
	}

	.hud-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: #ffffff;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.hud-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.3rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.auto-open-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.68rem;
		color: #a1a1aa;
		cursor: pointer;
	}

	.auto-open-toggle input {
		accent-color: #10b981;
	}

	.clear-btn {
		background: transparent;
		border: none;
		color: #71717a;
		font-size: 0.68rem;
		cursor: pointer;
	}

	.clear-btn:hover {
		color: #ef4444;
	}
</style>
