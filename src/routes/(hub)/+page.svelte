<script lang="ts">
	let searchQuery = $state('');

	const quickAccess = [
		{ name: 'GitHub', icon: '🐙', url: 'https://github.com', color: '#ffffff' },
		{ name: 'ChatGPT', icon: '🤖', url: 'https://chat.openai.com', color: '#10a37f' },
		{ name: 'Gmail', icon: '📧', url: 'https://mail.google.com', color: '#ea4335' },
		{ name: 'Drive', icon: '☁️', url: 'https://drive.google.com', color: '#34a853' },
		{ name: 'Cloudflare', icon: '🌩️', url: 'https://dash.cloudflare.com', color: '#f38020' },
		{ name: 'Steam', icon: '🎮', url: 'https://store.steampowered.com', color: '#171a21' }
	];

	const myTools = [
		{ name: 'Image Tools', icon: '🖼️', url: '/tools/image', color: '#8b5cf6' },
		{ name: 'JSON Tools', icon: '🧩', url: '/tools/json', color: '#f59e0b' },
		{ name: 'File Tools', icon: '📄', url: '/tools/file', color: '#3b82f6' },
		{ name: 'Generators', icon: '🪄', url: '/tools/generators', color: '#ec4899' }
	];

	const myDatabase = [
		{ name: 'Movie DB', icon: '🎬', url: '/movies', color: '#eab308' }
	];

	const projects = [
		{ name: 'Labs', icon: '🧪', url: '/projects', color: '#14b8a6' }
	];

	const system = [
		{ name: 'Setup', icon: '⚙️', url: '/setup', color: '#64748b' },
		{ name: 'Status', icon: '📈', url: '/status', color: '#22c55e' }
	];
</script>

<svelte:head>
	<title>Alan Database | Hub</title>
</svelte:head>

<main class="dashboard-container">
	<div class="hub-header">
		<h1 class="logo-title">
			<span class="logo-accent">ALAN</span> DATABASE
		</h1>
		<div class="search-wrapper">
			<span class="search-icon">🔍</span>
			<input 
				type="text" 
				class="global-search" 
				placeholder="Search system, tools, or web..." 
				bind:value={searchQuery}
			/>
			<div class="search-shortcut">⌘K</div>
		</div>
	</div>

	<div class="dashboard-grid">
		<!-- Quick Access Section -->
		<section class="dashboard-section">
			<h2 class="section-title">
				<span class="emoji">⚡</span> Quick Access
			</h2>
			<div class="bento-grid quick-access">
				{#each quickAccess as link}
					<a href={link.url} target="_blank" rel="noopener noreferrer" class="bento-card" style="--accent: {link.color}">
						<div class="card-icon">{link.icon}</div>
						<span class="card-label">{link.name}</span>
					</a>
				{/each}
			</div>
		</section>

		<hr class="section-divider" />

		<!-- My Tools Section -->
		<section class="dashboard-section">
			<h2 class="section-title">
				<span class="emoji">🛠</span> My Tools
			</h2>
			<div class="bento-grid my-tools">
				{#each myTools as link}
					<a href={link.url} class="bento-card" style="--accent: {link.color}">
						<div class="card-icon">{link.icon}</div>
						<span class="card-label">{link.name}</span>
					</a>
				{/each}
			</div>
		</section>

		<hr class="section-divider" />

		<!-- Databases & Projects Row -->
		<div class="dashboard-row">
			<section class="dashboard-section half">
				<h2 class="section-title">
					<span class="emoji">🎬</span> My Database
				</h2>
				<div class="bento-grid one-col">
					{#each myDatabase as link}
						<a href={link.url} class="bento-card large" style="--accent: {link.color}">
							<div class="card-icon" style="font-size: 2rem;">{link.icon}</div>
							<span class="card-label">{link.name}</span>
						</a>
					{/each}
				</div>
			</section>

			<section class="dashboard-section half">
				<h2 class="section-title">
					<span class="emoji">🚀</span> Projects
				</h2>
				<div class="bento-grid one-col">
					{#each projects as link}
						<a href={link.url} class="bento-card large" style="--accent: {link.color}">
							<div class="card-icon" style="font-size: 2rem;">{link.icon}</div>
							<span class="card-label">{link.name}</span>
						</a>
					{/each}
				</div>
			</section>
		</div>

		<hr class="section-divider" />

		<!-- System Section -->
		<section class="dashboard-section">
			<h2 class="section-title">
				<span class="emoji">💻</span> System
			</h2>
			<div class="bento-grid system-grid">
				{#each system as link}
					<a href={link.url} class="bento-card" style="--accent: {link.color}">
						<div class="card-icon">{link.icon}</div>
						<span class="card-label">{link.name}</span>
					</a>
				{/each}
			</div>
		</section>
	</div>
</main>

<style>
	.dashboard-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 4rem 2rem;
	}

	.hub-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		margin-bottom: 4rem;
	}

	.logo-title {
		font-size: 2.5rem;
		font-weight: 800;
		letter-spacing: -0.05em;
		color: white;
		margin: 0;
	}

	.logo-accent {
		color: #eab308;
	}

	.search-wrapper {
		position: relative;
		width: 100%;
		max-width: 600px;
	}

	.search-icon {
		position: absolute;
		left: 1.25rem;
		top: 50%;
		transform: translateY(-50%);
		color: #a1a1aa;
	}

	.global-search {
		width: 100%;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 9999px;
		padding: 1rem 1rem 1rem 3.5rem;
		font-size: 1.125rem;
		color: white;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
	}

	.global-search:focus {
		outline: none;
		border-color: #eab308;
		background: rgba(255, 255, 255, 0.08);
		box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2);
	}

	.search-shortcut {
		position: absolute;
		right: 1.25rem;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(255, 255, 255, 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		color: #a1a1aa;
		font-weight: 600;
	}

	.dashboard-grid {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.dashboard-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #e4e4e7;
		margin: 0 0 1.5rem 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.section-divider {
		border: 0;
		height: 1px;
		background: rgba(255, 255, 255, 0.05);
		margin: 0;
	}

	.bento-grid {
		display: grid;
		gap: 1rem;
	}

	.bento-grid.quick-access {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	}

	.bento-grid.my-tools {
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}

	.bento-grid.one-col {
		grid-template-columns: 1fr;
	}
	
	.bento-grid.system-grid {
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	}

	.bento-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-decoration: none;
		color: #a1a1aa;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
	}

	.bento-card.large {
		padding: 2rem;
		flex-direction: row;
		justify-content: flex-start;
		gap: 1.5rem;
	}

	.bento-card.large .card-label {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.bento-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at center, var(--accent) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.3s ease;
		mix-blend-mode: overlay;
	}

	.bento-card:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.1);
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
	}

	.bento-card:hover::before {
		opacity: 0.15;
	}

	.bento-card:hover .card-icon {
		color: var(--accent);
		transform: scale(1.1);
	}

	.card-icon {
		transition: all 0.3s ease;
		font-size: 1.5rem;
	}

	.card-label {
		font-weight: 500;
		font-size: 0.95rem;
	}

	@media (max-width: 768px) {
		.dashboard-row {
			grid-template-columns: 1fr;
		}
		.bento-grid.quick-access {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
