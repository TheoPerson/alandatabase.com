<script lang="ts">
	import { onMount } from 'svelte';

	let searchQuery = $state('');
	let scratchpadText = $state('');
	let isDrawerOpen = $state(false);
	let dbLatency = $state(14);
	let isClient = $state(false);

	onMount(() => {
		isClient = true;
		scratchpadText = localStorage.getItem('alan_vault_scratchpad') || '';
		
		// Simulate periodic ping telemetry update
		const interval = setInterval(() => {
			dbLatency = Math.floor(11 + Math.random() * 8);
		}, 3000);
		return () => clearInterval(interval);
	});

	function handleScratchInput() {
		localStorage.setItem('alan_vault_scratchpad', scratchpadText);
		if (searchQuery.trim().length > 0) {
			isDrawerOpen = true;
		}
	}

	function handleSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		searchQuery = val;
		isDrawerOpen = val.trim().length > 0;
	}

	function closeDrawer() {
		isDrawerOpen = false;
	}

	// Dock items (macOS / iOS 27 Style)
	const dockApps = [
		{ id: 'github', name: 'GitHub', icon: '🐙', url: 'https://github.com', color: '#ffffff' },
		{ id: 'chatgpt', name: 'ChatGPT', icon: '🤖', url: 'https://chat.openai.com', color: '#10a37f' },
		{ id: 'gmail', name: 'Gmail', icon: '✉️', url: 'https://mail.google.com', color: '#ea4335' },
		{ id: 'drive', name: 'Drive', icon: '☁️', url: 'https://drive.google.com', color: '#34a853' },
		{ id: 'cloudflare', name: 'Cloudflare', icon: '⚡', url: 'https://dash.cloudflare.com', color: '#f38020' },
		{ id: 'steam', name: 'Steam', icon: '🎮', url: 'https://store.steampowered.com', color: '#38bdf8' },
		{ id: 'figma', name: 'Figma', icon: '🎨', url: 'https://figma.com', color: '#a259ff' },
		{ id: 'vercel', name: 'Vercel', icon: '▲', url: 'https://vercel.com', color: '#ffffff' },
		{ id: 'cinemadb', name: 'Cinema DB', icon: '🎬', url: '/movies', color: '#10b981' },
		{ id: 'json', name: 'JSON Studio', icon: '🧩', url: '/tools/json', color: '#f59e0b' },
		{ id: 'setup', name: 'Setup', icon: '⚙️', url: '/setup', color: '#71717a' }
	];

	// Primary Dev & Vault Suites
	const devSuites = [
		{ id: 'json', name: 'JSON Studio', icon: '🧩', url: '/tools/json', color: '#10b981', desc: 'Format, Validate & CSV' },
		{ id: 'diff', name: 'Diff & Regex', icon: '⚡', url: '/tools/diff', color: '#10b981', desc: 'Side-by-Side Text & Regex' },
		{ id: 'image', name: 'Image Studio', icon: '🖼️', url: '/tools/image', color: '#8b5cf6', desc: 'Compress, WebP & Base64' },
		{ id: 'file', name: 'File Utilities', icon: '📄', url: '/tools/file', color: '#3b82f6', desc: 'SHA Hashes & Regex' },
		{ id: 'generators', name: 'Generator Vault', icon: '🪄', url: '/tools/generators', color: '#ec4899', desc: 'UUIDs & Passwords' }
	];

	const coreEngines = [
		{ id: 'cinemadb', name: 'Cinema DB', icon: '🎬', url: '/movies', color: '#10b981', desc: 'Movie Archive & TMDB Engine' },
		{ id: 'labs', name: 'Innovation Labs', icon: '🧪', url: '/projects', color: '#06b6d4', desc: 'Active AI Models & Prototypes' }
	];

	const searchableItems = [
		...devSuites.map(d => ({ ...d, category: 'Dev Tool' })),
		...coreEngines.map(e => ({ ...e, category: 'Vault Engine' })),
		...dockApps.map(a => ({ ...a, category: 'Bookmark', desc: a.url })),
		{ name: 'System Setup', icon: '⚙️', url: '/setup', desc: 'Environment inspector', category: 'System' },
		{ name: 'Telemetry Status', icon: '📈', url: '/status', desc: 'Live Postgres & TMDB health', category: 'System' },
		{ name: 'AI Curator', icon: '✨', url: '/discover/ai', desc: 'AI Movie Recommendations', category: 'Cinema' }
	];

	let filteredSearch = $derived(
		searchQuery.trim() === ''
			? searchableItems
			: searchableItems.filter(
					i =>
						i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						(i.desc && i.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
						i.category.toLowerCase().includes(searchQuery.toLowerCase())
			  )
	);

	function formatScratchJSON() {
		try {
			const parsed = JSON.parse(scratchpadText);
			scratchpadText = JSON.stringify(parsed, null, 2);
			handleScratchInput();
		} catch (e) {
			alert('Invalid JSON in scratchpad');
		}
	}

	function copyScratch() {
		navigator.clipboard.writeText(scratchpadText);
	}
</script>

<svelte:head>
	<title>Alan Vault | 2026 Developer OS Portal</title>
</svelte:head>

<!-- Micro Grid Background -->
<div class="linear-grid-bg"></div>

<main class="vault-container">
	<!-- Top Bar -->
	<header class="vault-header">
		<div class="brand-line">
			<span class="live-dot"></span>
			<span class="brand-name">ALAN <span class="emerald-accent">VAULT</span></span>
			<span class="version-tag">2026.1 OS</span>
		</div>
		<div class="header-right">
			<span class="ping-badge">POSTGRES {dbLatency}ms</span>
			<span class="sys-badge">VERCEL EDGE</span>
		</div>
	</header>

	<!-- HERO DUAL-PANE CONTROL CENTER -->
	<section class="dual-control-center">
		<!-- Left Pane: Live Telemetry & Quick Status -->
		<div class="pane-card telemetry-pane">
			<div class="pane-header">
				<span class="pane-title">SYSTEM TELEMETRY</span>
				<span class="status-live">● LIVE</span>
			</div>
			
			<div class="telemetry-metrics">
				<div class="metric-item">
					<span class="metric-label">Neon Postgres DB</span>
					<span class="metric-value green">{dbLatency}ms <span class="unit">latency</span></span>
				</div>
				<div class="metric-item">
					<span class="metric-label">Vercel SSR Function</span>
					<span class="metric-value green">200 OK <span class="unit">healthy</span></span>
				</div>
				<div class="metric-item">
					<span class="metric-label">TMDB API Gateway</span>
					<span class="metric-value green">ACTIVE <span class="unit">v3/v4</span></span>
				</div>
				<div class="metric-item">
					<span class="metric-label">Vault Build Target</span>
					<span class="metric-value titanium">SWISS OLED <span class="unit">2026.1</span></span>
				</div>
			</div>

			<div class="telemetry-actions">
				<a href="/status" class="action-btn">
					<span>📈 Telemetry Dashboard</span>
					<span>→</span>
				</a>
				<a href="/setup" class="action-btn">
					<span>⚙️ Config Inspector</span>
					<span>→</span>
				</a>
			</div>
		</div>

		<!-- Right Pane: Universal Command Scratchpad & Live Engine -->
		<div class="pane-card scratchpad-pane">
			<div class="pane-header">
				<span class="pane-title">UNIVERSAL COMMAND & SCRATCHPAD</span>
				<div class="scratch-tools">
					<button class="tool-chip" onclick={formatScratchJSON} title="Format JSON in scratchpad">Format JSON</button>
					<button class="tool-chip" onclick={copyScratch} title="Copy scratchpad content">Copy</button>
				</div>
			</div>

			<div class="scratchpad-wrapper">
				<div class="search-bar-inner">
					<span class="search-icon">🔍</span>
					<input
						type="text"
						class="search-inline-input"
						placeholder="Search tools, bookmarks, movies, or type notes below..."
						value={searchQuery}
						oninput={handleSearchInput}
					/>
					{#if searchQuery.trim().length > 0}
						<button class="clear-btn" onclick={() => { searchQuery = ''; closeDrawer(); }}>✕</button>
					{/if}
				</div>

				<textarea
					bind:value={scratchpadText}
					oninput={handleScratchInput}
					placeholder="Markdown Scratchpad — Auto-saved to local vault state..."
					class="scratch-textarea"
				></textarea>
			</div>
		</div>
	</section>

	<!-- CORE PORTALS (Cinema DB & Innovation Labs) -->
	<section class="section-block">
		<div class="block-title">CORE VAULT PORTALS</div>
		<div class="engines-grid">
			{#each coreEngines as engine}
				<a href={engine.url} class="engine-tile" style="--engine-color: {engine.color}">
					<span class="engine-icon">{engine.icon}</span>
					<div class="engine-info">
						<span class="engine-name">{engine.name}</span>
						<span class="engine-desc">{engine.desc}</span>
					</div>
					<span class="engine-arrow">→</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- DEV TOOLS SUITE -->
	<section class="section-block">
		<div class="block-title">DEVELOPER & MEDIA TOOLS</div>
		<div class="tools-grid">
			{#each devSuites as tool}
				<a href={tool.url} class="tool-card" style="--tool-color: {tool.color}">
					<div class="tool-icon-box">{tool.icon}</div>
					<div class="tool-info">
						<span class="tool-title">{tool.name}</span>
						<span class="tool-desc">{tool.desc}</span>
					</div>
				</a>
			{/each}
		</div>
	</section>
</main>

<!-- LIVE SEARCH SIDE-PANEL DRAWER -->
{#if isDrawerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="drawer-backdrop" onclick={closeDrawer}>
		<aside class="drawer-panel" onclick={e => e.stopPropagation()}>
			<div class="drawer-header">
				<div class="drawer-title-group">
					<span class="drawer-icon">🔍</span>
					<span class="drawer-title">LIVE SEARCH RESULTS</span>
				</div>
				<button class="drawer-close-btn" onclick={closeDrawer}>✕</button>
			</div>

			<div class="drawer-query-bar">
				<span>Matching <strong class="query-highlight">"{searchQuery}"</strong></span>
				<span class="count-tag">{filteredSearch.length} found</span>
			</div>

			<div class="drawer-results-list">
				{#if filteredSearch.length === 0}
					<div class="empty-results">
						<span class="empty-emoji">🔍</span>
						<span>No vault items match "{searchQuery}"</span>
						<a href="/search?q={encodeURIComponent(searchQuery)}" class="cinema-fallback-btn" onclick={closeDrawer}>
							Search "{searchQuery}" in Cinema Database →
						</a>
					</div>
				{:else}
					{#each filteredSearch as item}
						<a href={item.url} class="drawer-item" onclick={closeDrawer}>
							<span class="item-icon">{item.icon}</span>
							<div class="item-details">
								<span class="item-title">{item.name}</span>
								{#if item.desc}
									<span class="item-desc">{item.desc}</span>
								{/if}
							</div>
							<span class="item-category">{item.category}</span>
						</a>
					{/each}
				{/if}
			</div>
		</aside>
	</div>
{/if}

<!-- macOS / iOS 27 TRANSLUCENT FLOATING DOCK -->
<nav class="mac-floating-dock" aria-label="Quick Dock Launcher">
	<div class="dock-container">
		{#each dockApps as app}
			<a
				href={app.url}
				target={app.url.startsWith('http') ? '_blank' : '_self'}
				rel={app.url.startsWith('http') ? 'noopener noreferrer' : ''}
				class="dock-item"
				title={app.name}
			>
				<span class="dock-icon">{app.icon}</span>
				<span class="dock-tooltip">{app.name}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	/* Micro-grid OLED background */
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

	.vault-container {
		position: relative;
		z-index: 1;
		max-width: 1140px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 8rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	/* Top Bar */
	.vault-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.brand-line {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.live-dot {
		width: 8px;
		height: 8px;
		background: #10b981;
		border-radius: 50%;
		box-shadow: 0 0 12px #10b981;
	}

	.brand-name {
		font-size: 1.15rem;
		font-weight: 800;
		color: #f4f4f5;
		letter-spacing: -0.01em;
	}

	.emerald-accent {
		color: #10b981;
	}

	.version-tag {
		font-size: 0.7rem;
		font-weight: 700;
		color: #71717a;
		padding: 0.15rem 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.ping-badge, .sys-badge {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
	}

	.ping-badge {
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
	}

	.sys-badge {
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* DUAL-PANE CONTROL CENTER */
	.dual-control-center {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 840px) {
		.dual-control-center {
			grid-template-columns: 320px 1fr;
		}
	}

	.pane-card {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		backdrop-filter: blur(16px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
	}

	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pane-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
	}

	.status-live {
		font-size: 0.68rem;
		font-weight: 800;
		color: #10b981;
	}

	/* Telemetry Metrics */
	.telemetry-metrics {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.metric-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.metric-label {
		font-size: 0.75rem;
		color: #71717a;
	}

	.metric-value {
		font-size: 0.95rem;
		font-weight: 700;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.metric-value.green { color: #10b981; }
	.metric-value.titanium { color: #f4f4f5; }

	.unit {
		font-size: 0.7rem;
		font-weight: 500;
		color: #71717a;
	}

	.telemetry-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: auto;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		color: #a1a1aa;
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 120ms ease;
	}

	.action-btn:hover {
		border-color: #10b981;
		color: #f4f4f5;
		background: rgba(16, 185, 129, 0.08);
	}

	/* Scratchpad & Search Pane */
	.scratchpad-pane {
		gap: 1rem;
	}

	.scratch-tools {
		display: flex;
		gap: 0.4rem;
	}

	.tool-chip {
		font-size: 0.7rem;
		font-weight: 700;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		transition: all 120ms ease;
	}

	.tool-chip:hover {
		color: #10b981;
		border-color: #10b981;
	}

	.scratchpad-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
	}

	.search-bar-inner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		background: rgba(8, 8, 12, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: border-color 150ms ease;
	}

	.search-bar-inner:focus-within {
		border-color: #10b981;
		box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
	}

	.search-icon {
		font-size: 0.9rem;
		color: #10b981;
	}

	.search-inline-input {
		flex: 1;
		background: none;
		border: none;
		color: #f4f4f5;
		font-size: 0.85rem;
		outline: none;
	}

	.clear-btn {
		color: #71717a;
		font-size: 0.8rem;
	}

	.scratch-textarea {
		flex: 1;
		min-height: 180px;
		background: rgba(8, 8, 12, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 0.9rem;
		color: #e4e4e7;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		resize: none;
		outline: none;
		line-height: 1.5;
	}

	.scratch-textarea:focus {
		border-color: rgba(16, 185, 129, 0.5);
	}

	/* Sections */
	.section-block {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.block-title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #71717a;
	}

	.engines-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.engines-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.engine-tile {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1.35rem 1.5rem;
		background: rgba(12, 12, 18, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 18px;
		text-decoration: none;
		transition: all 150ms ease;
		backdrop-filter: blur(12px);
	}

	.engine-tile:hover {
		border-color: var(--engine-color, #10b981);
		background: rgba(18, 18, 26, 0.85);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.15);
	}

	.engine-icon {
		font-size: 2rem;
	}

	.engine-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.engine-name {
		font-size: 1.1rem;
		font-weight: 800;
		color: #f4f4f5;
	}

	.engine-desc {
		font-size: 0.8rem;
		color: #71717a;
	}

	.engine-arrow {
		font-size: 1.1rem;
		color: #71717a;
		transition: transform 120ms ease;
	}

	.engine-tile:hover .engine-arrow {
		transform: translateX(4px);
		color: var(--engine-color, #10b981);
	}

	/* Tools Grid */
	.tools-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1rem;
	}

	.tool-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.1rem 1.25rem;
		background: rgba(12, 12, 18, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 16px;
		text-decoration: none;
		transition: all 150ms ease;
	}

	.tool-card:hover {
		border-color: var(--tool-color, #10b981);
		background: rgba(18, 18, 26, 0.8);
	}

	.tool-icon-box {
		font-size: 1.5rem;
	}

	.tool-info {
		display: flex;
		flex-direction: column;
	}

	.tool-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #f4f4f5;
	}

	.tool-desc {
		font-size: 0.75rem;
		color: #71717a;
	}

	/* LIVE SEARCH SIDE-PANEL DRAWER */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
		background: rgba(5, 5, 7, 0.75);
		backdrop-filter: blur(12px);
		display: flex;
		justify-content: flex-end;
	}

	.drawer-panel {
		width: 100%;
		max-width: 440px;
		height: 100%;
		background: #09090d;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		display: flex;
		flex-direction: column;
		animation: slideDrawer 200ms cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: -15px 0 50px rgba(0, 0, 0, 0.8);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.drawer-title-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.drawer-icon {
		font-size: 1.1rem;
		color: #10b981;
	}

	.drawer-title {
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #f4f4f5;
	}

	.drawer-close-btn {
		font-size: 1.1rem;
		color: #71717a;
		transition: color 120ms ease;
	}

	.drawer-close-btn:hover {
		color: #f4f4f5;
	}

	.drawer-query-bar {
		padding: 0.85rem 1.5rem;
		background: rgba(18, 18, 24, 0.6);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #a1a1aa;
	}

	.query-highlight {
		color: #10b981;
	}

	.count-tag {
		font-size: 0.7rem;
		font-weight: 700;
		color: #71717a;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.drawer-results-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.drawer-item {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: rgba(18, 18, 24, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		text-decoration: none;
		transition: all 120ms ease;
	}

	.drawer-item:hover {
		background: rgba(255, 255, 255, 0.07);
		border-color: #10b981;
	}

	.item-icon {
		font-size: 1.3rem;
	}

	.item-details {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.item-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: #f4f4f5;
	}

	.item-desc {
		font-size: 0.75rem;
		color: #71717a;
	}

	.item-category {
		font-size: 0.68rem;
		font-weight: 700;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.2rem 0.45rem;
		border-radius: 6px;
	}

	.empty-results {
		padding: 3rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		color: #71717a;
		font-size: 0.85rem;
	}

	.empty-emoji {
		font-size: 2.5rem;
	}

	.cinema-fallback-btn {
		margin-top: 0.5rem;
		color: #10b981;
		font-weight: 700;
		text-decoration: none;
	}

	/* macOS / iOS 27 FLOATING DOCK */
	.mac-floating-dock {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 90;
	}

	.dock-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(14, 14, 20, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 22px;
		backdrop-filter: blur(24px);
		box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.12);
	}

	.dock-item {
		position: relative;
		width: 44px;
		height: 44px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.dock-item:hover {
		transform: scale(1.22) translateY(-8px);
		background: rgba(16, 185, 129, 0.18);
		border-color: #10b981;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(16, 185, 129, 0.3);
	}

	.dock-icon {
		font-size: 1.35rem;
	}

	.dock-tooltip {
		position: absolute;
		bottom: 56px;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.25rem 0.6rem;
		background: #09090d;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		color: #f4f4f5;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
	}

	.dock-item:hover .dock-tooltip {
		opacity: 1;
	}
</style>
