<script lang="ts">
	let { data, form } = $props();

	const invitationUrl = $derived(
		form && 'invitationUrl' in form && typeof form.invitationUrl === 'string'
			? form.invitationUrl
			: null
	);
	const message = $derived(
		form && 'message' in form && typeof form.message === 'string' ? form.message : null
	);
	const errorMessage = $derived(
		form && 'error' in form && typeof form.error === 'string' ? form.error : null
	);

	function formatDate(value: string | Date) {
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Access Control | Alan Database</title>
	<meta name="description" content="Owner-only role, invitation, and account access management." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="access-shell">
	<header class="access-header">
		<div>
			<a class="back-link" href="/admin">← Admin console</a>
			<p class="eyebrow">Security / persistent authorization</p>
			<h1>Access control</h1>
			<p class="lede">
				Roles and invitations are stored server-side. Invitation tokens are hashed and shown only
				once.
			</p>
		</div>
		<span class="owner-badge">Owner only</span>
	</header>

	{#if errorMessage}
		<div class="notice error" role="alert">{errorMessage}</div>
	{:else if message}
		<div class="notice success" role="status">{message}</div>
	{/if}

	{#if invitationUrl}
		<section class="one-time-link" aria-labelledby="invite-link-title">
			<div>
				<p class="section-kicker">One-time result</p>
				<h2 id="invite-link-title">Copy the invitation link now</h2>
				<p>The raw token is not retained and cannot be displayed again.</p>
			</div>
			<input aria-label="New invitation link" readonly value={invitationUrl} />
		</section>
	{/if}

	<section class="panel" aria-labelledby="new-invite-title">
		<div class="panel-heading">
			<div>
				<p class="section-kicker">Invite lifecycle</p>
				<h2 id="new-invite-title">Invite a trusted account</h2>
			</div>
			<p>Links expire after seven days. Creating a newer link revokes older pending links.</p>
		</div>

		<form method="POST" action="?/createInvitation" class="invite-form">
			<div class="field">
				<label for="invite-email">Email</label>
				<input
					id="invite-email"
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="off"
				/>
			</div>
			<div class="field">
				<label for="invite-role">Role</label>
				<select id="invite-role" name="role" required>
					<option value="member">Member — personal data only</option>
					<option value="admin">Admin — personal data and catalogue</option>
				</select>
			</div>
			<button class="primary-button" type="submit">Create invitation</button>
		</form>
	</section>

	<section class="panel" aria-labelledby="accounts-title">
		<div class="panel-heading">
			<div>
				<p class="section-kicker">Persistent roles</p>
				<h2 id="accounts-title">Accounts</h2>
			</div>
			<p>{data.users.length} account{data.users.length === 1 ? '' : 's'}</p>
		</div>

		<div class="account-list">
			{#each data.users as account (account.id)}
				<article class:disabled={Boolean(account.disabledAt)} class="account-card">
					<div class="account-identity">
						<div class="account-title">
							<h3>{account.displayName || account.username}</h3>
							<span class="role-pill">{account.role}</span>
							{#if account.disabledAt}<span class="state-pill">Disabled</span>{/if}
						</div>
						<p>{account.email}</p>
						<small>Created {formatDate(account.createdAt)}</small>
					</div>

					{#if account.id !== data.currentUserId && account.role !== 'owner'}
						<div class="account-actions">
							<form method="POST" action="?/updateRole" class="inline-form">
								<input type="hidden" name="userId" value={account.id} />
								<label class="sr-only" for="role-{account.id}">Role for {account.email}</label>
								<select id="role-{account.id}" name="role" value={account.role}>
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</select>
								<button type="submit">Update role</button>
							</form>

							<form method="POST" action="?/setAccountState">
								<input type="hidden" name="userId" value={account.id} />
								<input
									type="hidden"
									name="disabled"
									value={account.disabledAt ? 'false' : 'true'}
								/>
								<button class="secondary-button" type="submit">
									{account.disabledAt ? 'Enable account' : 'Disable & revoke sessions'}
								</button>
							</form>
						</div>
					{:else}
						<p class="protected-copy">
							{account.id === data.currentUserId
								? 'Current owner account'
								: 'Owner role is protected'}
						</p>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section class="panel" aria-labelledby="invitations-title">
		<div class="panel-heading">
			<div>
				<p class="section-kicker">Audit surface</p>
				<h2 id="invitations-title">Recent invitations</h2>
			</div>
		</div>

		{#if data.invitations.length === 0}
			<p class="empty-copy">No invitations have been created.</p>
		{:else}
			<div class="invitation-list">
				{#each data.invitations as invitation (invitation.id)}
					<article class="invitation-row">
						<div>
							<strong>{invitation.email}</strong>
							<p>{invitation.role} · expires {formatDate(invitation.expiresAt)}</p>
						</div>
						<div class="invitation-state">
							<span class="state-pill">{invitation.state}</span>
							{#if invitation.state === 'pending'}
								<form method="POST" action="?/revokeInvitation">
									<input type="hidden" name="inviteId" value={invitation.id} />
									<button class="text-button" type="submit">Revoke</button>
								</form>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>

<style>
	.access-shell {
		width: min(100% - 2rem, 1120px);
		margin-inline: auto;
		padding-block: clamp(2rem, 6vw, 5rem);
		color: var(--text-primary, #f4f4f5);
	}

	.access-header,
	.panel-heading,
	.account-card,
	.invitation-row,
	.invitation-state,
	.account-title,
	.account-actions,
	.inline-form {
		display: flex;
		align-items: center;
	}

	.access-header {
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
	}

	.back-link,
	.panel-heading p,
	.lede,
	.account-identity p,
	.account-identity small,
	.invitation-row p,
	.empty-copy,
	.protected-copy {
		color: var(--text-secondary, #a1a1aa);
	}

	.back-link {
		font-size: 0.86rem;
		text-decoration: none;
	}

	.eyebrow,
	.section-kicker {
		margin: 1.6rem 0 0.45rem;
		color: var(--accent-primary, #34d399);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 5rem);
		line-height: 0.96;
		letter-spacing: -0.055em;
	}

	h2,
	h3,
	p {
		margin-top: 0;
	}

	.lede {
		max-width: 680px;
		margin: 1rem 0 0;
		line-height: 1.6;
	}

	.owner-badge,
	.role-pill,
	.state-pill {
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: capitalize;
	}

	.notice,
	.one-time-link,
	.panel {
		margin-top: 1.25rem;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-lg, 1rem);
		background: var(--bg-surface-1, #111318);
	}

	.notice {
		padding: 0.9rem 1rem;
	}

	.notice.error {
		border-color: rgba(248, 113, 113, 0.4);
		color: #fca5a5;
	}

	.notice.success,
	.one-time-link {
		border-color: rgba(52, 211, 153, 0.35);
	}

	.one-time-link,
	.panel {
		padding: clamp(1rem, 3vw, 1.5rem);
	}

	.one-time-link input {
		width: 100%;
		margin-top: 1rem;
	}

	.panel-heading {
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.25rem;
	}

	.panel-heading .section-kicker {
		margin-top: 0;
	}

	.panel-heading p {
		max-width: 460px;
		margin-bottom: 0;
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.invite-form {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.75rem;
	}

	.field {
		display: grid;
		gap: 0.4rem;
	}

	.field label {
		font-size: 0.78rem;
		font-weight: 700;
	}

	input,
	select,
	button {
		min-height: 44px;
		border-radius: var(--radius-md, 0.7rem);
		font: inherit;
	}

	input,
	select {
		min-width: 0;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
		background: var(--bg-surface-2, #171a20);
		color: inherit;
		padding: 0.7rem 0.8rem;
	}

	button {
		border: 0;
		padding: 0.65rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
	}

	.primary-button {
		background: var(--accent-primary, #34d399);
		color: #04110c;
	}

	.secondary-button,
	.inline-form button {
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
		background: transparent;
		color: inherit;
	}

	.text-button {
		min-height: 36px;
		background: transparent;
		color: #fca5a5;
	}

	.account-list,
	.invitation-list {
		display: grid;
		gap: 0.75rem;
	}

	.account-card,
	.invitation-row {
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		border-radius: var(--radius-md, 0.75rem);
		background: var(--bg-surface-2, #171a20);
	}

	.account-card.disabled {
		opacity: 0.68;
	}

	.account-title,
	.account-actions,
	.inline-form,
	.invitation-state {
		gap: 0.55rem;
	}

	.account-title h3,
	.account-identity p,
	.invitation-row p {
		margin-bottom: 0.2rem;
	}

	.account-identity small {
		font-size: 0.72rem;
	}

	.inline-form select {
		width: 110px;
	}

	.sr-only {
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

	@media (max-width: 820px) {
		.invite-form {
			grid-template-columns: 1fr;
		}

		.account-card,
		.panel-heading {
			align-items: stretch;
			flex-direction: column;
		}

		.account-actions {
			align-items: stretch;
			flex-direction: column;
		}

		.inline-form {
			align-items: stretch;
			flex-wrap: wrap;
		}
	}

	@media (max-width: 520px) {
		.access-header,
		.invitation-row {
			align-items: flex-start;
			flex-direction: column;
		}

		.owner-badge {
			align-self: flex-start;
		}
	}
</style>
