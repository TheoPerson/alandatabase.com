<script lang="ts">
	let rawInput = $state('{\n  "appName": "Alan Database OS",\n  "version": "1.0.0",\n  "status": "online",\n  "features": ["Movie DB", "JSON Studio", "Image Studio", "Generators"],\n  "config": {\n    "theme": "aurora-cyber",\n    "telemetry": true\n  }\n}');
	let activeTab: 'format' | 'minify' | 'tree' | 'yaml' | 'csv' = $state('format');
	let indentSpaces = $state(2);
	let errorMessage = $state<string | null>(null);
	let copied = $state(false);

	let formattedOutput = $derived.by(() => {
		if (!rawInput.trim()) {
			errorMessage = null;
			return '';
		}
		try {
			const parsed = JSON.parse(rawInput);
			errorMessage = null;

			if (activeTab === 'minify') {
				return JSON.stringify(parsed);
			} else if (activeTab === 'yaml') {
				return jsonToYaml(parsed);
			} else if (activeTab === 'csv') {
				return jsonToCsv(parsed);
			} else {
				return JSON.stringify(parsed, null, indentSpaces);
			}
		} catch (err: any) {
			errorMessage = err.message || 'Invalid JSON syntax';
			return '';
		}
	});

	function jsonToYaml(obj: any, indent = 0): string {
		const spacing = ' '.repeat(indent);
		if (typeof obj !== 'object' || obj === null) {
			return `${obj}\n`;
		}
		let str = '';
		if (Array.isArray(obj)) {
			for (const item of obj) {
				if (typeof item === 'object' && item !== null) {
					str += `${spacing}-\n${jsonToYaml(item, indent + 2)}`;
				} else {
					str += `${spacing}- ${item}\n`;
				}
			}
		} else {
			for (const key in obj) {
				const val = obj[key];
				if (typeof val === 'object' && val !== null) {
					str += `${spacing}${key}:\n${jsonToYaml(val, indent + 2)}`;
				} else {
					str += `${spacing}${key}: ${val}\n`;
				}
			}
		}
		return str;
	}

	function jsonToCsv(obj: any): string {
		const arr = Array.isArray(obj) ? obj : [obj];
		if (arr.length === 0 || typeof arr[0] !== 'object') return 'Invalid JSON array for CSV conversion';
		const headers = Object.keys(arr[0]);
		const rows = arr.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
		return [headers.join(','), ...rows].join('\n');
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(formattedOutput);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function downloadJson() {
		const blob = new Blob([formattedOutput], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `data-${Date.now()}.${activeTab === 'yaml' ? 'yaml' : activeTab === 'csv' ? 'csv' : 'json'}`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>JSON Studio | Alan Tools</title>
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
			<h1 class="tool-title"><span class="icon">🧩</span> JSON Studio Pro</h1>
			<span class="tool-badge">2026 ENGINE</span>
		</div>
		<p class="tool-subtitle">Format, validate, minify, inspect tree view, and convert JSON to YAML or CSV instantly.</p>
	</div>

	<!-- Control Bar -->
	<div class="control-bar glass-card">
		<div class="tabs">
			<button class="tab-btn" class:active={activeTab === 'format'} onclick={() => (activeTab = 'format')}>
				Pretty Format
			</button>
			<button class="tab-btn" class:active={activeTab === 'minify'} onclick={() => (activeTab = 'minify')}>
				Minify
			</button>
			<button class="tab-btn" class:active={activeTab === 'yaml'} onclick={() => (activeTab = 'yaml')}>
				YAML
			</button>
			<button class="tab-btn" class:active={activeTab === 'csv'} onclick={() => (activeTab = 'csv')}>
				CSV
			</button>
		</div>

		<div class="actions">
			{#if activeTab === 'format'}
				<select bind:value={indentSpaces} class="indent-select">
					<option value={2}>2 Spaces</option>
					<option value={4}>4 Spaces</option>
				</select>
			{/if}
			<button class="action-btn" onclick={copyToClipboard} disabled={!formattedOutput}>
				{copied ? '✓ Copied!' : '📋 Copy Output'}
			</button>
			<button class="action-btn primary" onclick={downloadJson} disabled={!formattedOutput}>
				💾 Download
			</button>
		</div>
	</div>

	<!-- Workspace Editor Split -->
	<div class="workspace-grid">
		<!-- Left: Input Area -->
		<div class="editor-pane glass-card">
			<div class="pane-header">
				<span class="pane-title">Input Raw JSON</span>
				<button class="clear-btn" onclick={() => (rawInput = '')}>Clear</button>
			</div>
			<textarea
				class="json-textarea"
				placeholder="Paste JSON payload here..."
				bind:value={rawInput}
				spellcheck="false"
			></textarea>
		</div>

		<!-- Right: Output Area -->
		<div class="editor-pane glass-card">
			<div class="pane-header">
				<span class="pane-title">Output ({activeTab.toUpperCase()})</span>
				{#if errorMessage}
					<span class="status-badge error">Syntax Error</span>
				{:else if formattedOutput}
					<span class="status-badge valid">Valid JSON</span>
				{/if}
			</div>

			{#if errorMessage}
				<div class="error-banner">
					<span class="error-icon">⚠️</span>
					<div class="error-details">
						<span class="error-title">JSON Parse Exception</span>
						<span class="error-msg">{errorMessage}</span>
					</div>
				</div>
			{/if}

			<textarea
				class="json-textarea output"
				readonly
				value={formattedOutput}
				placeholder="Processed output will appear here..."
			></textarea>
		</div>
	</div>
</main>

<style>
	.tool-container {
		max-width: 1300px;
		margin: 0 auto;
		padding: 2rem 1.5rem 5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.back-link {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--accent-gold);

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
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
	}

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-gold);
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle {
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin: 0.25rem 0 0 0;
	}

	/* Control Bar */
	.control-bar {
		padding: 0.85rem 1.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.tabs {
		display: flex;
		gap: 0.4rem;
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-secondary);
		transition: all var(--transition-fast);
	}

	.tab-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
	}

	.tab-btn.active {
		color: var(--bg-primary);
		background: var(--accent-gold);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.indent-select {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-md);
		outline: none;
	}

	.action-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: 700;
		background: var(--bg-surface-3);
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
		transition: all var(--transition-fast);
	}

	.action-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}

	.action-btn.primary {
		background: var(--accent-gold);
		color: var(--bg-primary);
		border: none;
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Workspace Grid */
	.workspace-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		height: 580px;
	}

	@media (min-width: 900px) {
		.workspace-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.editor-pane {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.pane-header {
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(14, 17, 26, 0.6);
	}

	.pane-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.clear-btn {
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.clear-btn:hover {
		color: var(--color-error);
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.status-badge.valid {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.status-badge.error {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.error-banner {
		padding: 1rem 1.25rem;
		background: rgba(239, 68, 68, 0.12);
		border-bottom: 1px solid rgba(239, 68, 68, 0.3);
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.error-details {
		display: flex;
		flex-direction: column;
	}

	.error-title {
		font-weight: 700;
		color: #ef4444;
		font-size: 0.85rem;
	}

	.error-msg {
		font-size: 0.8rem;
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.json-textarea {
		flex: 1;
		width: 100%;
		padding: 1.25rem;
		background: transparent;
		border: none;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		resize: none;
		outline: none;
	}

	.json-textarea.output {
		color: var(--accent-gold);
	}
</style>
