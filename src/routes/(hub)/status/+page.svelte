<script lang="ts">
	import Logo from '$lib/components/ui/logo/logo.svelte';
	import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';

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

	// Long release sections show their first notes; the rest unfold on demand.
	const NOTES_SHOWN = 4;

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
	<title>Status | Alan's Database</title>
	<meta
		name="description"
		content="Live service health, uptime, incidents, and Alan's Database release notes."
	/>
	<link rel="canonical" href="https://status.alandatabase.com/" />
	<meta property="og:title" content="Status | Alan's Database" />
	<meta property="og:description" content="Live service health, uptime, and release notes." />
	<meta property="og:url" content="https://status.alandatabase.com/" />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="status-shell">
	<header class="site-header">
		<a class="brand" href="/movies" aria-label="Alan's Database, open the cinema">
			<Logo size={28} />
			<span class="word" aria-hidden="true">ALAN<span class="accent">DB</span></span>
		</a>
		<nav aria-label="Status navigation">
			<a href="#services">Services</a>
			<a href="#release-notes">Release notes</a>
			<a class="return-link" href="/movies">Open Cinema</a>
		</nav>
	</header>

	<div class="status-main">
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
				<p class="eyebrow">System status</p>
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
				{#if uptime.configured}
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
				{:else}
					<p class="live-only">Live probes only</p>
				{/if}
				<p class="monitor-note">
					{#if uptime.configured && uptime.state !== 'unknown'}
						External monitor {uptime.monitorId} · {uptime.monitorName}
					{:else if uptime.configured}
						External monitor configured; its latest sample is temporarily unavailable.
					{:else}
						Each visit checks the services directly; no historical uptime is recorded yet.
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
				<p>Live database probe plus this page's server timing.</p>
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
					href="https://github.com/TheoPerson/alandatabase.com/blob/main/CHANGELOG.md"
					rel="noreferrer"
				>
					View source changelog
				</a>
			</div>

			<div class="release-list">
				{#snippet releaseBody(release: (typeof data.releases)[number])}
					<div class="release-sections">
						{#each release.sections as section (section.title)}
							<section class="change-group tone-{sectionTone(section.title)}">
								<h4>{section.title}</h4>
								<ul>
									{#each section.items.slice(0, NOTES_SHOWN) as item (item)}
										<li>{item}</li>
									{/each}
								</ul>
								{#if section.items.length > NOTES_SHOWN}
									<details class="more-notes">
										<summary>
											Show {section.items.length - NOTES_SHOWN} more
											<ChevronDownIcon size={16} aria-hidden="true" />
										</summary>
										<ul>
											{#each section.items.slice(NOTES_SHOWN) as item (item)}
												<li>{item}</li>
											{/each}
										</ul>
									</details>
								{/if}
							</section>
						{/each}
					</div>
				{/snippet}
				{#each data.releases as release, index (release.version)}
					{#if index === 0}
						<article class="release-card">
							<header class="release-card-header">
								<div>
									<span class="release-index">{String(index + 1).padStart(2, '0')}</span>
									<h3>
										{release.version === 'Unreleased'
											? 'Current patch'
											: `Version ${release.version}`}
									</h3>
								</div>
								<span class="release-date">{release.date ?? 'In progress'}</span>
							</header>
							{@render releaseBody(release)}
						</article>
					{:else}
						<details class="release-card older">
							<summary class="release-card-header">
								<div>
									<span class="release-index">{String(index + 1).padStart(2, '0')}</span>
									<h3>
										{release.version === 'Unreleased'
											? 'Current patch'
											: `Version ${release.version}`}
									</h3>
								</div>
								<span class="release-meta">
									<span class="release-date">{release.date ?? 'In progress'}</span>
									<ChevronDownIcon size={18} aria-hidden="true" />
								</span>
							</summary>
							{@render releaseBody(release)}
						</details>
					{/if}
				{/each}
			</div>
		</section>
	</div>

	<footer>
		<span>Alan's Database</span>
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
			radial-gradient(circle at 78% 5%, var(--brand-muted), transparent 28rem),
			var(--surface-canvas);
		color: var(--content-primary);
	}

	.site-header,
	.status-main,
	footer {
		width: min(1180px, calc(100% - 2 * var(--page-gutter)));
		margin-inline: auto;
	}

	.site-header {
		min-height: 74px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	/* Same lockup as the cinema top bar, with a 44px target. */
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		color: var(--content-primary);
		font-weight: 900;
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.accent {
		color: var(--brand-primary);
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	nav a,
	.repository-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		text-decoration: none;
	}

	nav a:hover,
	nav a:focus-visible,
	.repository-link:hover,
	.repository-link:focus-visible {
		color: var(--brand-hover);
	}

	.return-link {
		padding: 0 var(--space-4);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
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
			radial-gradient(
				circle at 28% 30%,
				color-mix(in srgb, var(--brand-hover) 72%, transparent),
				transparent 25%
			),
			conic-gradient(
				from 120deg,
				color-mix(in srgb, var(--brand-active) 58%, transparent),
				color-mix(in srgb, var(--brand-active) 8%, transparent),
				color-mix(in srgb, var(--brand-primary) 42%, transparent),
				color-mix(in srgb, var(--brand-active) 58%, transparent)
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
			radial-gradient(
				circle at 68% 34%,
				color-mix(in srgb, var(--brand-hover) 55%, transparent),
				transparent 22%
			),
			conic-gradient(
				from 250deg,
				color-mix(in srgb, var(--brand-active) 5%, transparent),
				color-mix(in srgb, var(--brand-primary) 50%, transparent),
				color-mix(in srgb, var(--brand-active) 12%, transparent),
				color-mix(in srgb, var(--brand-active) 5%, transparent)
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
			color-mix(in srgb, var(--brand-hover) 68%, transparent),
			color-mix(in srgb, var(--brand-active) 10%, transparent) 42%,
			transparent 70%
		);
		opacity: 0.58;
		animation-duration: 13s;
	}

	.fluid-field.degraded .fluid-layer {
		background:
			radial-gradient(
				circle at 28% 30%,
				color-mix(in srgb, var(--color-warning) 72%, transparent),
				transparent 25%
			),
			conic-gradient(
				from 120deg,
				color-mix(in srgb, var(--color-warning) 56%, transparent),
				color-mix(in srgb, var(--color-warning) 8%, transparent),
				color-mix(in srgb, var(--color-warning) 38%, transparent),
				color-mix(in srgb, var(--color-warning) 56%, transparent)
			);
	}

	.fluid-field.outage .fluid-layer {
		background:
			radial-gradient(
				circle at 28% 30%,
				color-mix(in srgb, var(--color-error) 70%, transparent),
				transparent 25%
			),
			conic-gradient(
				from 120deg,
				color-mix(in srgb, var(--color-error) 54%, transparent),
				color-mix(in srgb, var(--color-error) 8%, transparent),
				color-mix(in srgb, var(--color-error) 38%, transparent),
				color-mix(in srgb, var(--color-error) 54%, transparent)
			);
	}

	.eyebrow,
	.kicker {
		margin: 0 0 1rem;
		color: var(--brand-hover);
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
		color: var(--content-secondary);
		font-size: 0.88rem;
		font-weight: 650;
	}

	.pulse,
	.service-dot {
		border-radius: 50%;
		background: var(--brand-primary);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--brand-primary) 11%, transparent);
	}

	.pulse {
		width: 10px;
		height: 10px;
		border-radius: 41% 59% 63% 37% / 55% 39% 61% 45%;
		background: linear-gradient(135deg, var(--brand-hover), var(--brand-active));
		transform: translateZ(0);
		will-change: transform;
		animation: fluid-indicator 4.8s linear infinite;
	}

	.pulse.degraded,
	.state-degraded {
		background: var(--color-warning);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-warning) 11%, transparent);
	}

	.pulse.outage,
	.state-outage {
		background: var(--color-error);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-error) 11%, transparent);
	}

	.state-unknown {
		background: var(--content-tertiary);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--content-tertiary) 12%, transparent);
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
		color: var(--content-secondary);
		font-size: clamp(1rem, 2vw, 1.16rem);
		line-height: 1.65;
	}

	.checked {
		margin: 1.6rem 0 0;
		color: var(--content-secondary);
		font: 0.75rem/1.4 var(--font-mono);
	}

	.checked time {
		color: var(--content-secondary);
	}

	.uptime-card {
		padding: 1.5rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: 18px;
		box-shadow: var(--shadow-md);
	}

	.metric-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--content-secondary);
		font-size: 0.78rem;
	}

	.source-badge {
		color: var(--brand-hover);
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
		border-top: 1px solid var(--border-subtle);
	}

	.metric-grid span,
	.metric-grid b {
		display: block;
	}

	.metric-grid span {
		color: var(--content-secondary);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.metric-grid b {
		margin-top: 0.35rem;
		font: 600 0.84rem/1 var(--font-mono);
	}

	.live-only {
		margin: 0.75rem 0 0;
		font-size: var(--type-title);
		font-weight: 700;
	}

	.monitor-note {
		margin: 1.25rem 0 0;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.services-section,
	.release-section {
		padding: clamp(3.5rem, 8vw, 6rem) 0;
		border-top: 1px solid var(--border-subtle);
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
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.55;
		text-align: right;
	}

	.service-list {
		border: 1px solid var(--border-subtle);
		border-radius: 18px;
		overflow: hidden;
	}

	.service-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.25rem 1.4rem;
		background: var(--surface-raised);
	}

	.service-row + .service-row {
		border-top: 1px solid var(--border-subtle);
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
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}

	.service-result {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		color: var(--content-secondary);
		font: var(--text-sm) / 1 var(--font-mono);
	}

	.service-result strong {
		min-width: 88px;
		color: var(--brand-hover);
		font: 650 var(--text-sm) / 1 var(--font-sans);
		text-align: right;
	}

	.service-result strong.state-degraded {
		color: var(--color-warning);
		background: none;
		box-shadow: none;
	}

	.service-result strong.state-outage {
		color: var(--color-error);
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
		border-bottom: 1px solid color-mix(in srgb, var(--brand-hover) 35%, transparent);
		color: var(--brand-hover);
	}

	.release-list {
		display: grid;
		gap: 1rem;
	}

	.release-card {
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: 18px;
		overflow: hidden;
	}

	.release-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.35rem 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.release-card-header > div {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}

	.release-index,
	.release-date {
		color: var(--content-secondary);
		font: 0.7rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.more-notes summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--touch-target);
		margin-top: var(--space-2);
		color: var(--brand-primary);
		font-size: var(--text-sm);
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}

	.more-notes summary::-webkit-details-marker {
		display: none;
	}

	.more-notes[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.more-notes ul {
		margin-top: var(--space-2);
	}

	details.release-card > summary {
		cursor: pointer;
		list-style: none;
		min-height: var(--touch-target);
	}

	details.release-card > summary::-webkit-details-marker {
		display: none;
	}

	details.release-card:not([open]) > summary {
		border-bottom: 0;
	}

	details.release-card > summary:hover h3 {
		color: var(--brand-hover);
	}

	.release-meta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--content-secondary);
	}

	.release-meta :global(svg) {
		transition: transform var(--duration-base) var(--ease-standard);
	}

	details[open] .release-meta :global(svg) {
		transform: rotate(180deg);
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
		border-bottom: 1px solid var(--border-subtle);
	}

	.change-group:nth-child(odd) {
		border-right: 1px solid var(--border-subtle);
	}

	.change-group h4 {
		margin: 0 0 0.9rem;
		color: var(--brand-hover);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.change-group.tone-major h4 {
		color: var(--content-primary);
	}

	.change-group.tone-security h4 {
		color: var(--color-info);
	}

	.change-group.tone-fixed h4 {
		color: var(--brand-primary);
	}

	.change-group.tone-known h4 {
		color: var(--color-warning);
	}

	.change-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.change-group li {
		position: relative;
		padding-left: 1rem;
		color: var(--content-secondary);
		font-size: var(--text-sm);
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
		background: var(--content-tertiary);
	}

	footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0 2.5rem;
		border-top: 1px solid var(--border-subtle);
		color: var(--content-secondary);
		font-size: var(--text-sm);
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

		.release-date,
		.release-meta {
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

		.release-meta :global(svg) {
			transition: none;
		}
	}
</style>
