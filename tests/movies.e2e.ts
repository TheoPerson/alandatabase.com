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
		await expect(page.getByPlaceholder(/Type a movie title/)).toHaveValue('Inception');
	});
});
