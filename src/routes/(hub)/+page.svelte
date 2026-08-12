<script lang="ts">
	import { onMount } from 'svelte';

	let searchQuery = $state('');
	let isModalOpen = $state(false);
	let modalInput: HTMLInputElement | null = $state(null);

	const quickAccess = [
		{ name: 'GitHub', icon: '🐙', url: 'https://github.com', color: '#ffffff', desc: 'Code repositories & Gits' },
		{ name: 'ChatGPT', icon: '🤖', url: 'https://chat.openai.com', color: '#10a37f', desc: 'AI Assistant & LLM Studio' },
		{ name: 'Gmail', icon: '📧', url: 'https://mail.google.com', color: '#ea4335', desc: 'Mail & Communications' },
		{ name: 'Drive', icon: '☁️', url: 'https://drive.google.com', color: '#34a853', desc: 'Cloud Storage & Files' },
		{ name: 'Cloudflare', icon: '🌩️', url: 'https://dash.cloudflare.com', color: '#f38020', desc: 'DNS, Worker & CDN Admin' },
		{ name: 'Steam', icon: '🎮', url: 'https://store.steampowered.com', color: '#38bdf8', desc: 'Games Library & Vault' }
	];

	const myTools = [
		{ name: 'JSON Studio', icon: '🧩', url: '/tools/json', color: '#f59e0b', badge: 'PRO', desc: 'Formatter, Tree View, YAML/CSV' },
		{ name: 'Image Studio', icon: '🖼️', url: '/tools/image', color: '#8b5cf6', badge: 'PRO', desc: 'Convert, Compress & Base64' },
		{ name: 'File Utilities', icon: '📄', url: '/tools/file', color: '#3b82f6', badge: 'UTILITY', desc: 'Hashes, Cases, Regex' },
		{ name: 'Generator Vault', icon: '🪄', url: '/tools/generators', color: '#ec4899', badge: 'VAULT', desc: 'UUIDs, Passwords & QR Codes' }
	];

	const myDatabase = [
		{ name: 'Cinema DB', icon: '🎬', url: '/movies', color: '#eab308', badge: 'DATABASE', desc: 'Personal Movie Archive & TMDB Engine' }
	];

	const projects = [
		{ name: 'Innovation Labs', icon: '🧪', url: '/projects', color: '#14b8a6', badge: 'EXPERIMENTAL', desc: 'Active Prototypes & AI Models' }
	];

	const system = [
		{ name: 'System Setup', icon: '⚙️', url: '/setup', color: '#64748b', desc: 'Env Variables & Config' },
		{ name: 'Live Status', icon: '📈', url: '/status', color: '#10b981', badge: 'ONLINE', desc: 'Postgres & API Telemetry' }
	];

	// Combined items for Command-K search
	const allItems = [
		...myTools.map(t => ({ ...t, category: 'Tools' })),
		...myDatabase.map(d => ({ ...d, category: 'Database' })),
		...projects.map(p => ({ ...p, category: 'Projects' })),
		...system.map(s => ({ ...s, category: 'System' })),
		...quickAccess.map(q => ({ ...q, category: 'Quick Access' }))
	];

	let filteredResults = $derived(
		searchQuery.trim() === ''
			? allItems
			: allItems.filter(
					item =>
						item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
						item.category.toLowerCase().includes(searchQuery.toLowerCase())
			  )
	);

	function openModal() {
		isModalOpen = true;
		setTimeout(() => modalInput?.focus(), 50);
	}

	function closeModal() {
		isModalOpen = false;
		searchQuery = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			if (isModalOpen) closeModal();
			else openModal();
		} else if (e.key === 'Escape' && isModalOpen) {
			closeModal();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<svelte:head>
	<title>Alan Database | Personal OS Vault</title>
</svelte:head>

<!-- Aurora Backdrop -->
<div class="aurora-backdrop">
	<div class="aurora-blob aurora-blob-1"></div>
	<div class="aurora-blob aurora-blob-2"></div>
	<div class="aurora-blob aurora-blob-3"></div>
	<div class="cyber-grid-overlay"></div>
</div>

<main class="dashboard-container">
	<!-- Top Navigation / Header -->
	<header class="hub-header">
		<div class="brand-group">
			<div class="status-pulse">
				<span class="pulse-dot"></span>
				<span class="pulse-label">ONLINE</span>
			</div>
			<h1 class="logo-title">
				<span class="logo-accent">ALAN</span> DATABASE <span class="version-tag">V1.0 OS</span>
			</h1>
		</div>

		<button class="search-trigger-btn" onclick={openModal} aria-label="Open Command Launcher">
			<span class="search-icon">🔍</span>
			<span class="search-placeholder">Search system, tools, or press ⌘K...</span>
			<kbd class="kbd-shortcut">⌘K</kbd>
		</button>
	</header>

	<div class="dashboard-grid">
		<!-- Quick Access Section -->
		<section class="dashboard-section">
			<div class="section-header">
				<h2 class="section-title">
					<span class="emoji">⚡</span> Quick Access
				</h2>
				<span class="section-subtitle">Bookmarks & External Workspaces</span>
			</div>
			<div class="bento-grid quick-access">
				{#each quickAccess as link}
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="bento-card glass-card"
						style="--card-accent: {link.color}"
					>
						<div class="card-icon-wrapper" style="background: {link.color}15; border-color: {link.color}40">
							<span class="card-icon">{link.icon}</span>
						</div>
						<div class="card-info">
							<span class="card-label">{link.name}</span>
							<span class="card-desc">{link.desc}</span>
						</div>
						<span class="external-arrow">↗</span>
					</a>
				{/each}
			</div>
		</section>

		<!-- My Tools Section -->
		<section class="dashboard-section">
			<div class="section-header">
				<h2 class="section-title">
					<span class="emoji">🛠</span> Developer & Media Tools
				</h2>
				<span class="section-subtitle">Client-Side & Server Utilities</span>
			</div>
			<div class="bento-grid my-tools">
				{#each myTools as tool}
					<a href={tool.url} class="bento-card glass-card featured" style="--card-accent: {tool.color}">
						<div class="card-top">
							<div class="card-icon-wrapper" style="background: {tool.color}20; border-color: {tool.color}50">
								<span class="card-icon">{tool.icon}</span>
							</div>
							<span class="card-badge" style="color: {tool.color}; background: {tool.color}15; border-color: {tool.color}30">{tool.badge}</span>
						</div>
						<div class="card-info">
							<span class="card-label">{tool.name}</span>
							<span class="card-desc">{tool.desc}</span>
						</div>
						<div class="card-action">Launch Suite →</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- Database & Projects Split Row -->
		<div class="dashboard-row">
			<section class="dashboard-section half">
				<div class="section-header">
					<h2 class="section-title">
						<span class="emoji">🎬</span> Primary Database
					</h2>
				</div>
				<div class="bento-grid one-col">
					{#each myDatabase as db}
						<a href={db.url} class="bento-card glass-card hero-card" style="--card-accent: {db.color}">
							<div class="hero-card-content">
								<div class="card-icon-wrapper large" style="background: {db.color}20; border-color: {db.color}50">
									<span class="card-icon">{db.icon}</span>
								</div>
								<div class="card-info">
									<div class="title-row">
										<span class="card-label large">{db.name}</span>
										<span class="card-badge" style="color: {db.color}; background: {db.color}15; border-color: {db.color}30">{db.badge}</span>
									</div>
									<span class="card-desc">{db.desc}</span>
								</div>
							</div>
							<div class="card-action hero">Open Vault Engine →</div>
						</a>
					{/each}
				</div>
			</section>

			<section class="dashboard-section half">
				<div class="section-header">
					<h2 class="section-title">
						<span class="emoji">🚀</span> Innovation Labs
					</h2>
				</div>
				<div class="bento-grid one-col">
					{#each projects as prj}
						<a href={prj.url} class="bento-card glass-card hero-card" style="--card-accent: {prj.color}">
							<div class="hero-card-content">
								<div class="card-icon-wrapper large" style="background: {prj.color}20; border-color: {prj.color}50">
									<span class="card-icon">{prj.icon}</span>
								</div>
								<div class="card-info">
									<div class="title-row">
										<span class="card-label large">{prj.name}</span>
										<span class="card-badge" style="color: {prj.color}; background: {prj.color}15; border-color: {prj.color}30">{prj.badge}</span>
									</div>
									<span class="card-desc">{prj.desc}</span>
								</div>
							</div>
							<div class="card-action hero">Explore Labs →</div>
						</a>
					{/each}
				</div>
			</section>
		</div>

		<!-- System Control Section -->
		<section class="dashboard-section">
			<div class="section-header">
				<h2 class="section-title">
					<span class="emoji">💻</span> System Control & Telemetry
				</h2>
			</div>
			<div class="bento-grid system-grid">
				{#each system as sys}
					<a href={sys.url} class="bento-card glass-card" style="--card-accent: {sys.color}">
						<div class="card-top">
							<div class="card-icon-wrapper" style="background: {sys.color}20; border-color: {sys.color}50">
								<span class="card-icon">{sys.icon}</span>
							</div>
							{#if sys.badge}
								<span class="card-badge green">{sys.badge}</span>
							{/if}
						</div>
						<div class="card-info">
							<span class="card-label">{sys.name}</span>
							<span class="card-desc">{sys.desc}</span>
						</div>
					</a>
				{/each}
			</div>
		</section>
	</div>
</main>

<!-- Command-K (⌘K) Spotlight Modal -->
{#if isModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="command-backdrop" onclick={closeModal}>
		<div class="command-modal glass-card" onclick={e => e.stopPropagation()}>
			<div class="command-header">
				<span class="modal-search-icon">🔍</span>
				<input
					bind:this={modalInput}
					type="text"
					class="command-input"
					placeholder="Type a command or search..."
					bind:value={searchQuery}
				/>
				<span class="esc-badge">ESC</span>
			</div>

			<div class="command-results">
				{#if filteredResults.length === 0}
					<div class="empty-state">
						<span>No system results found for "{searchQuery}"</span>
						<a href="/search?q={encodeURIComponent(searchQuery)}" class="external-search-link" onclick={closeModal}>
							Search "{searchQuery}" in Cinema Database →
						</a>
					</div>
				{:else}
					<div class="results-list">
						{#each filteredResults as res}
							<a href={res.url} class="command-item" onclick={closeModal}>
								<span class="item-icon">{res.icon}</span>
								<div class="item-details">
									<span class="item-name">{res.name}</span>
									<span class="item-desc">{res.desc}</span>
								</div>
								<span class="item-cat">{res.category}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<div class="command-footer">
				<span>Press <kbd>ESC</kbd> to exit</span>
				<span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.dashboard-container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 5rem 1.5rem;
	}

	/* Header Styling */
	.hub-header {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 3.5rem;
	}

	@media (min-width: 768px) {
		.hub-header {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.brand-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.status-pulse {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		width: fit-content;
		padding: 0.25rem 0.75rem;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: var(--radius-full);
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background-color: #10b981;
		border-radius: 50%;
		box-shadow: 0 0 10px #10b981;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}

	.pulse-label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: #10b981;
	}

	.logo-title {
		font-size: 2.25rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
	}

	.logo-accent {
		background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.version-tag {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-tertiary);
		padding: 0.2rem 0.6rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	/* Search Trigger Button */
	.search-trigger-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1.25rem;
		background: rgba(21, 25, 38, 0.7);
		backdrop-filter: blur(12px);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xl);
		color: var(--text-secondary);
		transition: all var(--transition-normal);
		width: 100%;
		max-width: 420px;
	}

	.search-trigger-btn:hover {
		border-color: var(--accent-gold);
		background: rgba(28, 34, 52, 0.85);
		color: var(--text-primary);
		box-shadow: 0 0 25px rgba(245, 158, 11, 0.15);
	}

	.search-placeholder {
		flex: 1;
		text-align: left;
		font-size: 0.9rem;
	}

	.kbd-shortcut {
		padding: 0.2rem 0.5rem;
		background: var(--bg-surface-3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-tertiary);
	}

	/* Section Layout */
	.dashboard-grid {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.section-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1.25rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}

	.section-subtitle {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	/* Bento Grid Layouts */
	.bento-grid {
		display: grid;
		gap: 1.25rem;
	}

	.quick-access {
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
	}

	.my-tools {
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	}

	.system-grid {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	.dashboard-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 900px) {
		.dashboard-row {
			grid-template-columns: 1fr 1fr;
		}
	}

	.bento-card {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: relative;
	}

	.bento-card:hover {
		border-color: var(--card-accent, var(--border-strong));
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-icon-wrapper {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
	}

	.card-icon-wrapper.large {
		width: 56px;
		height: 56px;
	}

	.card-icon {
		font-size: 1.4rem;
	}

	.card-badge {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
	}

	.card-badge.green {
		color: #10b981;
		background: rgba(16, 185, 129, 0.15);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.card-info {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.card-label {
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text-primary);
	}

	.card-label.large {
		font-size: 1.25rem;
	}

	.card-desc {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.external-arrow {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		font-size: 0.9rem;
		color: var(--text-tertiary);
		transition: transform var(--transition-fast);
	}

	.bento-card:hover .external-arrow {
		transform: translate(2px, -2px);
		color: var(--text-primary);
	}

	.card-action {
		margin-top: auto;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--card-accent);
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.hero-card {
		padding: 1.75rem;
		gap: 1.5rem;
	}

	.hero-card-content {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;

	}

	/* Command-K Spotlight Modal */
	.command-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(7, 8, 13, 0.75);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 4rem 1rem 2rem 1rem;
		animation: fadeIn 150ms ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.command-modal {
		width: 100%;
		max-width: 620px;
		background: rgba(18, 22, 34, 0.95);
		border-color: var(--border-strong);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.15);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.command-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.modal-search-icon {
		font-size: 1.2rem;
	}

	.command-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.1rem;
		outline: none;
	}

	.esc-badge {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-tertiary);
		padding: 0.25rem 0.5rem;
		background: var(--bg-surface-3);
		border-radius: 4px;
	}

	.command-results {
		max-height: 380px;
		overflow-y: auto;
		padding: 0.75rem;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.command-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.command-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.item-icon {
		font-size: 1.3rem;
	}

	.item-details {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.item-name {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.item-desc {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.item-cat {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-tertiary);
		padding: 0.2rem 0.5rem;
		background: var(--bg-surface-2);
		border-radius: var(--radius-sm);
	}

	.empty-state {
		padding: 2.5rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--text-secondary);
	}

	.external-search-link {
		color: var(--accent-gold);
		font-weight: 700;
	}

	.command-footer {
		padding: 0.85rem 1.5rem;
		border-top: 1px solid var(--border-subtle);
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-tertiary);
		background: rgba(14, 17, 26, 0.5);
	}

	.command-footer kbd {
		background: var(--bg-surface-3);
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		color: var(--text-secondary);
	}
</style>
