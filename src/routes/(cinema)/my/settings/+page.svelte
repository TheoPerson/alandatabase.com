<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import BackLink from '$lib/components/lists/back-link.svelte';
	import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';
	import MonitorSmartphoneIcon from 'lucide-svelte/icons/monitor-smartphone';
	import ShieldCheckIcon from 'lucide-svelte/icons/shield-check';
	import { formatSessionDate, groupSessions } from './sessions';

	let { data, form } = $props();

	let isRevoking = $state(false);
	const sessions = $derived(groupSessions(data.activeSessions));
</script>

<svelte:head>
	<title>Settings | Alan's Database</title>
	<meta
		name="description"
		content="Manage Alan's Database account security, sessions, and content preferences."
	/>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="settings">
	<header class="head">
		<BackLink href="/my/films" label="Library" />
		<h1>Settings</h1>
		<p class="summary">Account security, signed-in devices and content preferences.</p>
	</header>

	<div class="column">
		{#if form?.message}
			<p class="notice success" role="status">{form.message}</p>
		{/if}
		{#if form?.error}
			<p class="notice error" role="alert">{form.error}</p>
		{/if}

		<section class="card" aria-labelledby="sessions-heading">
			<div class="card-head">
				<div>
					<h2 id="sessions-heading">Signed-in sessions</h2>
					<p class="card-copy">
						Sessions expire on their own. If one looks unfamiliar, sign out everywhere else.
					</p>
				</div>
				<span class="role">{data.user.role}</span>
			</div>

			<ul class="session-list" aria-label="Active sessions">
				{#if sessions.current}
					<li class="session current">
						<span class="session-icon" aria-hidden="true"><MonitorSmartphoneIcon size={18} /></span>
						<span class="session-text">
							<strong>This device</strong>
							<span>Signed in {formatSessionDate(sessions.current.createdAt)}</span>
						</span>
						<span class="badge">Current</span>
					</li>
				{/if}
				{#each sessions.visible as session (session.createdAt + session.expiresAt)}
					<li class="session">
						<span class="session-dot" aria-hidden="true"></span>
						<span class="session-text">
							<strong>Other session</strong>
							<span>Signed in {formatSessionDate(session.createdAt)}</span>
						</span>
					</li>
				{/each}
			</ul>

			{#if sessions.hidden.length > 0}
				<details class="more">
					<summary>
						Show {sessions.hidden.length} older {sessions.hidden.length === 1
							? 'session'
							: 'sessions'}
						<ChevronDownIcon size={16} aria-hidden="true" />
					</summary>
					<ul class="session-list" aria-label="Older sessions">
						{#each sessions.hidden as session (session.createdAt + session.expiresAt)}
							<li class="session">
								<span class="session-dot" aria-hidden="true"></span>
								<span class="session-text">
									<strong>Other session</strong>
									<span>Signed in {formatSessionDate(session.createdAt)}</span>
								</span>
							</li>
						{/each}
					</ul>
				</details>
			{/if}

			<form
				method="POST"
				action="?/revokeOtherSessions"
				class="card-actions"
				use:enhance={() => {
					isRevoking = true;
					return async ({ update }) => {
						await update();
						isRevoking = false;
					};
				}}
			>
				<p class="count">
					{sessions.otherCount === 0
						? 'No other sessions'
						: `${sessions.otherCount} other session${sessions.otherCount === 1 ? '' : 's'}`}
				</p>
				<Button
					type="submit"
					variant="outline"
					loading={isRevoking}
					disabled={isRevoking || sessions.otherCount === 0}
				>
					{isRevoking ? 'Signing out' : 'Sign out other sessions'}
				</Button>
			</form>
		</section>

		<section class="card" aria-labelledby="content-heading">
			<div class="card-head">
				<div>
					<h2 id="content-heading">Content preferences</h2>
				</div>
			</div>
			<div class="setting">
				<span class="setting-icon" aria-hidden="true"><ShieldCheckIcon size={18} /></span>
				<div>
					<h3>Quarantined content</h3>
					<p class="card-copy">
						Adult, explicit-keyword and custom records stay out of browse, search, artwork and your
						personal pages. A separate private product has not been enabled.
					</p>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	.settings {
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-6) var(--page-gutter) var(--space-8);
	}
	.head {
		margin-bottom: var(--space-6);
	}
	h1 {
		margin-top: var(--space-2);
		font-size: var(--type-headline);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	.summary {
		margin-top: var(--space-2);
		color: var(--content-secondary);
	}
	.column {
		display: grid;
		gap: var(--space-5);
		max-width: var(--container-reading);
	}
	.notice {
		padding: var(--space-3) var(--space-4);
		border: 1px solid currentColor;
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.notice.success {
		color: var(--brand-primary);
	}
	.notice.error {
		color: var(--color-error);
	}
	.card {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-raised);
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	h2 {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	h3 {
		font-size: var(--text-md);
		font-weight: 700;
	}
	.card-copy {
		margin-top: var(--space-1);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: 1.55;
	}
	.role {
		flex: none;
		padding: 0.3rem 0.65rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.session-list {
		display: grid;
		list-style: none;
	}
	.session {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 3.25rem;
		padding-block: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}
	.session:first-child {
		border-top: 0;
	}
	.session-icon,
	.setting-icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	.session-dot {
		flex: none;
		width: 2.25rem;
		height: 0.5rem;
		background: radial-gradient(circle, var(--content-tertiary) 0.25rem, transparent 0.27rem);
	}
	.session-text {
		display: grid;
		flex: 1;
		gap: 0.1rem;
		min-width: 0;
	}
	.session-text strong {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.session-text span {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.badge {
		flex: none;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
	}
	.more summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--touch-target);
		color: var(--brand-primary);
		font-size: var(--text-sm);
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}
	.more summary::-webkit-details-marker {
		display: none;
	}
	.more summary :global(svg) {
		transition: transform var(--duration-base) var(--ease-standard);
	}
	.more[open] summary :global(svg) {
		transform: rotate(180deg);
	}
	.more .session-list {
		max-height: 20rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.card-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
	}
	.count {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.setting {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}
	@media (max-width: 479px) {
		.card {
			padding: var(--space-4);
		}
		.card-actions :global(.btn) {
			width: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.more summary :global(svg) {
			transition: none;
		}
	}
</style>
