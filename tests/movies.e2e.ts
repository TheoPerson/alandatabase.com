import { test, expect } from '@playwright/test';

test.describe('Movie Interactions (E2E)', () => {
	// A unique username for each test run to avoid collisions
	const testUser = `test_cinephile_${Date.now()}`;
	const testPassword = 'SecurePassword123!';

	test.beforeEach(async ({ page }) => {
		// Register a new user before each test to ensure a clean state
		await page.goto('/auth/register');
		await page.fill('input[name="username"]', testUser);
		await page.fill('input[name="email"]', `${testUser}@example.com`);
		await page.fill('input[name="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Verify registration redirects to login or home
		await expect(page).toHaveURL(/.*\/auth\/login|.*\/$/);

		// If redirected to login, log in
		if (page.url().includes('/auth/login')) {
			await page.fill('input[name="username"]', testUser);
			await page.fill('input[name="password"]', testPassword);
			await page.click('button[type="submit"]');
		}
	});

	test('should allow a user to rate a movie and mark it as watched', async ({ page }) => {
		// Go to a known movie ID (Assuming Inception is seeded, ID: 27205)
		// Or we can just go to the discover page and click the first movie
		await page.goto('/search');
		
		// Search for a movie
		await page.fill('input[type="search"]', 'Inception');
		await page.click('button[type="submit"]');

		// Wait for search results
		const firstMovie = page.locator('.movie-card').first();
		await firstMovie.waitFor();
		await firstMovie.click();

		// Ensure we are on the movie page
		await expect(page).toHaveURL(/.*\/movies\/.+/);

		// The user should see the 'Mark as Watched' button
		const watchedBtn = page.getByRole('button', { name: /Mark as Watched/i });
		await expect(watchedBtn).toBeVisible();

		// Click it
		await watchedBtn.click();

		// It should now say '✔ Watched'
		await expect(page.getByRole('button', { name: /✔ Watched/i })).toBeVisible();

		// Rate the movie 5 stars
		const star5 = page.locator('button.star-btn[value="5"]');
		await star5.click();

		// The star should become active (we can just verify it doesn't crash and the state updates)
		// In our Svelte component, clicking the star submits a form via enhance.
		await expect(star5).toHaveClass(/active/);
	});
});
