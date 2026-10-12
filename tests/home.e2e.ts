import { expect, test } from '@playwright/test';

test.describe('Home navigation chrome', () => {
	test('shows the bottom tab bar on phones with 44px targets and one active tab', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/');
		const tabs = page.locator('nav.tabs a');
		await expect(tabs).toHaveCount(5);
		for (const tab of await tabs.all()) {
			expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
		await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveCount(1);
		await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveText(/Home/);
	});

	test('hides the bottom tab bar and shows primary links on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		await expect(page.locator('nav.tabs')).toBeHidden();
		await expect(page.getByRole('link', { name: 'Movies', exact: true }).first()).toBeVisible();
	});

	test('rails are labelled groups that scroll with the arrow control', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		const rail = page.getByRole('group', { name: 'Top 10 today' });
		test.skip(!(await rail.count()), 'needs catalogue data');
		await rail.hover();
		const before = await rail.evaluate((node) => node.scrollLeft);
		await page.getByRole('button', { name: 'Scroll Top 10 today forwards' }).click();
		await expect.poll(async () => rail.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before);
	});
});
