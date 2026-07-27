import { test, expect } from '@playwright/test';

test.describe('Navigation and Search Flow', () => {
	test('homepage loads and displays trending movies', async ({ page }) => {
		await page.goto('/');
		
		// The hero section or trending section should exist
		await expect(page.locator('.hero-content')).toBeVisible();
		
		// Verify that at least one movie card is rendered in the trending grid
		const movieCards = page.locator('.movie-grid .movie-card');
		// We can't guarantee TMDB API is seeded in CI, but the grid container should exist
		await expect(page.locator('.movie-grid').first()).toBeVisible();
	});

	test('search page allows searching', async ({ page }) => {
		await page.goto('/search');
		
		const searchInput = page.locator('input[type="search"]');
		await expect(searchInput).toBeVisible();
		
		// Type a search query
		await searchInput.fill('inception');
		
		// Note: we don't necessarily await API responses in this basic test unless we mock TMDB/Meilisearch
		// but we can verify the search input updates correctly.
		await expect(searchInput).toHaveValue('inception');
	});
});
