import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

async function firstMovieHref(page: Page): Promise<string | null> {
	await gotoHydrated(page, '/');
	const link = page.locator('a[href^="/movies/"]').first();
	return (await link.count()) ? link.getAttribute('href') : null;
}

test.describe('Navigation chrome', () => {
	test('the top bar stays clickable on a movie detail page', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);
		await page
			.getByRole('navigation', { name: 'Primary' })
			.first()
			.getByRole('link', { name: 'Movies', exact: true })
			.click();
		await expect(page).toHaveURL(/\/movies$/);
	});

	test('the footer clears the bottom tab bar on phones', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/');
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await page.waitForTimeout(300);
		const footer = await page.locator('footer').boundingBox();
		const tabs = await page.locator('nav.tabs').boundingBox();
		expect(footer && tabs && footer.y + footer.height <= tabs.y + 1).toBe(true);
	});

	test('Discover and Picker stay reachable on phones', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/');
		await expect(page.getByRole('link', { name: 'Discover' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Picker' }).first()).toBeVisible();
	});

	test('the brand link carries the radar mark and its visible name', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/');
		const brand = page.getByRole('link', { name: /ALAN\s?DB/ }).first();
		await expect(brand).toBeVisible();
		await expect(brand.locator('svg')).toHaveCount(1);
	});
});

test.describe('Featured carousel', () => {
	test('can be paused and does not announce while rotating', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/');
		const hero = page.getByRole('region', { name: 'Featured titles' });
		test.skip(!(await hero.count()), 'needs catalogue data');
		await expect(hero.locator('[aria-live]')).toHaveAttribute('aria-live', 'off');
		const pause = hero.getByRole('button', { name: 'Pause featured titles' });
		await expect(pause).toBeVisible();
		await pause.click();
		await expect(hero.getByRole('button', { name: 'Play featured titles' })).toBeVisible();
		await expect(hero.locator('[aria-live]')).toHaveAttribute('aria-live', 'polite');
	});

	test('switching slides keeps the action row in place', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/');
		const hero = page.getByRole('region', { name: 'Featured titles' });
		const dots = hero.getByRole('group', { name: 'Choose featured title' }).getByRole('button');
		test.skip((await dots.count()) < 2, 'needs at least two featured titles');
		const before = await hero.locator('.actions').boundingBox();
		await dots.nth(1).click();
		await page.waitForTimeout(900);
		const after = await hero.locator('.actions').boundingBox();
		expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2);
	});

	test('ranked posters are as wide as plain posters', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/');
		const ranked = page.getByRole('group', { name: 'Top 10 today' }).locator('.frame').first();
		const plain = page.getByRole('group', { name: 'Trending movies' }).locator('.frame').first();
		test.skip(!(await ranked.count()) || !(await plain.count()), 'needs catalogue data');
		const a = await ranked.boundingBox();
		const b = await plain.boundingBox();
		expect(Math.abs((a?.width ?? 0) - (b?.width ?? 0))).toBeLessThanOrEqual(1);
	});
});
