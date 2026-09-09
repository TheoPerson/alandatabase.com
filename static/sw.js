const CACHE_NAME = 'alan-database-public-shell-v3';
const PRECACHE = ['/offline.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key === 'alan-vault-v1' || key.startsWith('alan-database-public-shell-'))
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;

	event.respondWith(
		fetch(event.request).catch(async () => {
			const offline = await caches.match('/offline.html');
			return offline || Response.error();
		})
	);
});

self.addEventListener('push', (event) => {
	let payload;
	try { payload = event.data?.json(); } catch { return; }
	if (!payload || typeof payload.title !== 'string') return;
	let target = '/my/alerts';
	try {
		const candidate = new URL(payload.targetPath || payload.url || '/my/alerts', self.location.origin);
		if (candidate.origin === self.location.origin && /^\/(tv\/\d+|my\/alerts)$/.test(candidate.pathname)) target = candidate.pathname + candidate.search;
	} catch { /* Invalid destinations open the inbox. */ }
	event.waitUntil(self.registration.showNotification(payload.title.slice(0, 255), {
		body: typeof payload.body === 'string' ? payload.body.slice(0, 1000) : '',
		tag: typeof payload.notificationId === 'string' ? `episode-${payload.notificationId}` : typeof payload.id === 'string' ? payload.id : undefined,
		data: { targetPath: target }
	}));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	let target = new URL('/my/alerts', self.location.origin);
	try {
		const candidate = new URL(event.notification.data?.targetPath, self.location.origin);
		if (candidate.origin === self.location.origin && /^\/(tv\/\d+|my\/alerts)$/.test(candidate.pathname)) target = candidate;
	} catch { /* Fall back to the authenticated inbox. */ }
	event.waitUntil((async () => {
		const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		for (const client of windows) {
			if (new URL(client.url).origin !== self.location.origin) continue;
			const navigated = await client.navigate(target.href);
			if (navigated) return navigated.focus();
		}
		return self.clients.openWindow(target.href);
	})());
});
