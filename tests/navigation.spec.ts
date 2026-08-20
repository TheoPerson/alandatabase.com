import { test, expect } from '@playwright/test';

test.describe('Navigation and Search Flow', () => {
	test('public landing page exposes the primary cinema journey', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('A quieter way');
		await expect(page.getByRole('link', { name: /Enter Cinema/i })).toBeVisible();
	});

	test('movie catalogue shell stays visible even when the database is empty', async ({ page }) => {
		await page.goto('/movies');
		await expect(page.getByRole('heading', { name: 'TOP 10 Today' })).toBeVisible();
	});

	test('search page allows searching', async ({ page }) => {
		await page.goto('/search');

		const searchInput = page.locator('input[type="search"]');
		await expect(searchInput).toBeVisible();

		await searchInput.fill('inception');
		await expect(searchInput).toHaveValue('inception');
	});
});
