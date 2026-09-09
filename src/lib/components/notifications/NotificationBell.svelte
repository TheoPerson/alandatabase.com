<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { addToast } from '$lib/stores/toast';
	let { userId }: { userId: string } = $props();
	let unread = $state(0);
	let unavailable = $state(false);
	$effect(() => {
		if (!userId) return;
		unread = 0;
		let stopped = false;
		let initialized = false;
		let cursor = new Date().toISOString();
		let timer: ReturnType<typeof setTimeout>;
		let controller: AbortController | undefined;
		const seen = new SvelteSet<string>();
		async function poll() {
			if (stopped) return;
			clearTimeout(timer);
			if (document.visibilityState === 'hidden') {
				timer = setTimeout(poll, 60_000);
				return;
			}
			controller?.abort();
			controller = new AbortController();
			const timeout = setTimeout(() => controller?.abort(), 10_000);
			try {
				const response = await fetch(`/api/notifications?after=${encodeURIComponent(cursor)}`, {
					signal: controller.signal,
					cache: 'no-store'
				});
				if (response.status === 401 || response.status === 403) {
					unread = 0;
					stopped = true;
					return;
				}
				if (!response.ok) throw new Error('Unavailable');
				const body = await response.json();
				if (stopped) return;
				unread = Math.max(0, Number(body.unreadCount) || 0);
				unavailable = false;
				if (Array.isArray(body.notifications)) {
					for (const notification of body.notifications) {
						if (initialized && typeof notification.id === 'string' && !seen.has(notification.id))
							addToast(`${notification.title}: ${notification.body}`, 'info');
						seen.add(notification.id);
					}
					if (seen.size > 200) seen.clear();
				}
				if (typeof body.checkedAt === 'string') cursor = body.checkedAt;
				initialized = true;
			} catch {
				if (!stopped) unavailable = true;
			} finally {
				clearTimeout(timeout);
				if (!stopped) timer = setTimeout(poll, 60_000);
			}
		}
		const refresh = () => {
			if (document.visibilityState === 'visible') void poll();
		};
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('notifications-read', refresh);
		void poll();
		return () => {
			stopped = true;
			clearTimeout(timer);
			controller?.abort();
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('notifications-read', refresh);
		};
	});
</script>

<a
	class="notification-bell"
	href="/my/alerts"
	title={unavailable ? 'Alerts - refresh unavailable' : 'Episode alerts'}
	aria-label={`Episode alerts${unread ? `, ${unread} unread` : ''}${unavailable ? ', refresh unavailable' : ''}`}
	><Bell size={20} aria-hidden="true" />{#if unread}<span class="count"
			>{unread > 99 ? '99+' : unread}</span
		>{/if}</a
>

<style>
	.notification-bell {
		position: relative;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		color: var(--text-primary);
		border-radius: 6px;
	}
	.notification-bell:hover {
		background: var(--bg-surface-2);
	}
	.notification-bell:focus-visible {
		outline: 2px solid #6ee7b7;
		outline-offset: 2px;
	}
	.count {
		position: absolute;
		top: 1px;
		right: 0;
		min-width: 18px;
		height: 18px;
		padding: 0 3px;
		display: grid;
		place-items: center;
		background: #fbbf24;
		color: #191204;
		border-radius: 9px;
		font-size: 10px;
		font-weight: 700;
	}
</style>
