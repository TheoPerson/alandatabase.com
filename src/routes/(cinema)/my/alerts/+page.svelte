<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Bell, ExternalLink, Save } from 'lucide-svelte';
	import PushSettings from '$lib/components/notifications/PushSettings.svelte';
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import { addToast } from '$lib/stores/toast';
	let { data, form } = $props();
	let activeTab = $state<'inbox' | 'series'>('inbox');
	let busy = $state(false);
	const unread = $derived(data.notifications.filter((item) => !item.notification.readAt).length);
	function formatDate(value: string | Date | null) {
		return value
			? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
			: 'Not checked yet';
	}
	const save = () => {
		busy = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			try {
				await update();
				if (result.type === 'success') {
					addToast('Alerts updated.', 'success');
					window.dispatchEvent(new Event('notifications-read'));
				} else
					addToast(
						String(result.data?.error ?? 'Could not update alerts. Please try again.'),
						'error'
					);
			} finally {
				busy = false;
			}
		};
	};
</script>

<svelte:head
	><title>Episode alerts | AlanDB</title><meta name="robots" content="noindex" /></svelte:head
>

<div class="container alerts-page">
	<header class="page-heading">
		<div>
			<h1>Episode alerts</h1>
			<p>
				{data.subscriptions.filter((item) => item.enabled).length} series monitored{unread
					? ` / ${unread} unread`
					: ''}
			</p>
		</div>
		<a href="/tv">Browse series <ExternalLink size={16} aria-hidden="true" /></a>
	</header>
	{#if data.error}<p class="notice error" role="alert">{data.error}</p>{/if}
	{#if form?.error}<p class="notice error" role="alert">{form.error}</p>{/if}
	{#if !data.syncEnabled}<p class="notice">
			Automatic episode checks are currently unavailable. Your saved preferences are retained.
		</p>{/if}
	<PushSettings publicKey={data.pushPublicKey} />
	<nav class="tabs" aria-label="Alerts views">
		<button
			class:active={activeTab === 'inbox'}
			aria-pressed={activeTab === 'inbox'}
			onclick={() => (activeTab = 'inbox')}>Inbox{unread ? ` (${unread})` : ''}</button
		><button
			class:active={activeTab === 'series'}
			aria-pressed={activeTab === 'series'}
			onclick={() => (activeTab = 'series')}>Subscribed series ({data.subscriptions.length})</button
		>
	</nav>
	{#if activeTab === 'inbox'}
		<section aria-label="Notification inbox">
			{#if unread}<form method="POST" action="?/markRead" use:enhance={save} class="inbox-actions">
					<button disabled={busy}><Check size={16} aria-hidden="true" />Mark all read</button>
				</form>{/if}
			{#if data.notifications.length === 0}<div class="empty">
					<Bell size={30} aria-hidden="true" />
					<h2>No episode notifications yet</h2>
					<p>
						{data.subscriptions.length
							? 'New episode alerts will appear here when they are due.'
							: 'No series are being monitored.'}
					</p>
					<a href="/tv">Browse TV shows</a>
				</div>{/if}
			<ul class="inbox">
				{#each data.notifications as { notification, episode } (notification.id)}
					<li class:unread={!notification.readAt}>
						<div class="notification-copy">
							<div class="meta">
								{#if !notification.readAt}<span class="unread-label">Unread</span>{/if}<time
									datetime={new Date(notification.createdAt).toISOString()}
									>{formatDate(notification.createdAt)}</time
								>
							</div>
							<a
								class="notification-title"
								href={`/tv/${episode.tmdbShowId}?season=${episode.seasonNumber}&episode=${episode.episodeNumber}`}
								>{notification.title}</a
							>
							<p>{notification.body}</p>
							<p class="episode">
								Season {episode.seasonNumber}, episode {episode.episodeNumber} / {episode.episodeName}
							</p>
						</div>
						{#if !notification.readAt}<form method="POST" action="?/markRead" use:enhance={save}>
								<input type="hidden" name="notificationId" value={notification.id} /><button
									class="icon-button"
									title="Mark read"
									aria-label={`Mark ${notification.title} read`}
									disabled={busy}><Check size={18} aria-hidden="true" /></button
								>
							</form>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<section aria-label="Subscribed series">
			{#if data.subscriptions.length === 0}<div class="empty">
					<Bell size={30} aria-hidden="true" />
					<h2>No subscribed series</h2>
					<a href="/tv">Browse TV shows</a>
				</div>{/if}
			<ul class="subscriptions">
				{#each data.subscriptions as subscription (subscription.id)}
					<li>
						<div class="series-heading">
							<a
								class="poster"
								href={`/tv/${subscription.tmdbShowId}`}
								tabindex="-1"
								aria-hidden="true"
								><MoviePoster
									path={subscription.posterPath}
									title={subscription.showTitle}
									size="w185"
								/></a
							>
							<div>
								<h2><a href={`/tv/${subscription.tmdbShowId}`}>{subscription.showTitle}</a></h2>
								<p class="state" class:enabled={subscription.enabled}>
									{subscription.enabled ? 'Monitoring future episodes' : 'Notifications paused'}
								</p>
								<p class="last-check">
									Last checked: {formatDate(subscription.lastSuccessfulCheckAt)}
								</p>
								{#if subscription.lastCheckStatus === 'failed' || subscription.lastCheckStatus === 'rejected'}<p
										class="check-error"
									>
										Episode information is temporarily unavailable. The next check will retry.
									</p>{:else if subscription.lastCheckStatus === 'pending'}<p class="last-check">
										Waiting for the next episode check
									</p>{/if}
							</div>
						</div>
						<form
							method="POST"
							action="?/updateSubscription"
							use:enhance={save}
							class="preference-form"
						>
							<input type="hidden" name="subscriptionId" value={subscription.id} /><label
								class="toggle"
								><input
									type="checkbox"
									name="enabled"
									value="true"
									checked={subscription.enabled}
									disabled={busy}
								/>Notify me about new episodes</label
							>
							<div class="fields">
								<label
									>Timing<select name="offsetDays" value={subscription.offsetDays} disabled={busy}
										><option value="0">On release day</option><option value="1"
											>One day before</option
										><option value="7">Seven days before</option></select
									></label
								><label
									>Timezone<input
										name="timezone"
										value={subscription.timezone}
										required
										maxlength="64"
										disabled={busy}
									/></label
								><button disabled={busy}
									><Save size={17} aria-hidden="true" />{busy ? 'Saving...' : 'Save'}</button
								>
							</div>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.alerts-page {
		max-width: 1040px;
		padding-block: 2rem 4rem;
	}
	.page-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}
	h1 {
		font-size: 2rem;
		margin: 0 0 0.4rem;
		letter-spacing: 0;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.5rem;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	a {
		color: #6ee7b7;
	}
	.page-heading > a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
	}
	.notice {
		padding: 0.85rem;
		margin-bottom: 1rem;
		border-left: 3px solid #fbbf24;
		background: #fbbf2410;
		color: #fde68a;
	}
	.error {
		border-color: #fb7185;
		color: #fda4af;
	}
	.tabs {
		display: flex;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		margin-top: 1.25rem;
	}
	button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		font-size: 0.875rem;
	}
	.tabs button {
		border: 0;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		color: var(--text-secondary);
		padding: 0.85rem 0.5rem;
	}
	.tabs button.active {
		color: #6ee7b7;
		border-bottom-color: #6ee7b7;
	}
	button:disabled {
		opacity: 0.6;
	}
	:focus-visible {
		outline: 2px solid #6ee7b7;
		outline-offset: 3px;
	}
	.inbox-actions {
		display: flex;
		justify-content: flex-end;
		padding: 1rem 0 0;
	}
	.inbox,
	.subscriptions {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.inbox li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.notification-copy {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 0.4rem;
	}
	.unread-label {
		color: #fbbf24;
	}
	.notification-title {
		font-weight: 650;
		color: var(--text-primary);
		line-height: 1.5;
	}
	.unread .notification-title {
		color: #6ee7b7;
	}
	.episode {
		font-size: 0.8rem;
		margin-top: 0.5rem;
	}
	.icon-button {
		width: 44px;
		padding: 0;
	}
	.empty {
		padding: 3.5rem 0;
		text-align: center;
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		color: var(--text-secondary);
	}
	.subscriptions > li {
		padding: 1.5rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.series-heading {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.poster {
		display: block;
		aspect-ratio: 2/3;
		width: 64px;
		overflow: hidden;
		border-radius: 4px;
	}
	.state.enabled {
		color: #6ee7b7;
	}
	.last-check,
	.check-error {
		font-size: 0.75rem;
	}
	.check-error {
		color: #fda4af;
	}
	.preference-form {
		margin-top: 1rem;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 44px;
		font-size: 0.875rem;
	}
	.toggle input {
		width: 20px;
		height: 20px;
		accent-color: #10b981;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: end;
	}
	.fields label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	.fields input,
	.fields select {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 0.6rem;
		color: var(--text-primary);
		background: var(--bg-surface-2, #15171c);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
	}
	@media (max-width: 540px) {
		.fields {
			grid-template-columns: 1fr;
		}
		.fields button {
			justify-self: start;
		}
		.tabs {
			gap: 0.25rem;
		}
		.tabs button {
			font-size: 0.8rem;
		}
	}
</style>
