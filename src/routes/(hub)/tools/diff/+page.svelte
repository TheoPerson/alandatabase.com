<script lang="ts">
	let mode: 'diff' | 'regex' = $state('diff');

	// Diff state
	let originalText = $state(
		'// Original Configuration\nconst apiEndpoint = "https://api.v1.example.com";\nconst timeout = 5000;\nconst retries = 3;\nconst debug = true;'
	);
	let modifiedText = $state(
		'// Updated 2026 Configuration\nconst apiEndpoint = "https://alandatabase.com/api";\nconst timeout = 3000;\nconst retries = 5;\nconst debug = false;\nconst theme = "swiss-oled";'
	);

	type DiffLine = {
		type: 'same' | 'added' | 'removed' | 'changed';
		orig: string;
		mod: string;
		lineNum: number;
	};

	let diffLines = $derived.by(() => {
		const origLines = originalText.split('\n');
		const modLines = modifiedText.split('\n');
		const max = Math.max(origLines.length, modLines.length);

		const result: DiffLine[] = [];
		for (let i = 0; i < max; i++) {
			const orig = origLines[i] ?? '';
			const mod = modLines[i] ?? '';

			if (orig === mod) {
				result.push({ type: 'same', orig, mod, lineNum: i + 1 });
			} else if (!orig && mod) {
				result.push({ type: 'added', orig: '', mod, lineNum: i + 1 });
			} else if (orig && !mod) {
				result.push({ type: 'removed', orig, mod: '', lineNum: i + 1 });
			} else {
				result.push({ type: 'changed', orig, mod, lineNum: i + 1 });
			}
		}
		return result;
	});

	// Regex state
	let regexPattern = $state('(https?:\\/\\/[^\\s"]+)');
	let regexFlags = $state('gi');
	let sampleText = $state(
		'Welcome to Alan Database OS.\nVisit https://alandatabase.com for status.\nAPI Gateway at https://api.themoviedb.org/3.'
	);
	let replacePattern = $state('<a href="$1">$1</a>');

	type RegexMatch = { text: string; index: number; groups: string[] };

	let regexMatches = $derived.by(() => {
		if (!regexPattern) return [];
		try {
			const re = new RegExp(regexPattern, regexFlags);
			const matches: RegexMatch[] = [];
			let match: RegExpExecArray | null;
			if (regexFlags.includes('g')) {
				while ((match = re.exec(sampleText)) !== null) {
					matches.push({ text: match[0], index: match.index, groups: match.slice(1) });
					if (match.index === re.lastIndex) re.lastIndex++;
				}
			} else {
				match = re.exec(sampleText);
				if (match) matches.push({ text: match[0], index: match.index, groups: match.slice(1) });
			}
			return matches;
		} catch {
			return [];
		}
	});

	let replacedOutput = $derived.by(() => {
		if (!regexPattern) return sampleText;
		try {
			const re = new RegExp(regexPattern, regexFlags);
			return sampleText.replace(re, replacePattern);
		} catch {
			return sampleText;
		}
	});
</script>

<svelte:head>
	<title>Diff & Regex Studio | Alan Vault</title>
</svelte:head>

<div class="linear-grid-bg"></div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Vault Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">⚡</span> Diff & Regex Studio Pro</h1>
			<div class="mode-tabs">
				<button class="mode-btn" class:active={mode === 'diff'} onclick={() => (mode = 'diff')}>
					Side-by-Side Diff
				</button>
				<button class="mode-btn" class:active={mode === 'regex'} onclick={() => (mode = 'regex')}>
					Live Regex Evaluator
				</button>
			</div>
		</div>
		<p class="tool-subtitle">
			High-speed side-by-side text comparison, line diffing, and regular expression pattern matcher.
		</p>
	</div>

	{#if mode === 'diff'}
		<div class="diff-workspace">
			<div class="editor-pane">
				<div class="pane-header">
					<span class="pane-title">Original Text</span>
					<span class="line-count">{originalText.split('\n').length} lines</span>
				</div>
				<textarea bind:value={originalText} class="code-editor" placeholder="Paste original text..."
				></textarea>
			</div>

			<div class="editor-pane">
				<div class="pane-header">
					<span class="pane-title">Modified Text</span>
					<span class="line-count">{modifiedText.split('\n').length} lines</span>
				</div>
				<textarea bind:value={modifiedText} class="code-editor" placeholder="Paste modified text..."
				></textarea>
			</div>
		</div>

		<!-- Rendered Visual Diff -->
		<div class="diff-output-card">
			<div class="output-header">
				<span class="output-title">LINE-BY-LINE COMPARISON</span>
				<div class="legend">
					<span class="leg-item added">+ Added</span>
					<span class="leg-item removed">- Removed</span>
					<span class="leg-item changed">~ Modified</span>
				</div>
			</div>
			<div class="diff-lines-wrapper">
				{#each diffLines as d}
					<div class="diff-row {d.type}">
						<span class="line-no">{d.lineNum}</span>
						<div class="diff-content">
							{#if d.type === 'same'}
								<span class="text-same">{d.orig}</span>
							{:else if d.type === 'changed'}
								<div class="split-line">
									<span class="text-del">- {d.orig}</span>
									<span class="text-add">+ {d.mod}</span>
								</div>
							{:else if d.type === 'added'}
								<span class="text-add">+ {d.mod}</span>
							{:else if d.type === 'removed'}
								<span class="text-del">- {d.orig}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Regex Mode -->
		<div class="regex-controls-card">
			<div class="regex-input-group">
				<span class="regex-slash">/</span>
				<input
					type="text"
					bind:value={regexPattern}
					placeholder="Enter regex pattern..."
					class="regex-input"
				/>
				<span class="regex-slash">/</span>
				<input type="text" bind:value={regexFlags} placeholder="flags" class="flags-input" />
				<span class="match-badge">{regexMatches.length} matches found</span>
			</div>

			<div class="replace-input-group">
				<span class="label">Replace pattern:</span>
				<input
					type="text"
					bind:value={replacePattern}
					class="replace-input"
					placeholder="e.g. $1 or replacement string"
				/>
			</div>
		</div>

		<div class="regex-workspace">
			<div class="editor-pane">
				<div class="pane-header">
					<span class="pane-title">Input Sample Text</span>
				</div>
				<textarea
					bind:value={sampleText}
					class="code-editor"
					placeholder="Type or paste sample text..."></textarea>
			</div>

			<div class="editor-pane">
				<div class="pane-header">
					<span class="pane-title">Replacement Output</span>
				</div>
				<pre class="regex-output">{replacedOutput}</pre>
			</div>
		</div>

		{#if regexMatches.length > 0}
			<div class="matches-card">
				<div class="output-header">
					<span class="output-title">CAPTURED MATCHES & GROUPS</span>
				</div>
				<div class="matches-list">
					{#each regexMatches as m, idx}
						<div class="match-item">
							<span class="match-idx">#{idx + 1}</span>
							<code class="match-val">{m.text}</code>
							<span class="match-pos">Index: {m.index}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
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
		gap: 2rem;
		animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.back-link {
		font-size: 0.85rem;
		font-weight: 700;
		color: #10b981;
		text-decoration: none;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
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

	.mode-tabs {
		display: flex;
		background: rgba(255, 255, 255, 0.05);
		padding: 3px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.mode-btn {
		padding: 0.4rem 0.9rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #a1a1aa;
		background: transparent;
		border: none;
		border-radius: 9px;
		cursor: pointer;
		transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.mode-btn:hover:not(.active) {
		color: #f4f4f5;
		background: rgba(255, 255, 255, 0.08);
	}

	.mode-btn.active {
		background: #10b981;
		color: #050507;
		box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
	}

	.tool-subtitle {
		color: #a1a1aa;
		font-size: 0.95rem;
		margin: 0.2rem 0 0 0;
	}

	.diff-workspace,
	.regex-workspace {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
		gap: 1.5rem;
	}

	.editor-pane {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		transition:
			transform 300ms ease,
			box-shadow 300ms ease;
	}

	.editor-pane:focus-within {
		transform: translateY(-2px);
		box-shadow:
			0 12px 40px rgba(16, 185, 129, 0.08),
			0 0 0 1px rgba(16, 185, 129, 0.3);
	}

	.pane-header {
		padding: 0.9rem 1.25rem;
		background: rgba(18, 18, 24, 0.5);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pane-title {
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #a1a1aa;
		text-transform: uppercase;
	}

	.line-count {
		font-size: 0.75rem;
		color: #71717a;
	}

	.code-editor {
		width: 100%;
		height: 260px;
		background: #09090d;
		border: none;
		color: #f4f4f5;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: 1.25rem;
		outline: none;
		resize: vertical;
		line-height: 1.5;
		transition: background-color 200ms ease;
	}

	.code-editor:focus {
		background: #0c0c11;
	}

	.regex-output {
		width: 100%;
		height: 260px;
		background: #09090d;
		color: #10b981;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: 1.25rem;
		margin: 0;
		overflow: auto;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.diff-output-card,
	.regex-controls-card,
	.matches-card {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.5rem;
		backdrop-filter: blur(16px);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.output-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.output-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
	}

	.legend {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.leg-item.added {
		color: #10b981;
	}
	.leg-item.removed {
		color: #ef4444;
	}
	.leg-item.changed {
		color: #3b82f6;
	}

	.diff-lines-wrapper {
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: #09090d;
		border-radius: 12px;
		padding: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		max-height: 380px;
		overflow-y: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.diff-row {
		display: flex;
		gap: 1rem;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		transition:
			transform 150ms ease,
			background-color 150ms ease;
	}

	.diff-row:hover {
		transform: translateX(2px);
	}

	.diff-row.added {
		background: rgba(16, 185, 129, 0.12);
	}
	.diff-row.added:hover {
		background: rgba(16, 185, 129, 0.18);
	}

	.diff-row.removed {
		background: rgba(239, 68, 68, 0.12);
	}
	.diff-row.removed:hover {
		background: rgba(239, 68, 68, 0.18);
	}

	.diff-row.changed {
		background: rgba(59, 130, 246, 0.12);
	}
	.diff-row.changed:hover {
		background: rgba(59, 130, 246, 0.18);
	}

	.line-no {
		color: #71717a;
		width: 30px;
		flex-shrink: 0;
		user-select: none;
	}

	.text-same {
		color: #a1a1aa;
	}
	.text-add {
		color: #10b981;
		font-weight: 600;
	}
	.text-del {
		color: #ef4444;
		font-weight: 600;
	}

	.regex-input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #09090d;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 0.6rem 1rem;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.regex-input-group:focus-within {
		border-color: rgba(16, 185, 129, 0.4);
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
	}

	.regex-slash {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: #10b981;
		font-weight: 800;
	}

	.regex-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: #f4f4f5;
		font-family: var(--font-mono);
		font-size: 0.95rem;
	}

	.flags-input {
		width: 60px;
		background: transparent;
		border: none;
		outline: none;
		color: #10b981;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.match-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
	}

	.replace-input-group {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.85rem;
		color: #a1a1aa;
	}

	.replace-input {
		flex: 1;
		background: #09090d;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.5rem 0.85rem;
		color: #f4f4f5;
		font-family: var(--font-mono);
		outline: none;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.replace-input:focus {
		border-color: rgba(16, 185, 129, 0.4);
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
	}

	.matches-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.match-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #09090d;
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		font-size: 0.8rem;
	}

	.match-idx {
		color: #71717a;
		font-weight: 700;
	}
	.match-val {
		color: #10b981;
		font-weight: 700;
	}
	.match-pos {
		color: #71717a;
		font-size: 0.75rem;
	}
</style>
