<script lang="ts">
	import { enhance } from '$app/forms';
	import { signInReason } from '$lib/components/auth/sign-in-reason';
	import Button from '$lib/components/ui/button';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import FormField from '$lib/components/auth/FormField.svelte';
	import { AUTH_ERROR_ID, withReturnTo } from '$lib/components/auth/auth-form';

	const { data, form } = $props();

	const actionUrl = $derived(withReturnTo('?/login', data.returnTo));
	const registerHref = $derived(withReturnTo('/auth/register', data.returnTo));
	const errorRef = $derived(form?.error ? AUTH_ERROR_ID : undefined);
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Private Sign In | Alan Database</title>
	<meta name="description" content="Secure private access for Alan Database." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthShell
	eyebrow="Private access"
	title="Sign in"
	description={signInReason(data.returnTo) ??
		'Your personal cinema data and the tools your role allows.'}
	error={form?.error}
	errorKey={form}
>
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
		<FormField
			id="identifier"
			name="identifier"
			label="Username or email"
			autocomplete="username"
			autocapitalize="none"
			autocorrect="off"
			spellcheck={false}
			maxlength={254}
			describedBy={errorRef}
		/>
		<FormField
			id="password"
			name="password"
			type="password"
			label="Password"
			autocomplete="current-password"
			maxlength={128}
			describedBy={errorRef}
		/>

		<Button type="submit" size="lg" class="submit" loading={submitting}>
			{submitting ? 'Signing in' : 'Sign in'}
		</Button>
		<p class="sr-only" role="status">{submitting ? 'Signing in, please wait.' : ''}</p>
	</form>

	{#snippet footer()}
		{#if data.allowSetup}
			<p>
				First run on this server?
				<a href={registerHref}>Set up the owner account</a>
			</p>
		{:else}
			<p>
				Accounts are by invitation only.
				<a href={registerHref}>About invitations</a>
			</p>
		{/if}
	{/snippet}
</AuthShell>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
	.form :global(.submit) {
		width: 100%;
		margin-top: var(--space-1);
	}
</style>
