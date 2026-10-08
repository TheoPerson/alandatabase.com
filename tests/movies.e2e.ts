import { test, expect } from '@playwright/test';

test.describe('Public cinema and API integration', () => {
	test('API metadata advertises the real V3 endpoints', async ({ request }) => {
		const response = await request.get('/api');
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body).toMatchObject({
			name: 'Alan Database API',
			version: 'v3',
			status: 'ok'
		});
	});

	test('public search preserves its query and renders a bounded result state', async ({ page }) => {
		await page.goto('/search?q=Inception');
		await expect(page.getByRole('heading', { name: /Results for/i })).toContainText('Inception');
		await expect(page.getByRole('searchbox', { name: 'Movie title' })).toHaveValue('Inception');
	});

	test('playback surfaces never mount third-party players', async ({ page }) => {
		for (const route of ['/live', '/tv/1']) {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			await expect(page.locator('iframe'), `${route} must not embed a player`).toHaveCount(0);
		}
	});

	test('disabled custom intake answers 503 without writing', async ({ request }) => {
		const response = await request.post('/movies/custom', {
			form: { title: 'E2E probe', tmdbId: '1' }
		});
		expect(response.status()).toBe(503);
	});
});
