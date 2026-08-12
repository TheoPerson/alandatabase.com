<script lang="ts">
	let activeTab: 'uuid' | 'password' | 'base64' | 'qr' = $state('uuid');

	// UUID Generator State
	let uuidCount = $state(5);
	let generatedUuids = $state<string[]>([]);

	function generateUuids() {
		const list: string[] = [];
		for (let i = 0; i < uuidCount; i++) {
			list.push(crypto.randomUUID());
		}
		generatedUuids = list;
	}

	// Password Generator State
	let passLength = $state(18);
	let useUpper = $state(true);
	let useLower = $state(true);
	let useNums = $state(true);
	let useSymbols = $state(true);
	let generatedPassword = $state('');

	function generatePassword() {
		let chars = '';
		if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
		if (useNums) chars += '0123456789';
		if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
		if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

		const array = new Uint32Array(passLength);
		crypto.getRandomValues(array);
		let pass = '';
		for (let i = 0; i < passLength; i++) {
			pass += chars[array[i] % chars.length];
		}
		generatedPassword = pass;
	}

	// Base64 State
	let base64Input = $state('Hello Alan Database OS 2026!');
	let base64Encoded = $derived.by(() => {
		try {
			return btoa(base64Input);
		} catch {
			return 'Invalid input for Base64 encoding';
		}
	});
	let base64Decoded = $derived.by(() => {
		try {
			return atob(base64Input);
		} catch {
			return 'Invalid Base64 string for decoding';
		}
	});

	// QR Code State
	let qrText = $state('https://alandatabase.com');
	let qrUrl = $derived(
		`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrText)}`
	);

	let copiedText = $state(false);

	function copyToClipboard(val: string) {
		navigator.clipboard.writeText(val);
		copiedText = true;
		setTimeout(() => (copiedText = false), 2000);
	}

	// Initial generation
	generateUuids();
	generatePassword();
</script>

<svelte:head>
	<title>Generator Vault | Alan Tools</title>
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
			<h1 class="tool-title"><span class="icon">🪄</span> Generator Vault Pro</h1>
			<span class="tool-badge">SECURE VAULT</span>
		</div>
		<p class="tool-subtitle">
			Batch UUID v4, cryptographically secure passwords, Base64 encoder/decoder, and QR Codes.
		</p>
	</div>

	<!-- Control Bar -->
	<div class="control-bar glass-card">
		<div class="tabs">
			<button
				class="tab-btn"
				class:active={activeTab === 'uuid'}
				onclick={() => (activeTab = 'uuid')}
			>
				🆔 UUID v4
			</button>
			<button
				class="tab-btn"
				class:active={activeTab === 'password'}
				onclick={() => (activeTab = 'password')}
			>
				🔑 Passwords & Tokens
			</button>
			<button
				class="tab-btn"
				class:active={activeTab === 'base64'}
				onclick={() => (activeTab = 'base64')}
			>
				🔤 Base64 Codec
			</button>
			<button class="tab-btn" class:active={activeTab === 'qr'} onclick={() => (activeTab = 'qr')}>
				📱 QR Code Generator
			</button>
		</div>
	</div>

	<div class="workspace-pane glass-card">
		{#if activeTab === 'uuid'}
			<div class="pane-content">
				<div class="config-row">
					<label class="form-label" for="uuidQuantityRange">Count: {uuidCount} UUIDs</label>
					<input
						id="uuidQuantityRange"
						type="range"
						min="1"
						max="25"
						bind:value={uuidCount}
						oninput={generateUuids}
						class="range-slider"
					/>
					<button class="gen-btn" onclick={generateUuids}>🔄 Re-Generate</button>
				</div>
				<div class="uuids-list">
					{#each generatedUuids as uuid}
						<div class="uuid-card">
							<code>{uuid}</code>
							<button class="copy-icon-btn" onclick={() => copyToClipboard(uuid)}>📋</button>
						</div>
					{/each}
				</div>
			</div>
		{:else if activeTab === 'password'}
			<div class="pane-content">
				<div class="password-display-box">
					<span class="pass-text">{generatedPassword}</span>
					<button class="copy-pass-btn" onclick={() => copyToClipboard(generatedPassword)}>
						{copiedText ? '✓ Copied' : '📋 Copy Token'}
					</button>
					<button class="regen-btn" onclick={generatePassword}>🔄 New Token</button>
				</div>

				<div class="pass-options">
					<div class="opt-row">
						<label class="form-label" for="tokenLengthSlider">Length: {passLength} characters</label
						>
						<input
							id="tokenLengthSlider"
							type="range"
							min="8"
							max="64"
							bind:value={passLength}
							oninput={generatePassword}
							class="range-slider"
						/>
					</div>
					<div class="checkbox-grid">
						<label
							><input type="checkbox" bind:checked={useUpper} onchange={generatePassword} /> Uppercase
							(A-Z)</label
						>
						<label
							><input type="checkbox" bind:checked={useLower} onchange={generatePassword} /> Lowercase
							(a-z)</label
						>
						<label
							><input type="checkbox" bind:checked={useNums} onchange={generatePassword} /> Numbers (0-9)</label
						>
						<label
							><input type="checkbox" bind:checked={useSymbols} onchange={generatePassword} /> Symbols
							(!@#$%)</label
						>
					</div>
				</div>
			</div>
		{:else if activeTab === 'base64'}
			<div class="pane-content split">
				<div class="codec-box">
					<span class="pane-title">Input Text</span>
					<textarea class="codec-area" bind:value={base64Input}></textarea>
				</div>
				<div class="codec-box">
					<span class="pane-title">Encoded Base64</span>
					<textarea class="codec-area output" readonly value={base64Encoded}></textarea>
					<button class="copy-codec-btn" onclick={() => copyToClipboard(base64Encoded)}
						>📋 Copy Base64</button
					>
				</div>
			</div>
		{:else if activeTab === 'qr'}
			<div class="pane-content qr-layout">
				<div class="qr-inputs">
					<span class="pane-title">Target URL or Data String</span>
					<input
						type="text"
						class="qr-text-input"
						bind:value={qrText}
						placeholder="https://example.com"
					/>
				</div>
				<div class="qr-preview-box">
					<img src={qrUrl} alt="Generated QR Code" class="qr-image" />
					<a href={qrUrl} download="qrcode.png" target="_blank" class="download-qr-btn">
						💾 Download QR PNG
					</a>
				</div>
			</div>
		{/if}
	</div>
</main>

<style>
	.tool-container {
		max-width: 1100px;
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
		color: var(--accent-rose);
		background: rgba(244, 63, 94, 0.15);
		border: 1px solid rgba(244, 63, 94, 0.3);
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
		background: var(--accent-rose);
		color: #ffffff;
	}

	.workspace-pane {
		padding: 2rem;
		min-height: 400px;
	}

	.pane-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pane-content.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.config-row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.range-slider {
		flex: 1;
		accent-color: var(--accent-rose);
	}

	.gen-btn {
		padding: 0.6rem 1.25rem;
		background: var(--accent-rose);
		color: #ffffff;
		border-radius: var(--radius-md);
		font-weight: 700;
	}

	.uuids-list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-height: 380px;
		overflow-y: auto;
	}

	.uuid-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.copy-icon-btn {
		font-size: 1rem;
	}

	/* Password styles */
	.password-display-box {
		padding: 1.25rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.pass-text {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--accent-gold);
		word-break: break-all;
	}

	.copy-pass-btn,
	.regen-btn {
		padding: 0.6rem 1rem;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.85rem;
	}

	.copy-pass-btn {
		background: var(--accent-gold);
		color: var(--bg-primary);
	}
	.regen-btn {
		background: var(--bg-surface-3);
		color: var(--text-primary);
	}

	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.codec-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pane-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.codec-area {
		height: 180px;
		padding: 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		resize: none;
	}

	.codec-area.output {
		color: var(--accent-rose);
	}

	.copy-codec-btn {
		padding: 0.6rem;
		background: var(--bg-surface-3);
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.qr-layout {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.qr-inputs {
		width: 100%;
		max-width: 500px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.qr-text-input {
		padding: 0.85rem 1.25rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
	}

	.qr-preview-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: #ffffff;
		border-radius: var(--radius-lg);
	}

	.qr-image {
		width: 220px;
		height: 220px;
	}

	.download-qr-btn {
		padding: 0.6rem 1.25rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.85rem;
	}
</style>
