import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const username = process.env.E2E_OWNER_USERNAME;
const password = process.env.E2E_OWNER_PASSWORD;
const ACTION = /\/movies\/[^/?]+\?\/logInteraction$/;

async function signIn(page: Page) {
	await gotoHydrated(page, '/auth/login');
	await page.fill('#identifier', username as string);
	await page.fill('#password', password as string);
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 15_000 }),
		page.click('button[type="submit"]')
	]);
}

async function firstPick(page: Page) {
	await gotoHydrated(page, '/cinema/picker');
	await page.getByRole('button', { name: 'Pick a film' }).click();
	const title = page.locator('#picker-title');
	await expect(title.or(page.getByText('No film matches these filters'))).toBeVisible({
		timeout: 30_000
	});
	test.skip(!(await title.count()), 'needs catalogue data');
}

test('the picker is private: signed-out visitors are sent to sign in', async ({ page }) => {
	await page.goto('/cinema/picker');
	await expect(page).toHaveURL(/\/auth\/login/);
});

test.describe('Movie picker (signed in)', () => {
	test.skip(!username || !password, 'needs E2E_OWNER_USERNAME and E2E_OWNER_PASSWORD');

	// One sign-in for the whole file: the login form is rate limited per account.
	let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

	test.beforeAll(async ({ browser }, testInfo) => {
		const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
		await signIn(await context.newPage());
		cookies = await context.cookies();
		await context.close();
	});

	test.beforeEach(async ({ context }) => {
		await context.addCookies(cookies);
	});

	test('one h1, moods as chips, and a card with an honest rating', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/cinema/picker');
		await expect(page.locator('h1')).toHaveCount(1);
		const moods = page.getByRole('group', { name: 'Moods' }).getByRole('button');
		await expect(moods.first()).toHaveAttribute('aria-pressed', 'true');
		await firstPick(page);

		const source = await page.locator('.score-source').allTextContents();
		for (const label of source) expect(['IMDb', 'TMDB']).toContain(label);
		const another = page.getByRole('button', { name: 'Another' });
		expect((await another.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await expect(page.getByRole('button', { name: 'Watchlist' })).not.toHaveAttribute(
			'aria-pressed',
			/.*/
		);

		await page.setViewportSize({ width: 320, height: 640 });
		const widths = await page.evaluate(() => [
			document.documentElement.scrollWidth,
			window.innerWidth
		]);
		expect(widths[0]).toBeLessThanOrEqual(widths[1]);
	});

	test('Another and ArrowRight bring a new film', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await firstPick(page);
		const title = page.locator('#picker-title');
		const first = await title.textContent();
		const request = page.waitForRequest('**/api/picker/recommend');
		await page.keyboard.press('ArrowRight');
		await request;
		await expect(page.locator('p.sr-only[role="status"]')).toHaveText(/Now showing|No film/);
		if ((await title.count()) && (await title.textContent()) === first) {
			throw new Error('ArrowRight did not change the film');
		}
	});

	test('saving shows only the server-confirmed state', async ({ page }) => {
		await firstPick(page);
		const watchlist = page.getByRole('button', { name: /Watchlist|In watchlist/ });

		const posted = page.waitForRequest((req) => ACTION.test(req.url()) && req.method() === 'POST');
		await watchlist.click();
		const body = (await posted).postData() ?? '';
		expect(body).toContain('watchlist');
		await expect(watchlist).toHaveAttribute('aria-pressed', /true|false/);
		const pressed = await watchlist.getAttribute('aria-pressed');

		// Toggle back so repeated runs start from the same place.
		await watchlist.click();
		await expect(watchlist).not.toHaveAttribute('aria-pressed', pressed as string);
	});

	test('a failed save keeps the state unknown and says so', async ({ page }) => {
		await firstPick(page);
		await page.route(ACTION, (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					type: 'failure',
					status: 500,
					data: JSON.stringify([{ error: 1 }, 'Failed to update interaction.'])
				})
			})
		);
		const favourite = page.getByRole('button', { name: 'Favourite' });
		await favourite.click();
		await expect(page.getByText('That could not be saved. Please try again.')).toBeVisible();
		await expect(favourite).not.toHaveAttribute('aria-pressed', /.*/);
	});

	test('a failed first pick shows a retry state', async ({ page }) => {
		await page.route('**/api/picker/recommend', (route) =>
			route.fulfill({ status: 500, body: 'boom' })
		);
		await gotoHydrated(page, '/cinema/picker');
		await page.getByRole('button', { name: 'Pick a film' }).click();
		await expect(page.getByText('The picker could not load a film')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	});

	test('filters live in a sheet and apply in one request', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/cinema/picker');
		await page.getByRole('button', { name: /^Filters/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Refine the picker' });
		await expect(sheet).toBeVisible();
		await sheet.getByRole('button', { name: 'Discovery' }).click();
		const request = page.waitForRequest('**/api/picker/recommend');
		await sheet.getByRole('button', { name: 'Show a film' }).click();
		expect((await request).postDataJSON().filters.mode).toBe('discovery');
		await expect(sheet).toBeHidden();
	});
});
