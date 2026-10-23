import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const ownerUsername = process.env.E2E_OWNER_USERNAME;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

async function expectNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Sign-in page', () => {
	test('labels its fields, keeps noindex and carries returnTo to the form and register link', async ({
		page
	}) => {
		await gotoHydrated(page, '/auth/login?returnTo=%2Fmy%2Ffilms');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

		const identifier = page.getByLabel('Username or email');
		await expect(identifier).toHaveAttribute('autocomplete', 'username');
		const password = page.getByLabel('Password', { exact: true });
		await expect(password).toHaveAttribute('type', 'password');
		await expect(password).toHaveAttribute('autocomplete', 'current-password');
		const fontSize = await password.evaluate((el) => getComputedStyle(el).fontSize);
		expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);

		await expect(page.locator('#main-content form')).toHaveAttribute(
			'action',
			'?/login&returnTo=%2Fmy%2Ffilms'
		);
		await expect(page.locator('.foot a')).toHaveAttribute(
			'href',
			'/auth/register?returnTo=%2Fmy%2Ffilms'
		);
	});

	test('show-password is a pressed-state button that reveals the value', async ({ page }) => {
		await gotoHydrated(page, '/auth/login');
		const password = page.getByLabel('Password', { exact: true });
		const toggle = page.getByRole('button', { name: 'Show password' });
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(password).toHaveAttribute('type', 'text');
		await toggle.press('Enter');
		await expect(password).toHaveAttribute('type', 'password');
	});

	test('an empty submit shows inline English errors tied to the fields', async ({ page }) => {
		await gotoHydrated(page, '/auth/login');
		await page.getByRole('button', { name: 'Sign in' }).click();
		const identifier = page.getByLabel('Username or email');
		await expect(identifier).toHaveAttribute('aria-invalid', 'true');
		await expect(identifier).toBeFocused();
		await expect(page.locator('#identifier-error')).toHaveText('Enter your username or email.');
		await expect(identifier).toHaveAttribute('aria-describedby', /identifier-error/);
		await identifier.fill('someone');
		await expect(page.locator('#identifier-error')).toHaveCount(0);
	});

	test('a rejected sign-in is announced and referenced by the fields', async ({ page }) => {
		await gotoHydrated(page, '/auth/login');
		await page.getByLabel('Username or email').fill(`e2e-nobody-${Date.now()}`);
		await page.getByLabel('Password', { exact: true }).fill('not-the-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		const alert = page.locator('[aria-live="assertive"] #auth-error');
		await expect(alert).toBeVisible();
		await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
			'aria-describedby',
			/auth-error/
		);
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
	});

	test('fits 320px without horizontal overflow', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/auth/login');
		await expectNoHorizontalOverflow(page);
	});

	test('phone landscape: both fields and Sign in fit above the tab bar', async ({ page }) => {
		await page.setViewportSize({ width: 956, height: 440 });
		await gotoHydrated(page, '/auth/login');
		const visibleLimit = 440 - 56; // the fixed tab bar
		for (const target of [
			page.getByLabel('Username or email'),
			page.getByLabel('Password', { exact: true }),
			page.getByRole('button', { name: 'Sign in' })
		]) {
			const box = await target.boundingBox();
			expect(box).not.toBeNull();
			expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(visibleLimit);
		}
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
		await expectNoHorizontalOverflow(page);
	});
});

test.describe('Registration page', () => {
	test('presents the server mode honestly and links back to sign-in with returnTo', async ({
		page
	}) => {
		await gotoHydrated(page, '/auth/register?returnTo=%2Fmy');
		const heading = page.getByRole('heading', { level: 1 });
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
		if ((await heading.textContent())?.trim() === 'Owner setup') {
			await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
				'autocomplete',
				'new-password'
			);
			await expect(page.locator('.foot a')).toHaveAttribute('href', '/auth/login?returnTo=%2Fmy');
		} else {
			await expect(heading).toHaveText('Registration is closed');
			await expect(page.locator('#main-content form')).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
				'href',
				'/auth/login?returnTo=%2Fmy'
			);
		}
	});

	test('an unknown invitation reads as unavailable, not as an open form', async ({ page }) => {
		await gotoHydrated(page, '/auth/register?invite=not-a-real-invitation');
		const heading = page.getByRole('heading', { level: 1 });
		if ((await heading.textContent())?.trim() === 'Owner setup') test.skip();
		await expect(heading).toHaveText('Invitation unavailable');
	});

	test('fits 320px without horizontal overflow', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/auth/register');
		await expectNoHorizontalOverflow(page);
	});
});

test.describe('Sign-in without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('posts natively and renders the server error', async ({ page }) => {
		// A full no-JavaScript round trip re-renders the page on the server; dev servers are slow.
		test.slow();
		await page.goto('/auth/login');
		await expect(page.getByRole('button', { name: 'Show password' })).toHaveCount(0);
		await page.getByLabel('Username or email').fill(`e2e-nojs-${Date.now()}`);
		await page.getByLabel('Password', { exact: true }).fill('not-the-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.locator('#auth-error')).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
	});
});

test.describe('Owner sign-in', () => {
	test.skip(!ownerUsername || !ownerPassword, 'E2E owner credentials are not configured.');

	test('signs in and lands on the returnTo page', async ({ page }) => {
		await gotoHydrated(page, '/auth/login?returnTo=%2Fmy%2Ffilms');
		await page.getByLabel('Username or email').fill(ownerUsername!);
		await page.getByLabel('Password', { exact: true }).fill(ownerPassword!);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.waitForURL('**/my/films');
		expect(new URL(page.url()).pathname).toBe('/my/films');
	});
});
