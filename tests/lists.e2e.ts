import { existsSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Personal lists need a signed-in owner. CI has no authenticated fixture, so these specs run
// only with E2E_OWNER_STATE (a Playwright storage state of a signed-in owner, reused so repeated
// runs never touch the rate-limited sign-in) or E2E_OWNER_USERNAME + E2E_OWNER_PASSWORD.
const STATE = process.env.E2E_OWNER_STATE;
const HAS_STATE = Boolean(STATE && existsSync(STATE));
const username = process.env.E2E_OWNER_USERNAME;
const password = process.env.E2E_OWNER_PASSWORD;
const HAS_OWNER = HAS_STATE || Boolean(username && password);

// Sign-in is rate limited per account: sign in once, then share the session cookies.
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

async function signIn(page: Page) {
	if (HAS_STATE) return; // The context already carries the saved session.
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
	test.skip(HAS_STATE, 'runs signed out only');
	await page.goto('/my/lists');
	await expect(page).toHaveURL(/\/auth\/login/);
});

test.describe('Personal lists', () => {
	test.skip(!HAS_OWNER, 'Needs E2E_OWNER_STATE, or E2E_OWNER_USERNAME and E2E_OWNER_PASSWORD');
	test.describe.configure({ mode: 'serial' });
	if (HAS_STATE) test.use({ storageState: STATE });

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
		// The back link sits in the eyebrow slot: no second "Library" label above the title.
		await expect(page.locator('.eyebrow')).toHaveCount(0);
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

		const toggle = page.getByRole('switch', { name: 'Share publicly' });
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('#list-public-hint')).toHaveText('Private: only you can see it.');
		await page.getByText('Share publicly', { exact: true }).click();
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

	test('a starter prefills the create form', async ({ page }) => {
		await gotoHydrated(page, '/my/lists/create?name=Rainy%20Sunday&description=Slow%20films');
		await expect(page.locator('#list-name')).toHaveValue('Rainy Sunday');
		await expect(page.locator('#list-description')).toHaveValue('Slow films');
		// The counter stays hidden until 80% of the limit.
		await expect(page.locator('.counter')).toHaveCount(0);
	});

	test('Library: the section tabs sit in the first screen on the owner’s phone', async ({
		page
	}) => {
		await page.setViewportSize({ width: 440, height: 956 });
		await gotoHydrated(page, '/my/films');
		const tabs = page.getByRole('navigation', { name: 'Library sections' });
		const box = await tabs.boundingBox();
		expect(box).not.toBeNull();
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(956 / 2);
		for (const chip of await tabs.getByRole('link').all()) {
			expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
		// Stats is the last tab: opening it scrolls it into view inside the row.
		await gotoHydrated(page, '/my/films?tab=stats');
		const stats = tabs.getByRole('link', { name: 'Stats' });
		await expect(stats).toHaveAttribute('aria-current', 'true');
		await expect(stats).toBeInViewport({ ratio: 1 });
		await expect(page.getByText('Time watched')).toBeVisible();
	});

	test('Library: the film grid lines up with the page edge and matches Browse density', async ({
		page
	}) => {
		await page.setViewportSize({ width: 440, height: 956 });
		await gotoHydrated(page, '/my/films?tab=watchlist');
		const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
		const grid = page.locator('.panel ul.grid').first();
		const card = await grid.locator('li').first().boundingBox();
		expect(heading).not.toBeNull();
		expect(card).not.toBeNull();
		// One left edge: the first poster starts where the title starts (no doubled gutter).
		expect(Math.abs((card?.x ?? 0) - (heading?.x ?? 0))).toBeLessThanOrEqual(1);
		// Three posters across the phone, like /movies and /tv.
		const columns = await grid.evaluate(
			(el) => getComputedStyle(el).gridTemplateColumns.split(' ').length
		);
		expect(columns).toBe(3);
	});
});
