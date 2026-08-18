<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import FilmIcon from 'lucide-svelte/icons/film';
	import TerminalIcon from 'lucide-svelte/icons/terminal';
	import DatabaseIcon from 'lucide-svelte/icons/database';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import GithubIcon from 'lucide-svelte/icons/github';
	import ArrowRightIcon from 'lucide-svelte/icons/arrow-right';

	let scratchpadText = $state('');
	let isClient = $state(false);

	onMount(() => {
		isClient = true;
		scratchpadText = localStorage.getItem('alan_vault_scratchpad') || '';
	});

	function handleScratchInput() {
		localStorage.setItem('alan_vault_scratchpad', scratchpadText);
	}

	const devSuites = [
		{ id: 'json', name: 'JSON Studio', url: '/tools/json', desc: 'Format, Validate & CSV' },
		{ id: 'diff', name: 'Diff & Text', url: '/tools/diff', desc: 'Side-by-Side & Regex' },
		{ id: 'image', name: 'Image Studio', url: '/tools/image', desc: 'Compress & Base64' },
		{ id: 'file', name: 'File Utils', url: '/tools/file', desc: 'Hashes & Converters' },
		{ id: 'generators', name: 'Generators', url: '/tools/generators', desc: 'UUIDs & Passwords' }
	];

	const bookmarks = [
		{ name: 'GitHub', url: 'https://github.com' },
		{ name: 'ChatGPT', url: 'https://chat.openai.com' },
		{ name: 'Vercel', url: 'https://vercel.com' },
		{ name: 'Cloudflare', url: 'https://dash.cloudflare.com' }
	];
</script>

<svelte:head>
	<title>Alan's Vault</title>
</svelte:head>

<div class="vault-container">
	<div class="linear-grid-bg"></div>
	
	<div class="vault-content" in:fade={{ duration: 400 }}>
		<header class="vault-header">
			<h1 class="vault-title">Vault<span class="dot">.</span></h1>
			<p class="vault-subtitle">Personal Operating System</p>
		</header>

		<div class="bento-grid">
			<!-- MAIN CINEMA CARD -->
			<a href="/movies" class="bento-card cinema-card group" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div class="card-bg-glow"></div>
				<div class="cinema-content">
					<div class="icon-wrapper">
						<FilmIcon size={32} class="text-emerald-500" />
					</div>
					<div>
						<h2 class="card-title text-2xl mb-2">Cinema OS</h2>
						<p class="card-desc max-w-md">Access your private, high-fidelity media library and streaming platform.</p>
					</div>
					<div class="action-arrow group-hover:translate-x-2 transition-transform">
						<ArrowRightIcon size={24} />
					</div>
				</div>
			</a>

			<!-- SCRATCHPAD -->
			<div class="bento-card scratchpad-card" in:fly={{ y: 20, duration: 400, delay: 150 }}>
				<div class="card-header">
					<TerminalIcon size={16} class="text-zinc-400" />
					<span class="header-title">Scratchpad</span>
				</div>
				<textarea
					bind:value={scratchpadText}
					oninput={handleScratchInput}
					placeholder="Type notes, JSON, or snippets here. Autosaves locally."
					class="scratchpad-input"
					spellcheck="false"
				></textarea>
			</div>

			<!-- DEV SUITES -->
			<div class="bento-card dev-card" in:fly={{ y: 20, duration: 400, delay: 200 }}>
				<div class="card-header mb-4">
					<DatabaseIcon size={16} class="text-zinc-400" />
					<span class="header-title">Developer Suites</span>
				</div>
				<div class="tools-grid">
					{#each devSuites as tool}
						<a href={tool.url} class="tool-btn">
							<span class="tool-name">{tool.name}</span>
							<span class="tool-desc">{tool.desc}</span>
						</a>
					{/each}
				</div>
			</div>

			<!-- BOOKMARKS -->
			<div class="bento-card bookmarks-card" in:fly={{ y: 20, duration: 400, delay: 250 }}>
				<div class="card-header mb-4">
					<ExternalLinkIcon size={16} class="text-zinc-400" />
					<span class="header-title">Quick Links</span>
				</div>
				<div class="bookmarks-list">
					{#each bookmarks as bm}
						<a href={bm.url} target="_blank" rel="noopener noreferrer" class="bookmark-link">
							{bm.name}
							<ArrowRightIcon size={14} class="opacity-50" />
						</a>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.vault-container {
		min-height: 100vh;
		position: relative;
		display: flex;
		justify-content: center;
		padding: 4rem 1.5rem;
		background: #09090b; /* Deep zinc */
		color: #f4f4f5;
		overflow-x: hidden;
	}

	.linear-grid-bg {
		position: absolute;
		inset: 0;
		background-image: 
			linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
		background-size: 60px 60px;
		mask-image: radial-gradient(circle at 50% 0%, black, transparent 70%);
		-webkit-mask-image: radial-gradient(circle at 50% 0%, black, transparent 70%);
		pointer-events: none;
		z-index: 0;
	}

	.vault-content {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 1000px;
	}

	.vault-header {
		margin-bottom: 3rem;
	}

	.vault-title {
		font-size: 3rem;
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	.dot {
		color: #10b981;
	}

	.vault-subtitle {
		color: #a1a1aa;
		font-size: 1.1rem;
		font-weight: 500;
	}

	/* BENTO GRID */
	.bento-grid {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 1.5rem;
		grid-auto-rows: minmax(180px, auto);
	}

	.bento-card {
		background: rgba(24, 24, 27, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 1.5rem;
		padding: 1.75rem;
		backdrop-filter: blur(20px);
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.bento-card:hover {
		border-color: rgba(255, 255, 255, 0.1);
		background: rgba(24, 24, 27, 0.8);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-title {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 600;
		color: #71717a;
	}

	/* SPECIFIC CARDS */
	.cinema-card {
		grid-column: span 12;
		background: linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(0,0,0,0) 100%);
		border: 1px solid rgba(16,185,129,0.2);
		justify-content: center;
	}
	
	.cinema-card:hover {
		border-color: rgba(16,185,129,0.4);
		box-shadow: 0 0 40px rgba(16,185,129,0.1);
	}

	.card-bg-glow {
		position: absolute;
		top: -50%;
		right: -10%;
		width: 300px;
		height: 300px;
		background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%);
		pointer-events: none;
	}

	.cinema-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		position: relative;
		z-index: 2;
	}

	.icon-wrapper {
		background: rgba(16,185,129,0.1);
		padding: 1rem;
		border-radius: 1rem;
	}

	.action-arrow {
		background: #fff;
		color: #000;
		padding: 1rem;
		border-radius: 50%;
		display: flex;
	}

	.scratchpad-card {
		grid-column: span 12;
		min-height: 250px;
	}

	@media (min-width: 768px) {
		.scratchpad-card {
			grid-column: span 7;
		}
	}

	.scratchpad-input {
		flex: 1;
		width: 100%;
		background: transparent;
		border: none;
		color: #e4e4e7;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		resize: none;
		outline: none;
		margin-top: 1rem;
	}
	
	.scratchpad-input::placeholder {
		color: #52525b;
	}

	.dev-card {
		grid-column: span 12;
	}

	@media (min-width: 768px) {
		.dev-card {
			grid-column: span 5;
		}
	}

	.tools-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	.tool-btn {
		display: flex;
		flex-direction: column;
		padding: 0.75rem 1rem;
		background: rgba(255,255,255,0.03);
		border-radius: 0.75rem;
		transition: all 0.2s;
	}

	.tool-btn:hover {
		background: rgba(255,255,255,0.06);
		transform: translateX(4px);
	}

	.tool-name {
		font-weight: 500;
		color: #e4e4e7;
		font-size: 0.95rem;
	}

	.tool-desc {
		font-size: 0.75rem;
		color: #71717a;
	}

	.bookmarks-card {
		grid-column: span 12;
	}

	.bookmarks-list {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.bookmark-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.05);
		border-radius: 99px;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.bookmark-link:hover {
		background: #fff;
		color: #000;
	}
</style>
