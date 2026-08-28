<script lang="ts">
	const { data } = $props();

	type ServiceState = 'operational' | 'degraded' | 'outage' | 'unknown';

	const statusCopy: Record<ServiceState, { label: string; headline: string; detail: string }> = {
		operational: {
			label: 'Operational',
			headline: 'All systems operational',
			detail: 'The application, API, authentication, and primary data store are responding.'
		},
		degraded: {
			label: 'Degraded',
			headline: 'Some systems are degraded',
			detail: 'Core access remains available, but at least one dependency needs attention.'
		},
		outage: {
			label: 'Outage',
			headline: 'Service interruption detected',
			detail: 'At least one critical service is currently unavailable.'
		},
		unknown: {
			label: 'Unverified',
			headline: 'Monitoring data unavailable',
			detail: 'Live checks could not establish the current state.'
		}
	};

	const overall = $derived(statusCopy[data.status.overallState as ServiceState]);
	const uptime = $derived(data.status.externalUptime);

	function formatPercent(value: number | null): string {
		return value === null ? '—' : `${value.toFixed(value >= 99 ? 3 : 2)}%`;
	}

	function formatLatency(value: number | null): string {
		return value === null ? 'No sample' : `${Math.round(value)} ms`;
	}

	function formatDowntime(value: number | null): string {
		if (value === null) return '—';
		if (value < 60) return `${Math.round(value)} sec`;
		if (value < 3600) return `${Math.round(value / 60)} min`;
		return `${(value / 3600).toFixed(1)} hr`;
	}

	function formatDate(value: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'UTC',
			timeZoneName: 'short'
		}).format(new Date(value));
	}

	function sectionTone(title: string): string {
		if (title === 'Security') return 'security';
		if (title === 'Fixed') return 'fixed';
		if (title === 'Known Issues') return 'known';
		if (title === 'Major Updates') return 'major';
		return 'technical';
	}
</script>

<svelte:head>
	<title>System Status & Release Notes | Alan Database</title>
	<meta
		name="description"
		content="Live service health, uptime, incidents, and Alan Database V3 release notes."
	/>
	<link rel="canonical" href="https://status.alandatabase.com/" />
	<meta property="og:title" content="Alan Database — System Status" />
	<meta property="og:description" content="Live service health, uptime, and V3 release notes." />
	<meta property="og:url" content="https://status.alandatabase.com/" />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="status-shell">
	<header class="site-header">
		<a class="brand" href="https://alandatabase.com/" aria-label="Alan Database home">
			<span class="brand-mark" aria-hidden="true">A</span>
			<span>ALAN DATABASE</span>
		</a>
		<nav aria-label="Status navigation">
			<a href="#services">Services</a>
			<a href="#release-notes">Release notes</a>
			<a class="return-link" href="https://alandatabase.com/movies">Open Cinema</a>
		</nav>
	</header>

	<main>
		<section class="hero" aria-labelledby="status-heading">
			<div
				class="fluid-field"
				class:degraded={data.status.overallState === 'degraded'}
				class:outage={data.status.overallState === 'outage'}
				aria-hidden="true"
			>
				<span class="fluid-layer fluid-layer-one"></span>
				<span class="fluid-layer fluid-layer-two"></span>
				<span class="fluid-layer fluid-layer-three"></span>
			</div>
			<div class="hero-copy">
				<p class="eyebrow">Public System Status · V3 Alpha</p>
				<div class="overall-line">
					<span
						class="pulse"
						class:degraded={data.status.overallState === 'degraded'}
						class:outage={data.status.overallState === 'outage'}
					></span>
					<span>{overall.label}</span>
				</div>
				<h1 id="status-heading">{overall.headline}</h1>
				<p class="hero-detail">{overall.detail}</p>
				<p class="checked">
					Last checked
					<time datetime={data.status.checkedAt}>{formatDate(data.status.checkedAt)}</time>
				</p>
			</div>

			<div class="uptime-card" aria-label="External uptime summary">
				<div class="metric-heading">
					<span>30-day uptime</span>
					<span class="source-badge">{uptime.configured ? 'UptimeRobot v3' : 'Live probes'}</span>
				</div>
				<strong>{formatPercent(uptime.uptimePercent)}</strong>
				<div class="metric-grid">
					<div>
						<span>Response</span>
						<b>{formatLatency(uptime.averageResponseMs)}</b>
					</div>
					<div>
						<span>Incidents</span>
						<b>{uptime.incidentCount ?? '—'}</b>
					</div>
					<div>
						<span>Downtime</span>
						<b>{formatDowntime(uptime.downtimeSeconds)}</b>
					</div>
				</div>
				<p class="monitor-note">
					{#if uptime.configured && uptime.state !== 'unknown'}
						External monitor {uptime.monitorId} · {uptime.monitorName}
					{:else if uptime.configured}
						External monitor configured; its latest sample is temporarily unavailable.
					{:else}
						Add the server-only UptimeRobot key to publish independent historical uptime.
					{/if}
				</p>
			</div>
		</section>

		<section class="services-section" id="services" aria-labelledby="services-heading">
			<div class="section-heading">
				<div>
					<p class="kicker">Current availability</p>
					<h2 id="services-heading">Services</h2>
				</div>
				<p>Live database probe and current request-path measurements.</p>
			</div>

			<div class="service-list">
				{#each data.status.services as service (service.name)}
					<article class="service-row">
						<div class="service-identity">
							<span class="service-dot state-{service.state}" aria-hidden="true"></span>
							<div>
								<h3>{service.name}</h3>
								<p>{service.description}</p>
							</div>
						</div>
						<div class="service-result">
							<span>{formatLatency(service.latencyMs)}</span>
							<strong class="state-text state-{service.state}">
								{statusCopy[service.state as ServiceState].label}
							</strong>
							<span class="availability-code">
								{service.state === 'operational' ? 'ONLINE' : service.state.toUpperCase()}
							</span>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section class="release-section" id="release-notes" aria-labelledby="release-heading">
			<div class="section-heading release-heading">
				<div>
					<p class="kicker">Product & engineering</p>
					<h2 id="release-heading">Release notes</h2>
				</div>
				<a
					class="repository-link"
					href="https://github.com/TheoPerson/alandatabase.com/blob/agent/v3-foundation-core/CHANGELOG.md"
					rel="noreferrer"
				>
					View source changelog
				</a>
			</div>

			<div class="release-list">
				{#each data.releases as release, index (release.version)}
					<article class="release-card">
						<header class="release-card-header">
							<div>
								<span class="release-index">{String(index + 1).padStart(2, '0')}</span>
								<h3>
									{release.version === 'Unreleased'
										? 'V3 current patch'
										: `Version ${release.version}`}
								</h3>
							</div>
							<span class="release-date">{release.date ?? 'In progress'}</span>
						</header>

						<div class="release-sections">
							{#each release.sections as section (section.title)}
								<section class="change-group tone-{sectionTone(section.title)}">
									<h4>{section.title}</h4>
									<ul>
										{#each section.items as item (item)}
											<li>{item}</li>
										{/each}
									</ul>
								</section>
							{/each}
						</div>
					</article>
				{/each}
			</div>
		</section>
	</main>

	<footer>
		<span>Alan Database · V3 pre-release</span>
		<span>Status data is cached for 60 seconds.</span>
	</footer>
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	.status-shell {
		min-height: 100vh;
		background:
			radial-gradient(circle at 78% 5%, rgba(52, 211, 153, 0.09), transparent 28rem), #050607;
		color: #f5f7f6;
	}

	.site-header,
	main,
	footer {
		width: min(1180px, calc(100% - 2rem));
		margin-inline: auto;
	}

	.site-header {
		min-height: 74px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		color: #f5f7f6;
		font: 750 0.78rem/1 var(--font-sans);
		letter-spacing: 0.16em;
		text-decoration: none;
	}

	.brand-mark {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 1px solid rgba(52, 211, 153, 0.55);
		border-radius: 50%;
		color: #6ee7b7;
		letter-spacing: 0;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	nav a,
	.repository-link {
		color: #929b97;
		font-size: 0.82rem;
		text-decoration: none;
	}

	nav a:hover,
	nav a:focus-visible,
	.repository-link:hover,
	.repository-link:focus-visible {
		color: #d1fae5;
	}

	.return-link {
		padding: 0.65rem 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.13);
		border-radius: 999px;
	}

	.hero {
		position: relative;
		isolation: isolate;
		padding: clamp(4rem, 9vw, 7.5rem) 0 clamp(3.5rem, 7vw, 6rem);
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
		gap: clamp(2rem, 7vw, 6rem);
		align-items: end;
	}

	.hero-copy,
	.uptime-card {
		position: relative;
		z-index: 1;
	}

	.fluid-field {
		position: absolute;
		z-index: 0;
		top: clamp(1rem, 4vw, 3.5rem);
		right: clamp(-5rem, -3vw, -2rem);
		width: clamp(19rem, 39vw, 34rem);
		aspect-ratio: 1;
		contain: layout paint;
		pointer-events: none;
		opacity: 0.62;
		filter: blur(10px);
	}

	.fluid-layer {
		position: absolute;
		inset: 13%;
		display: block;
		border-radius: 43% 57% 63% 37% / 52% 38% 62% 48%;
		background:
			radial-gradient(circle at 28% 30%, rgba(167, 243, 208, 0.72), transparent 25%),
			conic-gradient(
				from 120deg,
				rgba(16, 185, 129, 0.58),
				rgba(6, 78, 59, 0.08),
				rgba(52, 211, 153, 0.42),
				rgba(16, 185, 129, 0.58)
			);
		mix-blend-mode: screen;
		transform: translate3d(0, 0, 0);
		transform-origin: 49% 51%;
		will-change: transform;
		animation: fluid-drift 17s linear infinite;
	}

	.fluid-layer-two {
		inset: 19% 8% 7% 23%;
		border-radius: 61% 39% 42% 58% / 38% 55% 45% 62%;
		background:
			radial-gradient(circle at 68% 34%, rgba(110, 231, 183, 0.55), transparent 22%),
			conic-gradient(
				from 250deg,
				rgba(5, 150, 105, 0.05),
				rgba(52, 211, 153, 0.5),
				rgba(6, 95, 70, 0.12),
				rgba(5, 150, 105, 0.05)
			);
		opacity: 0.76;
		animation-name: fluid-drift-reverse;
		animation-duration: 23s;
	}

	.fluid-layer-three {
		inset: 30% 23% 18% 10%;
		border-radius: 35% 65% 55% 45% / 58% 44% 56% 42%;
		background: radial-gradient(
			circle at 44% 46%,
			rgba(209, 250, 229, 0.68),
			rgba(16, 185, 129, 0.1) 42%,
			transparent 70%
		);
		opacity: 0.58;
		animation-duration: 13s;
	}

	.fluid-field.degraded .fluid-layer {
		background:
			radial-gradient(circle at 28% 30%, rgba(254, 243, 199, 0.72), transparent 25%),
			conic-gradient(
				from 120deg,
				rgba(245, 158, 11, 0.56),
				rgba(120, 53, 15, 0.08),
				rgba(251, 191, 36, 0.38),
				rgba(245, 158, 11, 0.56)
			);
	}

	.fluid-field.outage .fluid-layer {
		background:
			radial-gradient(circle at 28% 30%, rgba(255, 228, 230, 0.7), transparent 25%),
			conic-gradient(
				from 120deg,
				rgba(244, 63, 94, 0.54),
				rgba(76, 5, 25, 0.08),
				rgba(251, 113, 133, 0.38),
				rgba(244, 63, 94, 0.54)
			);
	}

	.eyebrow,
	.kicker {
		margin: 0 0 1rem;
		color: #6ee7b7;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.overall-line {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1.25rem;
		color: #c7d0cc;
		font-size: 0.88rem;
		font-weight: 650;
	}

	.pulse,
	.service-dot {
		border-radius: 50%;
		background: #34d399;
		box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.11);
	}

	.pulse {
		width: 10px;
		height: 10px;
		border-radius: 41% 59% 63% 37% / 55% 39% 61% 45%;
		background: linear-gradient(135deg, #a7f3d0, #10b981);
		transform: translateZ(0);
		will-change: transform;
		animation: fluid-indicator 4.8s linear infinite;
	}

	.pulse.degraded,
	.state-degraded {
		background: #fbbf24;
		box-shadow: 0 0 0 5px rgba(251, 191, 36, 0.11);
	}

	.pulse.outage,
	.state-outage {
		background: #fb7185;
		box-shadow: 0 0 0 5px rgba(251, 113, 133, 0.11);
	}

	.state-unknown {
		background: #71717a;
		box-shadow: 0 0 0 5px rgba(113, 113, 122, 0.12);
	}

	h1 {
		max-width: 760px;
		margin: 0;
		font-size: clamp(2.7rem, 7vw, 5.8rem);
		font-weight: 730;
		letter-spacing: -0.065em;
		line-height: 0.96;
	}

	.hero-detail {
		max-width: 620px;
		margin: 1.5rem 0 0;
		color: #9aa39f;
		font-size: clamp(1rem, 2vw, 1.16rem);
		line-height: 1.65;
	}

	.checked {
		margin: 1.6rem 0 0;
		color: #929b97;
		font: 0.75rem/1.4 var(--font-mono);
	}

	.checked time {
		color: #aab3af;
	}

	.uptime-card {
		padding: 1.5rem;
		background: rgba(13, 16, 15, 0.86);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 18px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
	}

	.metric-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: #aab3af;
		font-size: 0.78rem;
	}

	.source-badge {
		color: #6ee7b7;
	}

	.uptime-card > strong {
		display: block;
		margin: 0.75rem 0 1.4rem;
		font: 650 clamp(2.5rem, 6vw, 4.2rem)/1 var(--font-mono);
		letter-spacing: -0.08em;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	.metric-grid div {
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.metric-grid span,
	.metric-grid b {
		display: block;
	}

	.metric-grid span {
		color: #929b97;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.metric-grid b {
		margin-top: 0.35rem;
		font: 600 0.84rem/1 var(--font-mono);
	}

	.monitor-note {
		margin: 1.25rem 0 0;
		color: #717a76;
		font-size: 0.72rem;
		line-height: 1.5;
	}

	.services-section,
	.release-section {
		padding: clamp(3.5rem, 8vw, 6rem) 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.section-heading h2 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.2rem);
		letter-spacing: -0.05em;
	}

	.section-heading > p {
		max-width: 420px;
		margin: 0;
		color: #737c78;
		font-size: 0.86rem;
		line-height: 1.55;
		text-align: right;
	}

	.service-list {
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 18px;
		overflow: hidden;
	}

	.service-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.25rem 1.4rem;
		background: rgba(11, 13, 12, 0.72);
	}

	.service-row + .service-row {
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	.service-identity {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.service-dot {
		width: 7px;
		height: 7px;
		flex: none;
	}

	.service-row h3,
	.service-row p {
		margin: 0;
	}

	.service-row h3 {
		font-size: 0.95rem;
		font-weight: 650;
	}

	.service-row p {
		margin-top: 0.25rem;
		color: #6f7773;
		font-size: 0.76rem;
	}

	.service-result {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		color: #6f7773;
		font: 0.73rem/1 var(--font-mono);
	}

	.service-result strong {
		min-width: 88px;
		color: #6ee7b7;
		font: 650 0.75rem/1 var(--font-sans);
		text-align: right;
	}

	.service-result strong.state-degraded {
		color: #fbbf24;
		background: none;
		box-shadow: none;
	}

	.service-result strong.state-outage {
		color: #fb7185;
		background: none;
		box-shadow: none;
	}

	.availability-code {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.repository-link {
		padding-bottom: 0.2rem;
		border-bottom: 1px solid rgba(110, 231, 183, 0.35);
		color: #a7f3d0;
	}

	.release-list {
		display: grid;
		gap: 1rem;
	}

	.release-card {
		background: rgba(10, 12, 11, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 18px;
		overflow: hidden;
	}

	.release-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.35rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.release-card-header > div {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}

	.release-index,
	.release-date {
		color: #929b97;
		font: 0.7rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.release-card h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
	}

	.release-sections {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.change-group {
		padding: 1.4rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.change-group:nth-child(odd) {
		border-right: 1px solid rgba(255, 255, 255, 0.06);
	}

	.change-group h4 {
		margin: 0 0 0.9rem;
		color: #a7f3d0;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.change-group.tone-major h4 {
		color: #f5f5f4;
	}

	.change-group.tone-security h4 {
		color: #93c5fd;
	}

	.change-group.tone-fixed h4 {
		color: #86efac;
	}

	.change-group.tone-known h4 {
		color: #fcd34d;
	}

	.change-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.change-group li {
		position: relative;
		padding-left: 1rem;
		color: #a4aca8;
		font-size: 0.82rem;
		line-height: 1.58;
	}

	.change-group li + li {
		margin-top: 0.7rem;
	}

	.change-group li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.62em;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #4b5563;
	}

	footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0 2.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		color: #929b97;
		font-size: 0.72rem;
	}

	@keyframes fluid-drift {
		0% {
			transform: translate3d(-3%, -2%, 0) rotate(0deg) scale(0.94, 1.04);
		}
		25% {
			transform: translate3d(5%, -4%, 0) rotate(90deg) scale(1.06, 0.96);
		}
		50% {
			transform: translate3d(4%, 5%, 0) rotate(180deg) scale(0.98, 1.07);
		}
		75% {
			transform: translate3d(-5%, 4%, 0) rotate(270deg) scale(1.05, 0.95);
		}
		100% {
			transform: translate3d(-3%, -2%, 0) rotate(360deg) scale(0.94, 1.04);
		}
	}

	@keyframes fluid-drift-reverse {
		0% {
			transform: translate3d(4%, 3%, 0) rotate(360deg) scale(1.04, 0.95);
		}
		33% {
			transform: translate3d(-5%, 1%, 0) rotate(240deg) scale(0.94, 1.08);
		}
		66% {
			transform: translate3d(1%, -5%, 0) rotate(120deg) scale(1.08, 0.97);
		}
		100% {
			transform: translate3d(4%, 3%, 0) rotate(0deg) scale(1.04, 0.95);
		}
	}

	@keyframes fluid-indicator {
		0% {
			transform: translateZ(0) rotate(0deg) scale(0.92, 1.08);
		}
		50% {
			transform: translateZ(0) rotate(180deg) scale(1.1, 0.9);
		}
		100% {
			transform: translateZ(0) rotate(360deg) scale(0.92, 1.08);
		}
	}

	@media (max-width: 800px) {
		nav a:not(.return-link) {
			display: none;
		}

		.hero {
			grid-template-columns: 1fr;
		}

		.fluid-field {
			top: 1.25rem;
			right: -7rem;
			opacity: 0.48;
		}

		.uptime-card {
			max-width: none;
		}

		.section-heading {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.75rem;
		}

		.section-heading > p {
			text-align: left;
		}

		.release-sections {
			grid-template-columns: 1fr;
		}

		.change-group:nth-child(odd) {
			border-right: 0;
		}
	}

	@media (max-width: 520px) {
		.site-header,
		main,
		footer {
			width: min(100% - 1.25rem, 1180px);
		}

		.brand span:last-child {
			display: none;
		}

		.hero {
			padding-top: 3.5rem;
		}

		.metric-grid {
			gap: 0.35rem;
		}

		.service-row,
		.release-card-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.service-result {
			width: 100%;
			justify-content: space-between;
			padding-left: 1.45rem;
		}

		.service-result strong {
			text-align: right;
		}

		.release-date {
			padding-left: 2.25rem;
		}

		footer {
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}

		.fluid-layer,
		.pulse {
			animation: none;
		}
	}
</style>
