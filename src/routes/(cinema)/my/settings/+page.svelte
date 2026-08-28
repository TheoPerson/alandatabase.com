<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';

	let { data, form } = $props();

	let isRevoking = $state(false);
</script>

<svelte:head>
	<title>Settings | Alan Database</title>
	<meta
		name="description"
		content="Manage Alan Database account security, sessions, and content preferences."
	/>
</svelte:head>

<div class="container settings-page">
	<header class="page-header">
		<h1 class="page-title">Settings</h1>
		<p class="subtitle">Manage account security, active sessions, and content preferences.</p>
	</header>

	{#if form?.message}
		<p class="notice success-message" role="status">{form.message}</p>
	{/if}
	{#if form?.error}
		<p class="notice error-message" role="alert">{form.error}</p>
	{/if}

	<section class="settings-section" aria-labelledby="account-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Account</p>
				<h2 id="account-heading">Access and sessions</h2>
			</div>
			<span class="role-badge">{data.user.role}</span>
		</div>

		<div class="session-panel">
			<div class="setting-info">
				<h3>Active sessions</h3>
				<p>
					Sessions expire automatically. If a device is unfamiliar, revoke every other session and
					sign in again on trusted devices.
				</p>
			</div>

			<ul class="session-list" aria-label="Active sessions">
				{#each data.activeSessions as session}
					<li>
						<span class:current-session={session.isCurrent} class="session-dot"></span>
						<div>
							<strong>{session.isCurrent ? 'This session' : 'Other session'}</strong>
							<span>Created {new Date(session.createdAt).toLocaleString()}</span>
						</div>
					</li>
				{/each}
			</ul>

			<form
				method="POST"
				action="?/revokeOtherSessions"
				use:enhance={() => {
					isRevoking = true;
					return async ({ update }) => {
						await update();
						isRevoking = false;
					};
				}}
			>
				<Button type="submit" variant="outline" disabled={isRevoking}>
					{isRevoking ? 'Revoking...' : 'Revoke other sessions'}
				</Button>
			</form>
		</div>
	</section>

	<section class="settings-section" aria-labelledby="content-heading">
		<h2 id="content-heading">Content preferences</h2>

		<div class="settings-form">
			<div class="setting-item content-warning">
				<div class="setting-info">
					<h3>Quarantined content</h3>
					<p>
						Adult, explicit-keyword, and custom records remain unavailable in standard browse,
						search, artwork, and personal surfaces. A separate private product has not been enabled.
					</p>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.settings-page {
		padding-top: 3rem;
		padding-bottom: 5rem;
		max-width: 800px;
		min-height: 70dvh;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.page-title {
		font-size: 2.75rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.settings-section {
		margin-top: 3rem;
	}

	.settings-section h2 {
		font-size: 1.5rem;
		color: #ffffff;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.75rem;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin-bottom: 0.4rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.role-badge {
		margin-bottom: 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		margin-bottom: 1.5rem;
	}

	.setting-item.content-warning {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.session-panel {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}

	.session-list {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.session-list li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 44px;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: calc(var(--radius-lg) * 0.7);
	}

	.session-list li div {
		display: grid;
		gap: 0.15rem;
	}

	.session-list strong {
		font-size: 0.9rem;
	}

	.session-list span:not(.session-dot) {
		color: var(--text-secondary);
		font-size: 0.8rem;
	}

	.session-dot {
		width: 0.55rem;
		height: 0.55rem;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--text-secondary);
	}

	.session-dot.current-session {
		background: #10b981;
		box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
	}

	.setting-info h3 {
		font-size: 1.1rem;
		color: #ffffff;
		margin-bottom: 0.25rem;
	}

	.setting-info p {
		font-size: 0.9rem;
		color: var(--text-secondary);
		max-width: 500px;
		line-height: 1.4;
	}

	.success-message {
		color: #10b981;
		font-size: 0.9rem;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.9rem;
	}

	.notice {
		margin-top: 1rem;
		border: 1px solid currentColor;
		border-radius: var(--radius-lg);
		padding: 0.75rem 1rem;
	}

	@media (max-width: 640px) {
		.settings-page {
			padding-top: 1.5rem;
			padding-bottom: calc(5rem + env(safe-area-inset-bottom));
		}

		.page-header {
			margin-bottom: 2rem;
		}

		.page-title {
			font-size: clamp(2rem, 10vw, 2.5rem);
		}

		.setting-item {
			align-items: flex-start;
			flex-direction: column;
		}

		.session-panel form,
		.session-panel form :global(button) {
			width: 100%;
		}
	}
</style>
