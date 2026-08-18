<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import FilmIcon from 'lucide-svelte/icons/film';
	import TerminalIcon from 'lucide-svelte/icons/terminal';
	import DatabaseIcon from 'lucide-svelte/icons/database';
	import ArrowRightIcon from 'lucide-svelte/icons/arrow-right';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import CommandIcon from 'lucide-svelte/icons/command';
	import CodeIcon from 'lucide-svelte/icons/code';
	import ZapIcon from 'lucide-svelte/icons/zap';
	import LayoutDashboardIcon from 'lucide-svelte/icons/layout-dashboard';

	let scratchpadText = $state('');
	let isClient = $state(false);
	let currentTime = $state('');
	let currentDate = $state('');

	onMount(() => {
		isClient = true;
		scratchpadText = localStorage.getItem('alan_vault_scratchpad') || '';

		const updateTime = () => {
			const now = new Date();
			currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
			currentDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	});

	function handleScratchInput() {
		localStorage.setItem('alan_vault_scratchpad', scratchpadText);
	}

	const devSuites = [
		{ name: 'JSON Studio', url: '/tools/json', icon: CodeIcon },
		{ name: 'Diff & Regex', url: '/tools/diff', icon: TerminalIcon },
		{ name: 'Image Studio', url: '/tools/image', icon: ZapIcon },
		{ name: 'Generators', url: '/tools/generators', icon: DatabaseIcon }
	];

	const links = [
		{ name: 'Vercel', url: 'https://vercel.com' },
		{ name: 'GitHub', url: 'https://github.com' },
		{ name: 'Cloudflare', url: 'https://dash.cloudflare.com' }
	];
</script>

<svelte:head>
	<title>Vault OS</title>
</svelte:head>

<main class="min-h-screen bg-black text-zinc-100 font-sans relative overflow-hidden selection:bg-emerald-500/30">
	<!-- Ambient Background Glow -->
	<div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none"></div>
	<div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none"></div>
	<div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

	<div class="max-w-6xl mx-auto px-6 py-12 lg:py-24 relative z-10">
		
		<!-- Header Section -->
		<header class="flex flex-col md:flex-row md:items-end justify-between mb-12" in:fade={{ duration: 500 }}>
			<div>
				<div class="flex items-center gap-3 mb-2">
					<div class="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
						<CommandIcon size={20} class="text-emerald-400" />
					</div>
					<h1 class="text-xl font-bold tracking-tight text-zinc-100">Alan's Vault</h1>
				</div>
				<p class="text-zinc-500 font-medium ml-1">Personal Operating System</p>
			</div>
			
			<div class="mt-6 md:mt-0 text-left md:text-right">
				<div class="text-3xl font-bold tracking-tighter text-zinc-100">{currentTime}</div>
				<div class="text-sm font-medium text-zinc-500">{currentDate}</div>
			</div>
		</header>

		<!-- Bento Grid -->
		<div class="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[120px]">
			
			<!-- CINEMA OS (Hero Card) -->
			<a href="/movies" class="group relative col-span-1 md:col-span-8 row-span-2 md:row-span-3 rounded-3xl overflow-hidden border border-zinc-800/50 bg-zinc-950 transition-all hover:border-emerald-500/30" in:fly={{ y: 20, duration: 500, delay: 100 }}>
				<!-- Card Background -->
				<div class="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-zinc-950/80 to-zinc-950 z-0"></div>
				<div class="absolute right-0 top-0 w-3/4 h-full bg-gradient-to-l from-emerald-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
				
				<div class="relative z-10 h-full flex flex-col justify-between p-8">
					<div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center backdrop-blur-md">
						<FilmIcon size={28} class="text-emerald-400" />
					</div>
					
					<div class="mt-8">
						<h2 class="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">Cinema OS</h2>
						<p class="text-lg text-zinc-400 max-w-md font-medium leading-relaxed">
							Your private, high-fidelity media library and streaming platform.
						</p>
					</div>

					<div class="absolute bottom-8 right-8 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
						<ArrowRightIcon size={24} />
					</div>
				</div>
			</a>

			<!-- DEV SUITES (List Card) -->
			<div class="col-span-1 md:col-span-4 row-span-2 rounded-3xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm p-6 flex flex-col" in:fly={{ y: 20, duration: 500, delay: 200 }}>
				<div class="flex items-center gap-2 mb-6 text-zinc-400">
					<LayoutDashboardIcon size={16} />
					<h3 class="text-xs font-bold uppercase tracking-widest">Developer Suites</h3>
				</div>
				
				<div class="flex flex-col gap-2 flex-1 justify-center">
					{#each devSuites as suite}
						{@const Icon = suite.icon}
						<a href={suite.url} class="group/item flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-700/50">
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 group-hover/item:text-emerald-400 group-hover/item:bg-emerald-950/50 transition-colors">
									<Icon size={16} />
								</div>
								<span class="font-medium text-zinc-200 group-hover/item:text-white transition-colors">{suite.name}</span>
							</div>
							<ArrowRightIcon size={14} class="text-zinc-600 group-hover/item:text-zinc-300 transition-colors" />
						</a>
					{/each}
				</div>
			</div>

			<!-- SCRATCHPAD -->
			<div class="col-span-1 md:col-span-8 row-span-2 rounded-3xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm p-6 flex flex-col group focus-within:border-zinc-600/50 transition-colors" in:fly={{ y: 20, duration: 500, delay: 300 }}>
				<div class="flex items-center gap-2 mb-4 text-zinc-400">
					<CodeIcon size={16} />
					<h3 class="text-xs font-bold uppercase tracking-widest">Local Scratchpad</h3>
				</div>
				<textarea
					bind:value={scratchpadText}
					oninput={handleScratchInput}
					placeholder="Paste JSON, write a query, or drop temporary notes here..."
					class="w-full flex-1 bg-transparent border-none outline-none text-emerald-400/90 font-mono text-sm leading-relaxed resize-none placeholder:text-zinc-700"
					spellcheck="false"
				></textarea>
			</div>

			<!-- QUICK LINKS -->
			<div class="col-span-1 md:col-span-4 row-span-1 rounded-3xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm p-6 flex flex-col justify-center" in:fly={{ y: 20, duration: 500, delay: 400 }}>
				<div class="flex items-center gap-4 justify-between">
					{#each links as link}
						<a href={link.url} target="_blank" rel="noopener noreferrer" class="flex flex-col items-center gap-2 text-zinc-500 hover:text-white transition-colors">
							<div class="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/30 hover:border-zinc-500 transition-colors">
								<ExternalLinkIcon size={16} />
							</div>
							<span class="text-[10px] font-bold uppercase tracking-wider">{link.name}</span>
						</a>
					{/each}
				</div>
			</div>

		</div>
	</div>
</main>
