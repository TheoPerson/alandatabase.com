import { test, expect } from '@playwright/test';

test.describe('Navigation and Search Flow', () => {
	test('home is the cinema: featured carousel or an honest empty state', async ({ page }) => {
		await page.goto('/');
		const hero = page.getByRole('region', { name: 'Featured titles' });
		const empty = page.getByText('No published movies yet');
		await expect(hero.or(empty)).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible();
	});

	test('the project landing page lives at /about', async ({ page }) => {
		await page.goto('/about');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('A quieter way');
	});

	test('movie catalogue shell stays visible even when the database is empty', async ({ page }) => {
		await page.goto('/movies');
		await expect(page.getByRole('heading', { name: 'TOP 10 Today' })).toBeVisible();
	});

	test('search page allows searching', async ({ page }) => {
		await page.goto('/search');

		const searchInput = page.getByRole('searchbox', { name: 'Movie title' });
		await expect(searchInput).toBeVisible();

		await searchInput.fill('inception');
		await expect(searchInput).toHaveValue('inception');
	});
});
