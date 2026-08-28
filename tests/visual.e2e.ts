import { expect, test } from '@playwright/test';

test.skip(
	process.env.VISUAL_REGRESSION !== '1',
	'Run with VISUAL_REGRESSION=1 against the reviewed Chromium baseline.'
);

async function stabilize(page: import('@playwright/test').Page) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addStyleTag({
		content: `
			*, *::before, *::after { caret-color: transparent !important; }
			html { scroll-behavior: auto !important; }
		`
	});
}

test.describe('V3 visual regression baselines', () => {
	test('public entry desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto('/', { waitUntil: 'networkidle' });
		await stabilize(page);
		await expect(page).toHaveScreenshot('public-entry-desktop.png', {
			animations: 'disabled',
			fullPage: true,
			maxDiffPixelRatio: 0.01
		});
	});

	test('authentication portal mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/auth/login', { waitUntil: 'networkidle' });
		await stabilize(page);
		await expect(page).toHaveScreenshot('auth-login-mobile.png', {
			animations: 'disabled',
			fullPage: true,
			maxDiffPixelRatio: 0.01
		});
	});
});
