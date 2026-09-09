<script lang="ts">
	import { onMount } from 'svelte';
	import { BellRing, BellOff } from 'lucide-svelte';
	let { publicKey }: { publicKey: string | null } = $props();
	let supported = $state(false);
	let enabled = $state(false);
	let busy = $state(false);
	let ready = $state(false);
	let message = $state('');
	onMount(() => {
		supported =
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			'Notification' in window &&
			window.isSecureContext;
		if (!supported) {
			ready = true;
			return;
		}
		void navigator.serviceWorker
			.getRegistration('/')
			.then(async (registration) => {
				const subscription = await registration?.pushManager.getSubscription();
				if (subscription) {
					const response = await fetch(
						`/api/notifications/push?endpoint=${encodeURIComponent(subscription.endpoint)}`,
						{ cache: 'no-store' }
					);
					if (!response.ok) throw new Error('Device check failed');
					enabled = (await response.json()).subscribed === true;
				}
				if (Notification.permission === 'denied')
					message = 'Notifications are blocked in your browser settings.';
			})
			.catch(() => {
				message = 'Could not check this device. Please try again.';
			})
			.finally(() => {
				ready = true;
			});
	});
	async function toggle() {
		busy = true;
		message = '';
		try {
			if (enabled) {
				const registration = await navigator.serviceWorker.getRegistration('/');
				const subscription = await registration?.pushManager.getSubscription();
				if (subscription) {
					const response = await fetch('/api/notifications/push', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ endpoint: subscription.endpoint })
					});
					if (!response.ok) throw new Error('Could not disable notifications. Please try again.');
					await subscription.unsubscribe();
				}
				enabled = false;
				message = 'Push notifications disabled on this device.';
			} else {
				if (!publicKey) throw new Error('Push notifications are currently unavailable.');
				const permission = await Notification.requestPermission();
				if (permission !== 'granted')
					throw new Error(
						permission === 'denied'
							? 'Notifications are blocked in your browser settings.'
							: 'Notification permission was not granted.'
					);
				await navigator.serviceWorker.register('/sw.js', { scope: '/' });
				const registration = await navigator.serviceWorker.ready;
				const decoded = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'));
				const key = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
				const subscription =
					(await registration.pushManager.getSubscription()) ??
					(await registration.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: key
					}));
				const response = await fetch('/api/notifications/push', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(subscription.toJSON())
				});
				if (!response.ok) {
					await subscription.unsubscribe();
					throw new Error('Could not save push notifications. Please try again.');
				}
				enabled = true;
				message = 'Push notifications enabled on this device.';
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Could not change push notifications.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="push-settings">
	<div>
		<h2>Browser notifications</h2>
		<p>
			{!ready
				? 'Checking this device...'
				: !supported
					? 'Push is not supported in this browser. Your inbox remains available.'
					: !publicKey
						? 'Push notifications are currently unavailable.'
						: enabled
							? 'Enabled on this device'
							: 'Disabled on this device'}
		</p>
	</div>
	{#if supported && (publicKey || enabled)}<button
			onclick={toggle}
			disabled={busy || !ready}
			aria-pressed={enabled}
			>{#if enabled}<BellOff size={18} aria-hidden="true" />{:else}<BellRing
					size={18}
					aria-hidden="true"
				/>{/if}{busy ? 'Updating...' : enabled ? 'Disable push' : 'Enable push'}</button
		>{/if}
	<p role="status" class="status">{message}</p>
</div>

<style>
	.push-settings {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 1.25rem 0;
		border-block: 1px solid var(--border-subtle);
	}
	h2 {
		font-size: 1rem;
		margin: 0 0 0.35rem;
	}
	p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}
	button {
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		color: var(--text-primary);
	}
	button:focus-visible {
		outline: 2px solid #6ee7b7;
		outline-offset: 3px;
	}
	button:disabled {
		opacity: 0.6;
	}
	.status {
		flex-basis: 100%;
		overflow-wrap: anywhere;
	}
	.status:empty {
		display: none;
	}
</style>
