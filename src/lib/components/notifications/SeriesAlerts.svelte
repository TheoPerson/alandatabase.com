<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bell, BellOff, Check } from 'lucide-svelte';
	import { addToast } from '$lib/stores/toast';
	let {
		subscription,
		signedIn,
		canManage,
		message
	}: {
		subscription?: { enabled: boolean; offsetDays: number; timezone: string } | null;
		signedIn: boolean;
		canManage: boolean;
		message?: string;
	} = $props();
	let busy = $state(false);
	let feedback = $state('');
	const enabled = $derived(subscription?.enabled ?? false);
	const enhanceSave = () => {
		busy = true;
		feedback = '';
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			try {
				await update();
				feedback =
					result.type === 'success'
						? 'Episode notification preferences saved.'
						: String(
								result.data?.error ??
									result.data?.message ??
									'Could not save preferences. Please try again.'
							);
				addToast(feedback, result.type === 'success' ? 'success' : 'error');
			} finally {
				busy = false;
			}
		};
	};
</script>

<section class="series-alerts" aria-labelledby="episode-alert-heading">
	<div class="heading">
		<Bell size={20} aria-hidden="true" />
		<h2 id="episode-alert-heading">Episode notifications</h2>
	</div>
	{#if signedIn && canManage}
		{#if enabled}<p class="monitoring">
				<Check size={16} aria-hidden="true" /> Monitoring future episodes
			</p>{/if}
		<form method="POST" action="?/subscribeEpisodes" use:enhance={enhanceSave}>
			<div class="fields">
				<label
					>Notify me<select name="offsetDays" value={subscription?.offsetDays ?? 0} disabled={busy}
						><option value="0">On release day</option><option value="1">One day before</option
						><option value="7">Seven days before</option></select
					></label
				>
				<label
					>Timezone<input
						name="timezone"
						value={subscription?.timezone ?? 'Europe/Paris'}
						required
						maxlength="64"
						list="episode-timezones"
						disabled={busy}
					/></label
				>
			</div>
			<datalist id="episode-timezones"
				><option value="Europe/Paris"></option><option value="Europe/London"></option><option
					value="America/New_York"
				></option><option value="America/Los_Angeles"></option><option value="Asia/Tokyo"
				></option><option value="Australia/Sydney"></option><option value="UTC"></option></datalist
			>
			<button class="primary" disabled={busy}
				><Bell size={17} aria-hidden="true" />{busy
					? 'Saving...'
					: enabled
						? 'Save preferences'
						: 'Notify me about new episodes'}</button
			>
		</form>
		<div class="links">
			{#if enabled}<form method="POST" action="?/unsubscribeEpisodes" use:enhance={enhanceSave}>
					<button disabled={busy}><BellOff size={16} aria-hidden="true" />Stop notifications</button
					>
				</form>{/if}
			<a href="/my/alerts">Manage alerts</a>
		</div>
	{:else if signedIn}
		<p class="restricted">Episode notifications are available to the owner account.</p>
	{:else}
		<a class="sign-in" href="/auth/login">Sign in to follow new episodes</a>
	{/if}
	<p class="feedback" role="status">{feedback || message || ''}</p>
</section>

<style>
	.series-alerts {
		padding: 1.25rem 0;
		margin: 0 0 1.5rem;
		border-block: 1px solid var(--border-subtle);
	}
	.heading,
	.monitoring,
	.links,
	button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
	}
	.monitoring {
		color: #6ee7b7;
		font-size: 0.875rem;
		margin: 0.75rem 0;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}
	label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}
	input,
	select {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 0.6rem;
		color: var(--text-primary);
		background: var(--bg-surface-2, #15171c);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
	}
	button,
	.sign-in {
		min-height: 44px;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		font-size: 0.875rem;
		text-align: left;
	}
	.primary {
		background: #10b981;
		color: #031b13;
		font-weight: 700;
	}
	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.links {
		flex-wrap: wrap;
		justify-content: space-between;
		margin-top: 0.75rem;
	}
	a {
		color: #6ee7b7;
		font-size: 0.875rem;
	}
	:focus-visible {
		outline: 2px solid #6ee7b7;
		outline-offset: 3px;
	}
	.feedback {
		font-size: 0.875rem;
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}
	@media (max-width: 480px) {
		.fields {
			grid-template-columns: 1fr;
		}
	}
</style>
