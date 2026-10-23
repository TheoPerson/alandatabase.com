import { test, expect } from '@playwright/test';

test.describe('Authentication Middleware (hooks.server.ts)', () => {
	test('public cinema browsing does not require a session', async ({ page }) => {
		const response = await page.goto('/movies');
		expect(response?.status()).toBe(200);
		expect(new URL(page.url()).pathname).toBe('/movies');
	});

	test('anonymous users are redirected from the owner console', async ({ page }) => {
		await page.goto('/admin');
		expect(page.url()).toContain('/auth/login');
		expect(page.url()).toContain('returnTo=%2Fadmin');
	});

	test('API requests to protected routes without auth return 401 Unauthorized', async ({
		request
	}) => {
		const response = await request.get('/api/movies/catalog');
		expect(response.status()).toBe(401);

		const json = await response.json();
		expect(json).toEqual({ error: 'Unauthorized' });
	});

	test('public application routes are accessible anonymously', async ({ request }) => {
		for (const route of ['/', '/status', '/api', '/auth/login']) {
			const response = await request.get(route);
			expect(response.status(), route).toBe(200);
		}
	});

	test('keeps the owner portal out of search indexes', async ({ request }) => {
		const response = await request.get('/auth/login');
		const html = await response.text();

		expect(response.status()).toBe(200);
		expect(html).toContain('name="robots" content="noindex, nofollow"');
	});
});
