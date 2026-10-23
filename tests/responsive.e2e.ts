import { expect, test } from '@playwright/test';
import { firstMovieHref } from './helpers';

const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
const routes = [
	'/',
	'/about',
	'/kit',
	'/search',
	'/movies',
	'/tv',
	'/live',
	'/auth/login',
	'/status'
];

test.describe('Responsive production surfaces', () => {
	for (const width of widths) {
		test(`${width}px has no horizontal document overflow`, async ({ page }) => {
			await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });

			for (const route of routes) {
				await page.goto(route, { waitUntil: 'domcontentloaded' });
				const dimensions = await page.evaluate(() => ({
					scrollWidth: document.documentElement.scrollWidth,
					clientWidth: document.documentElement.clientWidth
				}));
				expect(dimensions.scrollWidth, `${route} overflows at ${width}px`).toBeLessThanOrEqual(
					dimensions.clientWidth + 1
				);
			}
		});
	}

	test('mobile search remains keyboard and touch operable', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.goto('/search');

		const search = page.getByRole('searchbox', { name: 'Movie title' });
		const submit = page.locator('.main-search-form').getByRole('button', { name: 'Search' });
		await expect(search).toBeVisible();
		await expect(submit).toBeVisible();
		expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);

		await search.focus();
		await search.fill('Arrival');
		await submit.press('Enter');
		await expect(page).toHaveURL(/\/search\?q=Arrival$/);
	});
});

test.describe('Responsive movie detail', () => {
	test('a real film page has no horizontal overflow at any width', async ({ page }) => {
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');

		for (const width of widths) {
			await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
			await page.goto(href as string, { waitUntil: 'domcontentloaded' });
			const dimensions = await page.evaluate(() => ({
				scrollWidth: document.documentElement.scrollWidth,
				clientWidth: document.documentElement.clientWidth
			}));
			expect(dimensions.scrollWidth, `${href} overflows at ${width}px`).toBeLessThanOrEqual(
				dimensions.clientWidth + 1
			);
		}
	});
});
