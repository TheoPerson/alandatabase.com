<script lang="ts">
	const labs = [
		{
			title: 'Cinema DB Engine',
			category: 'Database & Search',
			status: 'ACTIVE V1.0',
			desc: 'Personal movie vault with hybrid Postgres full-text & TMDB API fallback search.',
			tags: ['SvelteKit 2', 'Neon Postgres', 'TMDB API', 'Drizzle ORM'],
			link: '/movies',
			color: '#eab308'
		},
		{
			title: 'AI Curator Studio',
			category: 'Artificial Intelligence',
			status: 'ACTIVE V1.0',
			desc: 'LLM-powered conversational movie recommendations and natural language mood filtering.',
			tags: ['Google Gemini API', 'Vector Search', 'Svelte 5 Runes'],
			link: '/discover/ai',
			color: '#ec4899'
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
			desc: 'Glassmorphic 2026 Bento Command Center with ⌘K Spotlight Launcher.',
			tags: ['Glassmorphism', 'Aurora Mesh', 'PWA Ready'],
			link: '/',
			color: '#14b8a6'
		}
	];
	const workspaces = [
		{ name: 'AI COMMANDS  - PROMPTS', icon: '🤖' },
		{ name: 'ArcRaiders-AutoScrapper', icon: '🕷️' },
		{ name: 'Challenges Tracker', icon: '🎯' },
		{ name: 'Draftin', icon: '📝' },
		{ name: 'Gradus Tracker', icon: '📈' },
		{ name: 'JUG_SEC.COM - REVAMP', icon: '🛡️' },
		{ name: 'Jelp', icon: '🍕' },
		{ name: 'Movie Picker', icon: '🎬' },
		{ name: 'MyLocalNetflix', icon: '🍿' },
		{ name: 'Rareness 0.1', icon: '💎' },
		{ name: 'Rareness 0.2', icon: '💎' },
		{ name: 'Rareness 0.3', icon: '💎' },
		{ name: 'Rareness-Reference', icon: '📚' },
		{ name: 'Razor', icon: '🪒' },
		{ name: 'Stasher', icon: '📦' },
		{ name: 'Sylepse', icon: '✈️' },
		{ name: 'Terminal', icon: '💻' },
		{ name: 'VolumeScheduler', icon: '🔊' },
		{ name: 'arcforge', icon: '⚒️' },
		{ name: 'eSport Profiler', icon: '🎮' }
	];
</script>

<svelte:head>
	<title>Innovation Labs | Alan OS</title>
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
			<h1 class="tool-title"><span class="icon">🧪</span> Alan's Innovation Labs</h1>
			<span class="tool-badge">PROTOTYPES & ENGINES</span>
		</div>
		<p class="tool-subtitle">Showcase of active sub-projects, micro-applications, and experimental system algorithms.</p>
	</div>

	<div class="labs-grid">
		{#each labs as lab}
			<div class="lab-card glass-card" style="--lab-color: {lab.color}">
				<div class="card-top">
					<span class="category-tag">{lab.category}</span>
					<span class="status-pill" style="color: {lab.color}; background: {lab.color}15">{lab.status}</span>
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

				<a href={lab.link} class="explore-btn" style="color: {lab.color}">
					Launch Module →
				</a>
			</div>
		{/each}
	</div>

	<div class="divider"></div>

	<div class="tool-header" style="margin-top: 1rem;">
		<div class="title-row">
			<h1 class="tool-title"><span class="icon">💻</span> Local Workspaces</h1>
			<span class="tool-badge" style="color: #60a5fa; background: rgba(96, 165, 250, 0.15); border-color: rgba(96, 165, 250, 0.3);">VS CODE DIRECT LAUNCH</span>
		</div>
		<p class="tool-subtitle">Direct shortcuts to launch local repositories from <code>C:\Users\theop\Desktop\Dev</code>.</p>
	</div>

	<div class="workspaces-grid">
		{#each workspaces as ws}
			<a href="vscode://file/C:/Users/theop/Desktop/Dev/{ws.name}" class="workspace-card glass-card">
				<span class="ws-icon">{ws.icon}</span>
				<span class="ws-name">{ws.name}</span>
			</a>
		{/each}
	</div>
</main>

<style>
	.tool-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.back-link { font-size: 0.85rem; font-weight: 700; color: var(--accent-gold); }

	.title-row { display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; }

	.tool-title { font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; margin: 0; }

	.tool-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-teal, #14b8a6);
		background: rgba(20, 184, 166, 0.15);
		border: 1px solid rgba(20, 184, 166, 0.3);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
	}

	.tool-subtitle { color: var(--text-secondary); font-size: 0.95rem; margin: 0.25rem 0 0 0; }

	.labs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 1.5rem;
	}

	.lab-card {
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		position: relative;
	}

	.lab-card:hover {
		border-color: var(--lab-color);
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.category-tag {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-pill {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-full);
	}

	.lab-title {
		font-size: 1.3rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}

	.lab-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
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
		color: var(--text-tertiary);
		background: var(--bg-surface-2);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.explore-btn {
		margin-top: auto;
		font-size: 0.9rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.divider {
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
		margin: 2rem 0;
	}

	.workspaces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1rem;
	}

	.workspace-card {
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		border-radius: var(--radius-md, 12px);
		text-decoration: none;
		transition: all 0.2s ease;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.workspace-card:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(96, 165, 250, 0.5);
		transform: translateY(-2px);
	}

	.ws-icon {
		font-size: 1.25rem;
	}

	.ws-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
