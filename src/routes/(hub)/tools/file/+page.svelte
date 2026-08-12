<script lang="ts">
	let inputText = $state('Alan Database OS 2026\nPersonal Command Vault\nDeveloper Utilities & Tools\nAlan Database OS 2026');
	let activeTab: 'hash' | 'case' | 'sort' | 'regex' = $state('hash');

	// Hash state
	let sha256Hash = $state('');
	let sha512Hash = $state('');

	// Case state
	let caseOutputs = $derived.by(() => {
		const text = inputText;
		const cleanWords = text.trim().split(/\s+/);
		return {
			camel: cleanWords.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
			snake: cleanWords.map(w => w.toLowerCase()).join('_'),
			kebab: cleanWords.map(w => w.toLowerCase()).join('-'),
			constant: cleanWords.map(w => w.toUpperCase()).join('_'),
			upper: text.toUpperCase(),
			lower: text.toLowerCase()
		};
	});

	// Sort state
	let sortOutput = $derived.by(() => {
		const lines = inputText.split('\n');
		return {
			alphabetical: [...lines].sort().join('\n'),
			unique: [...new Set(lines)].join('\n'),
			reverse: [...lines].reverse().join('\n')
		};
	});

	// Regex state
	let regexPattern = $state('(\\w+)');
	let regexFlags = $state('g');
	let regexMatches = $derived.by(() => {
		if (!regexPattern) return [];
		try {
			const re = new RegExp(regexPattern, regexFlags);
			const matches = [...inputText.matchAll(re)];
			return matches.map(m => m[0]);
		} catch (e) {
			return ['Invalid Regular Expression'];
		}
	});

	async function computeHashes() {
		if (!inputText) {
			sha256Hash = '';
			sha512Hash = '';
			return;
		}
		const encoder = new TextEncoder();
		const data = encoder.encode(inputText);

		const buffer256 = await crypto.subtle.digest('SHA-256', data);
		sha256Hash = Array.from(new Uint8Array(buffer256)).map(b => b.toString(16).padStart(2, '0')).join('');

		const buffer512 = await crypto.subtle.digest('SHA-512', data);
		sha512Hash = Array.from(new Uint8Array(buffer512)).map(b => b.toString(16).padStart(2, '0')).join('');
	}

	$effect(() => {
		computeHashes();
	});

	function copyVal(val: string) {
		navigator.clipboard.writeText(val);
	}
</script>

<svelte:head>
	<title>File & Text Utilities | Alan Tools</title>
</svelte:head>

<!-- Aurora Backdrop -->
<div class="aurora-backdrop">
	<div class="aurora-blob aurora-blob-2"></div>
	<div class="aurora-blob aurora-blob-3"></div>
	<div class="cyber-grid-overlay"></div>
</div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">📄</span> File & Text Utilities</h1>
			<span class="tool-badge">CRYPTO & TEXT ENGINE</span>
		</div>
		<p class="tool-subtitle">Cryptographic hash generators (SHA-256/512), text case converters, line sorters & regex matchers.</p>
	</div>

	<!-- Control Bar -->
	<div class="control-bar glass-card">
		<div class="tabs">
			<button class="tab-btn" class:active={activeTab === 'hash'} onclick={() => (activeTab = 'hash')}>
				🔐 Hash Generator
			</button>
			<button class="tab-btn" class:active={activeTab === 'case'} onclick={() => (activeTab = 'case')}>
				🔤 Case Converter
			</button>
			<button class="tab-btn" class:active={activeTab === 'sort'} onclick={() => (activeTab = 'sort')}>
				🧹 Line Sorter
			</button>
			<button class="tab-btn" class:active={activeTab === 'regex'} onclick={() => (activeTab = 'regex')}>
				🎯 Regex Tester
			</button>
		</div>
	</div>

	<div class="workspace-grid">
		<!-- Input Box -->
		<div class="editor-pane glass-card">
			<div class="pane-header">
				<span class="pane-title">Input Text Payload</span>
				<span class="char-count">{inputText.length} chars | {inputText.split('\n').length} lines</span>
			</div>
			<textarea class="textarea" bind:value={inputText} placeholder="Type or paste input text here..."></textarea>
		</div>

		<!-- Processed Output Box -->
		<div class="editor-pane glass-card">
			{#if activeTab === 'hash'}
				<div class="pane-header"><span class="pane-title">Cryptographic Hashes</span></div>
				<div class="results-box">
					<div class="hash-item">
						<div class="hash-head">
							<span class="hash-label">SHA-256</span>
							<button class="copy-sm" onclick={() => copyVal(sha256Hash)}>Copy</button>
						</div>
						<div class="hash-val">{sha256Hash || '...'}</div>
					</div>

					<div class="hash-item">
						<div class="hash-head">
							<span class="hash-label">SHA-512</span>
							<button class="copy-sm" onclick={() => copyVal(sha512Hash)}>Copy</button>
						</div>
						<div class="hash-val scroll">{sha512Hash || '...'}</div>
					</div>
				</div>
			{:else if activeTab === 'case'}
				<div class="pane-header"><span class="pane-title">Case Conversions</span></div>
				<div class="results-box">
					<div class="case-row"><span class="lbl">camelCase:</span><code>{caseOutputs.camel}</code></div>
					<div class="case-row"><span class="lbl">snake_case:</span><code>{caseOutputs.snake}</code></div>
					<div class="case-row"><span class="lbl">kebab-case:</span><code>{caseOutputs.kebab}</code></div>
					<div class="case-row"><span class="lbl">CONSTANT_CASE:</span><code>{caseOutputs.constant}</code></div>
				</div>
			{:else if activeTab === 'sort'}
				<div class="pane-header"><span class="pane-title">Deduplicated & Sorted Text</span></div>
				<textarea class="textarea" readonly value={sortOutput.unique}></textarea>
			{:else if activeTab === 'regex'}
				<div class="pane-header">
					<span class="pane-title">Regex Matches</span>
					<div class="regex-inputs">
						<input type="text" bind:value={regexPattern} class="regex-input" placeholder="Pattern (e.g. \w+)" />
						<input type="text" bind:value={regexFlags} class="flag-input" placeholder="Flags" />
					</div>
				</div>
				<div class="results-box">
					<span class="count-badge">{regexMatches.length} matches found</span>
					<div class="matches-list">
						{#each regexMatches as match, idx}
							<div class="match-item"><span class="idx">#{idx + 1}</span> {match}</div>
						{/each}
					</div>
				</div>
			{/if}
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
		color: var(--accent-cyan);
		background: rgba(6, 182, 212, 0.15);
		border: 1px solid rgba(6, 182, 212, 0.3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle {
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin: 0.25rem 0 0 0;
	}

	.control-bar {
		padding: 0.85rem 1.25rem;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.tab-btn.active {
		background: var(--accent-cyan);
		color: #000000;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		min-height: 480px;
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
	}

	.char-count {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.textarea {
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

	.results-box {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}

	.hash-item {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hash-head {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--accent-cyan);
	}

	.copy-sm {
		font-size: 0.75rem;
		padding: 0.15rem 0.4rem;
		background: var(--bg-surface-3);
		border-radius: 4px;
		color: var(--text-secondary);
	}

	.hash-val {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: var(--bg-surface-2);
		padding: 0.6rem;
		border-radius: var(--radius-md);
		word-break: break-all;
	}

	.hash-val.scroll {
		max-height: 100px;
		overflow-y: auto;
	}

	.case-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.case-row code {
		font-family: var(--font-mono);
		background: var(--bg-surface-2);
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		color: var(--accent-gold);
	}

	.regex-inputs {
		display: flex;
		gap: 0.4rem;
	}

	.regex-input, .flag-input {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		padding: 0.3rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
	}

	.flag-input { width: 50px; }

	.count-badge {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
	}

	.matches-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.match-item {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: 0.4rem 0.6rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
	}

	.idx { color: var(--text-tertiary); margin-right: 0.5rem; }
</style>
