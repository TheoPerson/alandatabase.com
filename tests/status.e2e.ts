import { expect, test } from '@playwright/test';

test.describe('Public status and release surface', () => {
	test('publishes live service state and structured release notes', async ({ page }) => {
		const response = await page.goto('/status');

		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle('System Status & Release Notes | Alan Database');
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/systems|monitoring/i);
		await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Release notes' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Major Updates' }).first()).toBeVisible();

		const animationName = await page
			.locator('.fluid-layer-one')
			.evaluate((element) => getComputedStyle(element).animationName);
		expect(animationName).not.toBe('none');
	});

	test('stays within a 320px viewport and respects reduced motion', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/status');

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth
		);
		const animationName = await page
			.locator('.fluid-layer-one')
			.evaluate((element) => getComputedStyle(element).animationName);

		expect(hasHorizontalOverflow).toBe(false);
		expect(animationName).toBe('none');
	});
});
