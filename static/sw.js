const CACHE_NAME = 'alan-database-public-shell-v3';
const PRECACHE = ['/offline.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
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
