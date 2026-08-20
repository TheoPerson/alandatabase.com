<script lang="ts">
	import ArrowUpRightIcon from 'lucide-svelte/icons/arrow-up-right';
	import ActivityIcon from 'lucide-svelte/icons/activity';
	import BracesIcon from 'lucide-svelte/icons/braces';
	import Code2Icon from 'lucide-svelte/icons/code-2';
	import CommandIcon from 'lucide-svelte/icons/command';
	import FilmIcon from 'lucide-svelte/icons/film';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import LockKeyholeIcon from 'lucide-svelte/icons/lock-keyhole';
	import MonitorSmartphoneIcon from 'lucide-svelte/icons/monitor-smartphone';
	import SearchCheckIcon from 'lucide-svelte/icons/search-check';
	import ServerIcon from 'lucide-svelte/icons/server';
	import Settings2Icon from 'lucide-svelte/icons/settings-2';

	const disciplines = [
		{ name: 'Product direction', detail: 'Scope, priorities, milestones', icon: SearchCheckIcon },
		{ name: 'Frontend craft', detail: 'Svelte, component systems, motion', icon: Code2Icon },
		{ name: 'Backend systems', detail: 'Data, services, integrations', icon: ServerIcon },
		{ name: 'Responsive UX', detail: 'iPhone-first, desktop-ready', icon: MonitorSmartphoneIcon },
		{ name: 'SEO & hosting', detail: 'Metadata, deploys, observability', icon: ActivityIcon },
		{ name: 'Security', detail: 'Private by default, fail-closed', icon: LockKeyholeIcon },
		{ name: 'Quality assurance', detail: 'Checks, tests, recovery states', icon: BracesIcon }
	];
</script>

<svelte:head>
	<title>Alan's Database | Private cinema, carefully built</title>
	<meta
		name="description"
		content="A private cinema archive and focused software workspace, built with care."
	/>
	<meta property="og:title" content="Alan's Database" />
	<meta property="og:description" content="Private cinema, carefully built." />
</svelte:head>

<main class="site">
	<section class="hero" aria-labelledby="hero-title">
		<div class="hero-image" aria-hidden="true"></div>
		<div class="hero-overlay" aria-hidden="true"></div>
		<nav class="nav page-width" aria-label="Primary navigation">
			<a class="brand" href="/" aria-label="Alan's Database home">
				<span class="brand-mark"><CommandIcon size={16} /></span> ALAN'S DATABASE
			</a>
			<div class="nav-links">
				<a href="#craft">How it is built</a>
				<a href="https://github.com/TheoPerson/alandatabase.com" target="_blank" rel="noreferrer">
					GitHub <ArrowUpRightIcon size={14} />
				</a>
			</div>
		</nav>
		<div class="hero-content page-width">
			<p class="eyebrow"><span></span> Personal archive / V3 in progress</p>
			<h1 id="hero-title">A quieter way<br />to keep what matters.</h1>
			<p class="hero-copy">
				A private cinema archive for films, ideas, and the tools behind them. Built deliberately,
				one reliable release at a time.
			</p>
			<div class="actions">
				<a class="button primary" href="/movies"
					><FilmIcon size={17} /> Enter Cinema <ArrowUpRightIcon size={16} /></a
				>
				<a class="button secondary" href="#craft">See the craft</a>
			</div>
		</div>
		<div class="hero-meta page-width">
			<span>Private by default</span><i></i><span>Designed for 2026</span><i></i><span
				>Built for the long run</span
			>
		</div>
	</section>

	<section id="craft" class="craft page-width" aria-labelledby="craft-title">
		<div class="intro">
			<p class="eyebrow dark">The work behind the work</p>
			<h2 id="craft-title">Every layer gets<br /><em>its own standard.</em></h2>
			<p>
				Product decisions, code, design, infrastructure, and verification stay visible so the
				project can improve without losing its shape.
			</p>
		</div>
		<div class="craft-grid">
			<a class="cinema-link" href="/movies">
				<div class="label"><span>01</span><span>Private cinema</span></div>
				<div class="cinema-icon"><FilmIcon size={21} /></div>
				<div>
					<h3>Cinema</h3>
					<p>Browse the collection, keep a watchlist, and make the next choice feel easy.</p>
				</div>
				<span class="green-link">Open collection <ArrowUpRightIcon size={17} /></span>
			</a>
			<div class="discipline-panel">
				<div class="label"><span>02</span><span>Project disciplines</span></div>
				<div class="discipline-list">
					{#each disciplines as discipline}
						{@const Icon = discipline.icon}
						<div class="discipline">
							<span class="discipline-icon"><Icon size={16} /></span><span
								><strong>{discipline.name}</strong><small>{discipline.detail}</small></span
							>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="tools page-width" aria-labelledby="tools-title">
		<div>
			<p class="eyebrow dark">Useful, not decorative</p>
			<h2 id="tools-title">The workspace stays close.</h2>
		</div>
		<div class="tool-links">
			<a href="/status"><ActivityIcon size={16} /> Status <ArrowUpRightIcon size={14} /></a>
			<a href="/setup"><Settings2Icon size={16} /> Setup <ArrowUpRightIcon size={14} /></a>
			<a href="/tools/json"><BracesIcon size={16} /> JSON Studio <ArrowUpRightIcon size={14} /></a>
		</div>
	</section>

	<footer class="footer page-width">
		<span class="brand dark-brand"><CommandIcon size={15} /> Alan's Database</span><span
			>Private cinema, considered software.</span
		><a href="https://github.com/TheoPerson/alandatabase.com" target="_blank" rel="noreferrer"
			><ExternalLinkIcon size={16} /> Source on GitHub</a
		>
	</footer>
</main>

<style>
	:global(body) {
		background: #08090a;
	}
	.site {
		background: #f1f2ee;
		color: #111416;
		font-family: var(--font-sans);
	}
	.page-width {
		width: min(1200px, calc(100% - 48px));
		margin: 0 auto;
	}
	.hero {
		min-height: min(820px, 100svh);
		position: relative;
		display: flex;
		flex-direction: column;
		isolation: isolate;
		overflow: hidden;
		color: #f7f8f5;
	}
	.hero-image,
	.hero-overlay {
		position: absolute;
		inset: 0;
		z-index: -2;
	}
	.hero-image {
		background: url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2200&q=88')
			center / cover;
	}
	.hero-overlay {
		z-index: -1;
		background: rgba(7, 10, 11, 0.64);
	}
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 27px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}
	.brand,
	.nav-links,
	.actions,
	.button,
	.green-link,
	.footer,
	.tool-links a {
		display: inline-flex;
		align-items: center;
	}
	.brand {
		gap: 10px;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 50%;
	}
	.nav-links {
		gap: 25px;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.82rem;
	}
	.nav-links a,
	.footer a {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		transition: color 0.18s ease;
	}
	.nav-links a:hover,
	.footer a:hover {
		color: #8ee8c0;
	}
	.hero-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 100px 0 120px;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 23px;
		color: rgba(255, 255, 255, 0.68);
		font-size: 0.69rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.eyebrow span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #8ee8c0;
		box-shadow: 0 0 0 5px rgba(142, 232, 192, 0.14);
	}
	.eyebrow.dark {
		color: #68706c;
	}
	h1,
	h2,
	h3,
	p {
		margin: 0;
	}
	h1 {
		max-width: 760px;
		font-size: clamp(3.3rem, 8vw, 7rem);
		font-weight: 500;
		letter-spacing: -0.065em;
		line-height: 0.95;
	}
	.hero-copy {
		max-width: 500px;
		margin-top: 30px;
		color: rgba(255, 255, 255, 0.75);
		font-size: clamp(1rem, 1.5vw, 1.2rem);
		line-height: 1.6;
	}
	.actions {
		gap: 12px;
		margin-top: 36px;
	}
	.button {
		min-height: 48px;
		gap: 9px;
		padding: 0 19px;
		border: 1px solid transparent;
		font-size: 0.88rem;
		font-weight: 750;
		transition:
			transform 0.18s ease,
			background 0.18s ease;
	}
	.button:hover {
		transform: translateY(-2px);
	}
	.primary {
		background: #a5f2cd;
		color: #0b2017;
	}
	.primary:hover {
		background: #c2f9dc;
	}
	.secondary {
		border-color: rgba(255, 255, 255, 0.32);
		color: #fff;
	}
	.secondary:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.hero-meta {
		display: flex;
		align-items: center;
		gap: 14px;
		padding-bottom: 28px;
		color: rgba(255, 255, 255, 0.55);
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.hero-meta i {
		width: 34px;
		height: 1px;
		background: rgba(255, 255, 255, 0.32);
	}
	.craft {
		padding: 128px 0 100px;
	}
	.intro {
		display: grid;
		grid-template-columns: 1fr 1.4fr 1fr;
		gap: 32px;
		align-items: end;
		padding-bottom: 64px;
		border-bottom: 1px solid #d2d3cf;
	}
	.intro h2 {
		font-size: clamp(2.2rem, 4.5vw, 4.2rem);
		font-weight: 500;
		letter-spacing: -0.055em;
		line-height: 0.98;
	}
	.intro h2 em {
		color: #67736e;
		font-style: normal;
	}
	.intro > p:last-child {
		max-width: 260px;
		justify-self: end;
		color: #68706c;
		font-size: 0.95rem;
		line-height: 1.6;
	}
	.craft-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin-top: 1px;
		background: #d2d3cf;
		border-bottom: 1px solid #d2d3cf;
	}
	.cinema-link,
	.discipline-panel {
		min-height: 445px;
		padding: 31px;
		background: #f1f2ee;
	}
	.cinema-link {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		transition: background 0.18s ease;
	}
	.cinema-link:hover {
		background: #e6e8e3;
	}
	.label {
		display: flex;
		justify-content: space-between;
		color: #7d8580;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.cinema-icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border: 1px solid #c9cdc7;
		border-radius: 50%;
		color: #16885c;
	}
	.cinema-link h3 {
		font-size: clamp(2.5rem, 5vw, 5rem);
		font-weight: 500;
		letter-spacing: -0.07em;
		line-height: 0.9;
	}
	.cinema-link p {
		max-width: 360px;
		margin-top: 18px;
		color: #68706c;
		font-size: 0.96rem;
		line-height: 1.55;
	}
	.green-link {
		align-self: flex-start;
		gap: 8px;
		color: #16885c;
		font-size: 0.8rem;
		font-weight: 800;
	}
	.discipline-panel {
		background: #e8e9e5;
	}
	.discipline-list {
		margin-top: 42px;
	}
	.discipline {
		display: grid;
		grid-template-columns: 36px 1fr;
		gap: 14px;
		align-items: center;
		padding: 13px 0;
		border-top: 1px solid #cfd2cc;
	}
	.discipline:last-child {
		border-bottom: 1px solid #cfd2cc;
	}
	.discipline-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid #c5cac3;
		border-radius: 50%;
		color: #68706c;
	}
	.discipline span:last-child {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.discipline strong {
		font-size: 0.9rem;
	}
	.discipline small {
		color: #7c837e;
		font-size: 0.75rem;
	}
	.tools {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 30px;
		padding: 45px 0 100px;
		border-top: 1px solid #d2d3cf;
	}
	.tools h2 {
		font-size: clamp(1.8rem, 3.5vw, 3rem);
		font-weight: 500;
		letter-spacing: -0.05em;
	}
	.tool-links {
		display: flex;
		gap: 9px;
		flex-wrap: wrap;
		justify-content: end;
	}
	.tool-links a {
		gap: 7px;
		padding: 11px 13px;
		border: 1px solid #cdd1cb;
		color: #68706c;
		font-size: 0.77rem;
		font-weight: 750;
		transition:
			color 0.18s ease,
			border-color 0.18s ease;
	}
	.tool-links a:hover {
		border-color: #16885c;
		color: #16885c;
	}
	.footer {
		justify-content: space-between;
		gap: 20px;
		padding: 25px 0 30px;
		border-top: 1px solid #d2d3cf;
		color: #68706c;
		font-size: 0.75rem;
	}
	.dark-brand {
		color: #111416;
		letter-spacing: 0;
	}
	.footer a {
		gap: 7px;
		color: #16885c;
		font-weight: 750;
	}
	@media (max-width: 760px) {
		.page-width {
			width: calc(100% - 32px);
		}
		.nav {
			padding: 20px 0;
		}
		.nav-links a:first-child {
			display: none;
		}
		.hero-content {
			padding: 90px 0 100px;
		}
		h1 {
			font-size: clamp(3.2rem, 16vw, 5.4rem);
		}
		.hero-meta {
			flex-wrap: wrap;
			gap: 10px;
			font-size: 0.57rem;
		}
		.hero-meta i {
			width: 18px;
		}
		.craft {
			padding: 80px 0;
		}
		.intro {
			display: block;
			padding-bottom: 40px;
		}
		.intro h2 {
			margin-bottom: 22px;
		}
		.intro > p:last-child {
			max-width: 310px;
		}
		.craft-grid {
			grid-template-columns: 1fr;
		}
		.cinema-link,
		.discipline-panel {
			min-height: 360px;
			padding: 24px;
		}
		.tools {
			align-items: start;
			flex-direction: column;
			padding-bottom: 80px;
		}
		.tool-links {
			justify-content: start;
		}
		.footer {
			align-items: start;
			flex-direction: column;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			transition-duration: 0.01ms !important;
		}
	}
</style>
