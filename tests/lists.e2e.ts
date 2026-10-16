import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Personal lists need a signed-in owner. CI has no authenticated fixture, so these
// specs run only when E2E_OWNER_USERNAME and E2E_OWNER_PASSWORD are provided.
const username = process.env.E2E_OWNER_USERNAME;
const password = process.env.E2E_OWNER_PASSWORD;

// Sign-in is rate limited per account: sign in once, then share the session cookies.
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

async function signIn(page: Page) {
	if (cookies.length > 0) {
		await page.context().addCookies(cookies);
		return;
	}
	await gotoHydrated(page, '/auth/login');
	await page.fill('input[name="identifier"]', username ?? '');
	await page.fill('input[name="password"]', password ?? '');
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/auth/login')),
		page.getByRole('button', { name: 'Sign in' }).click()
	]);
	cookies = await page.context().cookies();
}

test('the lists index asks visitors to sign in', async ({ page }) => {
	await page.goto('/my/lists');
	await expect(page).toHaveURL(/\/auth\/login/);
});

test.describe('Personal lists', () => {
	test.skip(!username || !password, 'Needs E2E_OWNER_USERNAME and E2E_OWNER_PASSWORD');
	test.describe.configure({ mode: 'serial' });

	test('index shows the Library header and a create action', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page);
		await gotoHydrated(page, '/my/lists');
		await expect(page.locator('h1')).toHaveText('Your lists');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.getByText('Library', { exact: true }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Create list' }).first()).toBeVisible();
		// The tab bar has its own Library link; this is the page's back link.
		await expect(page.locator('a.back')).toHaveText('Library');
		await expect(page.locator('a.back')).toHaveAttribute('href', '/my/films');
	});

	test('create validates, counts characters and opens the new list; delete returns to the index', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page);
		await gotoHydrated(page, '/my/lists/create');

		await page.getByRole('button', { name: 'Create list' }).click();
		await expect(page.locator('#list-name-error')).toHaveText('List name is required.');
		await expect(page.locator('#list-name')).toBeFocused();

		await page.fill('#list-name', 'x'.repeat(125));
		await expect(page.locator('#list-name')).toHaveAttribute('aria-invalid', 'true');
		await page.locator('#list-name').blur();
		await expect(page.locator('#list-name-count')).toHaveText('5 characters over the limit');

		const name = `E2E list ${Date.now()}`;
		await page.fill('#list-name', name);
		await page.locator('#list-name').blur();
		await expect(page.locator('#list-name-count')).toHaveText(
			`${120 - name.length} characters left`
		);
		await expect(page.locator('#list-name-error')).toHaveCount(0);

		const toggle = page.getByRole('switch', { name: 'Public list' });
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await page.getByText('Public list', { exact: true }).click();
		await expect(toggle).toHaveAttribute('aria-checked', 'true');

		await Promise.all([
			page.waitForURL(/\/my\/lists\/[0-9a-f-]{36}$/),
			page.getByRole('button', { name: 'Create list' }).click()
		]);
		await expect(page.locator('h1')).toHaveText(name);
		await expect(page.locator('.meta')).toContainText('0 films');
		await expect(page.locator('.meta')).toContainText('Public');
		await expect(page.getByRole('link', { name: 'Browse movies' })).toHaveAttribute(
			'href',
			'/movies'
		);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
		).toBeLessThanOrEqual(0);

		await page.getByRole('button', { name: 'Delete list' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete list' }).click();
		await expect(page).toHaveURL(/\/my\/lists$/);
		await expect(page.getByRole('heading', { name })).toHaveCount(0);
	});

	test('create and index have no horizontal overflow at 320px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await signIn(page);
		for (const path of ['/my/lists', '/my/lists/create']) {
			await gotoHydrated(page, path);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
			).toBeLessThanOrEqual(0);
		}
	});
});
