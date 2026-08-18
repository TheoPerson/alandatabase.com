import { test, expect } from '@playwright/test';

test.describe('Authentication Middleware (hooks.server.ts)', () => {
	test('anonymous user is redirected to login from a protected route', async ({ page }) => {
		const response = await page.goto('/movies');
		// Should redirect to login
		expect(page.url()).toContain('/auth/login');
		expect(page.url()).toContain('returnTo=%2Fmovies');
	});

	test('API requests to protected routes without auth return 401 Unauthorized', async ({ request }) => {
		const response = await request.get('/api/movies/search?q=test');
		expect(response.status()).toBe(401);
		
		const json = await response.json();
		expect(json).toEqual({ error: 'Unauthorized' });
	});

	test('public routes are accessible anonymously', async ({ page }) => {
		const response = await page.goto('/auth/login');
		expect(response?.status()).toBe(200);
		
		const hubResponse = await page.goto('/');
		expect(hubResponse?.status()).toBe(200);
	});
});
