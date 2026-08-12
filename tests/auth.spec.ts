import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Authentication Flow', () => {
	test('user can register and log in', async ({ page }) => {
		const testUsername = `user_${randomUUID().substring(0, 8)}`;
		const testEmail = `${testUsername}@example.com`;
		const password = 'TestPassword123!';

		// Go to registration page
		await page.goto('/auth/register');
		await expect(page).toHaveTitle(/Cinema Platform/); // Assuming layout has a title, or we can check header

		// Fill form
		await page.fill('input[name="username"]', testUsername);
		await page.fill('input[name="email"]', testEmail);
		await page.fill('input[name="password"]', password);

		// Submit
		await page.click('button[type="submit"]');

		// Should redirect to /my/films upon successful registration
		await page.waitForURL('/my/films');
		await expect(page.locator('h1')).toContainText('My Archive');

		// Clear cookies to simulate logout
		await page.context().clearCookies();

		// Go to login page
		await page.goto('/auth/login');

		// Fill login form
		await page.fill('input[name="identifier"]', testUsername);
		await page.fill('input[name="password"]', password);
		await page.click('button[type="submit"]');

		// Should redirect to /my/films
		await page.waitForURL('/my/films');
		await expect(page.locator('h1')).toContainText('My Archive');
	});

	test('shows error on invalid login', async ({ page }) => {
		await page.goto('/auth/login');

		await page.fill('input[name="identifier"]', 'nonexistent_user_999');
		await page.fill('input[name="password"]', 'wrongpassword');
		await page.click('button[type="submit"]');

		// Check for error banner
		await expect(page.locator('.error-banner')).toBeVisible();
		await expect(page.locator('.error-banner')).toContainText('Invalid username or password');
	});
});
