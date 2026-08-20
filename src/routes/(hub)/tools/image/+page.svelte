<script lang="ts">
	let selectedFile: File | null = $state(null);
	let previewUrl: string | null = $state(null);
	let originalWidth = $state(0);
	let originalHeight = $state(0);
	let originalSize = $state(0);

	let targetWidth = $state(0);
	let targetHeight = $state(0);
	let targetFormat: 'png' | 'jpeg' | 'webp' | 'gif' = $state('webp');
	let targetQuality = $state(85);
	let keepAspect = $state(true);

	let base64Output = $state('');
	let copiedBase64 = $state(false);
	let isProcessing = $state(false);

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			loadFile(input.files[0]);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			loadFile(e.dataTransfer.files[0]);
		}
	}

	function loadFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		selectedFile = file;
		originalSize = file.size;

		const reader = new FileReader();
		reader.onload = (e) => {
			previewUrl = e.target?.result as string;
			base64Output = previewUrl;

			const img = new Image();
			img.onload = () => {
				originalWidth = img.width;
				originalHeight = img.height;
				targetWidth = img.width;
				targetHeight = img.height;
			};
			img.src = previewUrl;
		};
		reader.readAsDataURL(file);
	}

	function updateWidth(newW: number) {
		targetWidth = newW;
		if (keepAspect && originalWidth > 0) {
			targetHeight = Math.round((newW / originalWidth) * originalHeight);
		}
	}

	function updateHeight(newH: number) {
		targetHeight = newH;
		if (keepAspect && originalHeight > 0) {
			targetWidth = Math.round((newH / originalHeight) * originalWidth);
		}
	}

	function downloadProcessedImage() {
		if (!previewUrl) return;
		isProcessing = true;

		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = targetWidth || img.width;
			canvas.height = targetHeight || img.height;

			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				const mime = `image/${targetFormat}`;
				const dataUrl = canvas.toDataURL(mime, targetQuality / 100);

				const a = document.createElement('a');
				a.href = dataUrl;
				const baseName = selectedFile?.name.replace(/\.[^/.]+$/, '') || 'image';
				a.download = `${baseName}-converted.${targetFormat}`;
				a.click();
			}
			isProcessing = false;
		};
		img.src = previewUrl;
	}

	function copyBase64() {
		navigator.clipboard.writeText(base64Output);
		copiedBase64 = true;
		setTimeout(() => (copiedBase64 = false), 2000);
	}

	function formatBytes(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<svelte:head>
	<title>Image Studio | Alan Tools</title>
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
			<h1 class="tool-title"><span class="icon">🖼️</span> Image Studio Pro</h1>
			<span class="tool-badge">CANVAS ENGINE</span>
		</div>
		<p class="tool-subtitle">
			Convert formats (WebP, PNG, JPEG, GIF), resize dimensions, compress quality, and encode Base64
			Data URIs.
		</p>
	</div>

	<div class="workspace-grid">
		<!-- Upload / Preview Box -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="drop-pane glass-card" ondrop={handleDrop} ondragover={(e) => e.preventDefault()}>
			{#if !previewUrl}
				<div class="drop-placeholder">
					<span class="drop-icon">📁</span>
					<span class="drop-title">Drag & drop an image here</span>
					<span class="drop-sub">Supports PNG, JPEG, WebP, GIF, SVG</span>
					<label class="select-file-btn">
						Browse Computer
						<input type="file" accept="image/*" onchange={handleFileSelect} hidden />
					</label>
				</div>
			{:else}
				<div class="preview-wrapper">
					<img src={previewUrl} alt="Preview" class="image-preview" />
					<div class="image-meta-bar">
						<span>Original: {originalWidth} × {originalHeight} px</span>
						<span>Size: {formatBytes(originalSize)}</span>
						<label class="change-file-btn">
							Change Image
							<input type="file" accept="image/*" onchange={handleFileSelect} hidden />
						</label>
					</div>
				</div>
			{/if}
		</div>

		<!-- Process Controls & Output -->
		<div class="controls-pane glass-card">
			<h2 class="pane-title">Conversion & Compression Settings</h2>

			{#if !previewUrl}
				<div class="empty-notice">
					<span>Upload an image on the left to unlock processing controls.</span>
				</div>
			{:else}
				<div class="settings-form">
					<!-- Target Format -->
					<div class="form-group">
						<label class="form-label" for="targetFormat">Export Format</label>
						<div class="format-buttons">
							<button
								class="fmt-btn"
								class:active={targetFormat === 'webp'}
								onclick={() => (targetFormat = 'webp')}>WebP</button
							>
							<button
								class="fmt-btn"
								class:active={targetFormat === 'png'}
								onclick={() => (targetFormat = 'png')}>PNG</button
							>
							<button
								class="fmt-btn"
								class:active={targetFormat === 'jpeg'}
								onclick={() => (targetFormat = 'jpeg')}>JPEG</button
							>
							<button
								class="fmt-btn"
								class:active={targetFormat === 'gif'}
								onclick={() => (targetFormat = 'gif')}>GIF</button
							>
						</div>
					</div>

					<!-- Quality Slider -->
					{#if targetFormat !== 'png'}
						<div class="form-group">
							<div class="label-row">
								<label class="form-label" for="qualityRange">Compression Quality</label>
								<span class="val-badge">{targetQuality}%</span>
							</div>
							<input
								id="qualityRange"
								type="range"
								min="10"
								max="100"
								bind:value={targetQuality}
								class="range-slider"
							/>
						</div>
					{/if}

					<!-- Dimensions -->
					<div class="form-group">
						<div class="label-row">
							<label class="form-label" for="targetWidthInput">Output Dimensions (px)</label>
							<label class="aspect-checkbox">
								<input type="checkbox" bind:checked={keepAspect} /> Lock Aspect Ratio
							</label>
						</div>
						<div class="dim-inputs">
							<input
								id="targetWidthInput"
								type="number"
								value={targetWidth}
								oninput={(e) => updateWidth(+e.currentTarget.value)}
								class="num-input"
								placeholder="Width"
							/>
							<span class="x-sep">×</span>
							<input
								type="number"
								value={targetHeight}
								oninput={(e) => updateHeight(+e.currentTarget.value)}
								class="num-input"
								placeholder="Height"
							/>
						</div>
					</div>

					<button class="process-btn" onclick={downloadProcessedImage} disabled={isProcessing}>
						{isProcessing ? 'Processing Canvas...' : '⚡ Process & Download Image'}
					</button>

					<hr class="divider" />

					<!-- Base64 Encoder -->
					<div class="form-group">
						<label class="form-label" for="base64CopyArea">Base64 Data URI</label>
						<div class="base64-box">
							<textarea
								id="base64CopyArea"
								readonly
								value={base64Output.slice(0, 150) + '...'}
								class="base64-preview"></textarea>
							<button class="copy-base64-btn" onclick={copyBase64}>
								{copiedBase64 ? '✓ Copied Data URI' : '📋 Copy Base64'}
							</button>
						</div>
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
		color: var(--accent-violet);
		background: rgba(139, 92, 246, 0.15);
		border: 1px solid rgba(139, 92, 246, 0.3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle {
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin: 0.25rem 0 0 0;
	}

	/* Workspace Grid */
	.workspace-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		min-height: 520px;
	}

	@media (min-width: 900px) {
		.workspace-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.drop-pane {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		min-height: 450px;
	}

	.drop-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
	}

	.drop-icon {
		font-size: 3.5rem;
	}

	.drop-title {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.drop-sub {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.select-file-btn,
	.change-file-btn {
		padding: 0.6rem 1.25rem;
		background: var(--accent-violet);
		color: #ffffff;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		display: inline-block;
	}

	.change-file-btn {
		background: var(--bg-surface-3);
		font-size: 0.75rem;
		padding: 0.3rem 0.75rem;
	}

	.preview-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.image-preview {
		max-width: 100%;
		max-height: 350px;
		object-fit: contain;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	.image-meta-bar {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.controls-pane {
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pane-title {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0;
	}

	.empty-notice {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.9rem;
		text-align: center;
	}

	.settings-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.format-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.fmt-btn {
		flex: 1;
		padding: 0.6rem;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.85rem;
		background: var(--bg-surface-2);
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
	}

	.fmt-btn.active {
		background: var(--accent-violet);
		color: #ffffff;
		border-color: transparent;
	}

	.val-badge {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--accent-violet);
	}

	.range-slider {
		width: 100%;
		accent-color: var(--accent-violet);
	}

	.aspect-checkbox {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.dim-inputs {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.num-input {
		flex: 1;
		padding: 0.6rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
	}

	.x-sep {
		color: var(--text-tertiary);
	}

	.process-btn {
		width: 100%;
		padding: 0.85rem;
		background: linear-gradient(135deg, var(--accent-violet) 0%, #7c3aed 100%);
		color: #ffffff;
		border-radius: var(--radius-md);
		font-weight: 800;
		font-size: 0.95rem;
		transition: transform var(--transition-fast);
	}

	.process-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: var(--shadow-glow-violet);
	}

	.divider {
		border: none;
		border-top: 1px solid var(--border-subtle);
	}

	.base64-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.base64-preview {
		height: 60px;
		padding: 0.6rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		resize: none;
	}

	.copy-base64-btn {
		padding: 0.5rem;
		background: var(--bg-surface-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
	}
</style>
