<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import FormField from '$lib/components/auth/FormField.svelte';
	import { AUTH_ERROR_ID, withReturnTo } from '$lib/components/auth/auth-form';

	const { data, form } = $props();

	// The invite stays in the action URL so a failed no-JavaScript submit reloads this invitation.
	const actionUrl = $derived(
		withReturnTo('?/register', data.returnTo, { invite: data.invitationToken })
	);
	const loginHref = $derived(withReturnTo('/auth/login', data.returnTo));
	const errorRef = $derived(form?.error ? AUTH_ERROR_ID : undefined);
	const hadInviteLink = $derived(page.url.searchParams.has('invite'));
	let submitting = $state(false);

	// UTC keeps the server and browser renders identical.
	const expiryFormat = new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC'
	});
	const expiry = $derived(
		data.invitation?.expiresAt
			? `${expiryFormat.format(new Date(data.invitation.expiresAt))} UTC`
			: null
	);

	const copy = $derived(
		data.mode === 'invite'
			? {
					eyebrow: 'Invitation',
					title: 'Accept invitation',
					description: `Choose a username and a password for your ${data.invitation?.role ?? 'member'} account.`,
					headTitle: 'Accept Invitation',
					headDescription: 'Accept a private Alan Database invitation.'
				}
			: data.mode === 'owner'
				? {
						eyebrow: 'First run',
						title: 'Owner setup',
						description:
							'Create the first and only owner account. Setup closes as soon as it exists.',
						headTitle: 'Owner Setup',
						headDescription: 'One-time Alan Database owner setup.'
					}
				: {
						eyebrow: 'Invitation only',
						title: hadInviteLink ? 'Invitation unavailable' : 'Registration is closed',
						description: hadInviteLink
							? 'This invitation link is invalid, expired or already used. Ask the owner for a new one.'
							: 'Accounts are created by invitation only. Open the invitation link you received from the owner.',
						headTitle: 'Invitation Only',
						headDescription: 'Alan Database accounts are by invitation only.'
					}
	);
</script>

<svelte:head>
	<title>{copy.headTitle} | Alan Database</title>
	<meta name="description" content={copy.headDescription} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthShell
	eyebrow={copy.eyebrow}
	title={copy.title}
	description={copy.description}
	error={form?.error}
	errorKey={form}
	footer={data.mode === 'closed' ? undefined : signInFooter}
>
	{#if data.mode === 'owner' || data.mode === 'invite'}
		{#if data.mode === 'invite' && expiry}
			<p class="note">Valid until {expiry}</p>
		{/if}

		<form
			method="POST"
			action={actionUrl}
			class="form"
			aria-busy={submitting ? 'true' : undefined}
			use:enhance={({ cancel }) => {
				if (submitting) return cancel();
				submitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						submitting = false;
					}
				};
			}}
		>
			{#if data.mode === 'invite' && data.invitationToken}
				<input type="hidden" name="invitationToken" value={data.invitationToken} />
			{/if}

			<FormField
				id="email"
				name="email"
				type="email"
				label="Email"
				autocomplete="email"
				value={data.invitation?.email ?? ''}
				readonly={data.mode === 'invite'}
				hint={data.mode === 'invite' ? 'Set by your invitation.' : undefined}
				describedBy={errorRef}
			/>
			<FormField
				id="username"
				name="username"
				label="Username"
				autocomplete="username"
				autocapitalize="none"
				autocorrect="off"
				spellcheck={false}
				minlength={3}
				maxlength={32}
				pattern="[A-Za-z0-9_\-]+"
				hint="3 to 32 characters: letters, numbers, dashes or underscores."
				patternHint="Use only letters, numbers, dashes or underscores."
				describedBy={errorRef}
			/>
			<FormField
				id="password"
				name="password"
				type="password"
				label="Password"
				autocomplete="new-password"
				minlength={12}
				maxlength={128}
				hint="At least 12 characters."
				describedBy={errorRef}
			/>
			{#if data.mode === 'owner'}
				<FormField
					id="setupKey"
					name="setupKey"
					type="password"
					label="Owner setup key"
					autocomplete="off"
					minlength={32}
					missing="Enter the owner setup key."
					hint="The one-time key from the server configuration. It is never stored with the account."
					describedBy={errorRef}
				/>
			{/if}

			<Button type="submit" size="lg" class="submit" loading={submitting}>
				{#if submitting}
					Creating account
				{:else}
					{data.mode === 'invite' ? 'Create account' : 'Create owner account'}
				{/if}
			</Button>
			<p class="sr-only" role="status">
				{submitting ? 'Creating your account, please wait.' : ''}
			</p>
		</form>
	{:else}
		<div class="closed-action">
			<Button href={loginHref} size="lg">Go to sign in</Button>
		</div>
	{/if}
</AuthShell>

{#snippet signInFooter()}
	<p>
		Already have an account?
		<a href={loginHref}>Sign in</a>
	</p>
{/snippet}

<style>
	.note {
		margin-top: var(--space-3);
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.form {
		display: grid;
		gap: var(--space-5);
	}
	.form :global(.submit),
	.closed-action :global(.btn) {
		width: 100%;
	}
	.form :global(.submit) {
		margin-top: var(--space-1);
	}
	.closed-action {
		margin-top: var(--space-5);
	}
</style>
