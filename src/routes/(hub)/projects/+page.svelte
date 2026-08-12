<script lang="ts">
	const labs = [
		{
			title: 'Cinema DB Engine',
			category: 'Database & Search',
			status: 'ACTIVE V1.0',
			desc: 'Personal movie vault with hybrid Postgres full-text & TMDB API fallback search.',
			tags: ['SvelteKit 2', 'Neon Postgres', 'TMDB API', 'Drizzle ORM'],
			link: '/movies',
			color: '#10b981'
		},
		{
			title: 'AI Curator Studio',
			category: 'Artificial Intelligence',
			status: 'ACTIVE V1.0',
			desc: 'LLM-powered conversational movie recommendations and natural language mood filtering.',
			tags: ['Google Gemini API', 'Vector Search', 'Svelte 5 Runes'],
			link: '/discover/ai',
			color: '#06b6d4'
		},
		{
			title: 'Developer Tool Suites',
			category: 'Client-Side Utilities',
			status: 'LIVE PRO',
			desc: 'High-speed JSON Studio, Image Studio (WebP/AVIF), Hash Generators & QR Code engine.',
			tags: ['HTML5 Canvas', 'Crypto Subtle', 'YAML Engine'],
			link: '/tools/json',
			color: '#8b5cf6'
		},
		{
			title: 'Personal OS Vault',
			category: 'System Operating System',
			status: 'STABLE',
			desc: 'Swiss Minimalist 2026 OLED Control Center with ⌘K Spotlight & Live Drawer.',
			tags: ['Swiss OLED', 'Linear.app', 'PWA Ready'],
			link: '/',
			color: '#10b981'
		}
	];
	const workspaces = [
		{ name: 'Challenges Tracker', icon: '🎯' },
		{ name: 'Draftin', icon: '📝' },
		{ name: 'eSport Profiler', icon: '🎮' },
		{ name: 'Gradus Tracker', icon: '📈' },
		{ name: 'JUG_SEC.COM - REVAMP', icon: '🛡️' },
		{ name: 'Jelp', icon: '🍕' },
		{ name: 'Movie Picker', icon: '🎬' },
		{ name: 'MyLocalNetflix', icon: '🍿' },
		{ name: 'Rareness 0.3', icon: '💎' },
		{ name: 'Rareness-Reference', icon: '📚' },
		{ name: 'Stasher', icon: '📦' },
		{ name: 'Sylepse', icon: '✈️' }
	];
</script>

<svelte:head>
	<title>Innovation Labs | Alan Vault</title>
</svelte:head>

<!-- Micro Grid Background -->
<div class="linear-grid-bg"></div>

<main class="tool-container">
	<div class="tool-header">
		<a href="/" class="back-link">← Back to Vault Hub</a>
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">🧪</span> Alan's Innovation Labs</h1>
			<span class="tool-badge">PROTOTYPES & ENGINES</span>
		</div>
		<p class="tool-subtitle">
			Showcase of active sub-projects, micro-applications, and experimental system algorithms.
		</p>
	</div>

	<div class="labs-grid">
		{#each labs as lab}
			<div class="lab-card" style="--lab-color: {lab.color}">
				<div class="card-top">
					<span class="category-tag">{lab.category}</span>
					<span class="status-pill" style="color: {lab.color}; background: {lab.color}15"
						>{lab.status}</span
					>
				</div>

				<div class="card-body">
					<h2 class="lab-title">{lab.title}</h2>
					<p class="lab-desc">{lab.desc}</p>
				</div>

				<div class="tech-tags">
					{#each lab.tags as tag}
						<span class="tag">{tag}</span>
					{/each}
				</div>

				<a href={lab.link} class="explore-btn" style="color: {lab.color}"> Launch Module → </a>
			</div>
		{/each}
	</div>

	<div class="divider"></div>

	<div class="tool-header" style="margin-top: 1rem;">
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">💻</span> Local Workspaces</h1>
			<span class="tool-badge blue">VS CODE DIRECT LAUNCH</span>
		</div>
		<p class="tool-subtitle">
			Direct shortcuts to launch local repositories from <code>C:\Users\theop\Desktop\Dev</code>.
		</p>
	</div>

	<div class="workspaces-grid">
		{#each workspaces as ws}
			<a href="vscode://file/C:/Users/theop/Desktop/Dev/{ws.name}" class="workspace-card">
				<span class="ws-icon">{ws.icon}</span>
				<span class="ws-name">{ws.name}</span>
			</a>
		{/each}
	</div>
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
		gap: 2.5rem;
	}

	.back-link {
		font-size: 0.85rem;
		font-weight: 700;
		color: #10b981;
		text-decoration: none;
		transition: opacity 120ms ease;
	}

	.back-link:hover {
		opacity: 0.8;
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
		color: #f4f4f5;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
	}

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
	}

	.tool-badge.blue {
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.25);
	}

	.tool-subtitle {
		color: #a1a1aa;
		font-size: 0.95rem;
		margin: 0.35rem 0 0 0;
	}

	.labs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1.5rem;
	}

	.lab-card {
		background: rgba(12, 12, 18, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		backdrop-filter: blur(16px);
		transition: all 150ms ease;
	}

	.lab-card:hover {
		border-color: var(--lab-color, #10b981);
		background: rgba(18, 18, 26, 0.85);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.category-tag {
		font-size: 0.75rem;
		font-weight: 800;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.status-pill {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
	}

	.lab-title {
		font-size: 1.3rem;
		font-weight: 800;
		color: #f4f4f5;
		margin: 0;
	}

	.lab-desc {
		font-size: 0.9rem;
		color: #a1a1aa;
		line-height: 1.5;
		margin-top: 0.3rem;
	}

	.tech-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag {
		font-size: 0.75rem;
		color: #a1a1aa;
		background: #09090d;
		border: 1px solid rgba(255, 255, 255, 0.06);
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
	}

	.explore-btn {
		margin-top: auto;
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 1.5rem 0;
	}

	.workspaces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1rem;
	}

	.workspace-card {
		padding: 1.1rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		border-radius: 16px;
		text-decoration: none;
		transition: all 150ms ease;
		background: rgba(12, 12, 18, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	.workspace-card:hover {
		background: rgba(18, 18, 26, 0.8);
		border-color: #3b82f6;
		transform: translateY(-2px);
	}

	.ws-icon {
		font-size: 1.25rem;
	}

	.ws-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: #f4f4f5;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
