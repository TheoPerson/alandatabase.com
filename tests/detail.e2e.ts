import { expect, test } from '@playwright/test';
import { firstMovieHref, gotoHydrated } from './helpers';

const EMBED_HOST = 'https://www.youtube-nocookie.com/';

test.describe('Movie detail', () => {
	test('renders one heading, switches tabs by keyboard and hash, and shows where to watch', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, `${href}#details`);

		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		await page.getByRole('tab', { name: 'Overview' }).click();
		await expect(page.getByRole('heading', { name: 'Where to watch' })).toBeVisible();
		await expect(page.getByText('Data by JustWatch')).toBeVisible();

		await page.getByRole('tab', { name: 'Overview' }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('tab', { name: 'Cast & crew' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page).toHaveURL(/#cast$/);
		await expect(page.locator('iframe')).toHaveCount(0);
	});

	test('opens the trailer player only on click, embeds one youtube-nocookie frame at most, and closes with Escape', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);

		const play = page.getByRole('button', { name: /Play trailer|Resume/ });
		test.skip((await play.count()) === 0, 'this film has no trailer');
		await expect(page.locator('iframe')).toHaveCount(0);

		await play.click();
		const dialog = page.getByRole('dialog', { name: /^Trailer: / });
		await expect(dialog).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('data-player-open', '');
		await expect(dialog.getByRole('button', { name: 'Settings' })).toBeVisible();

		// The official API needs the network; without it the player shows its fallback, never a mirror.
		const outcome = page.locator('iframe, [role="alert"]').first();
		await expect(outcome).toBeAttached({ timeout: 20_000 });
		const frames = page.locator('iframe');
		expect(await frames.count()).toBeLessThanOrEqual(1);
		if ((await frames.count()) === 1) {
			expect(await frames.first().getAttribute('src')).toContain(EMBED_HOST);
		}

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(page.locator('iframe')).toHaveCount(0);
		await expect(page.locator('html')).not.toHaveAttribute('data-player-open', '');
		await expect(play).toBeFocused();
	});

	test('signed-out actions lead to login and the page fits 320 px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);

		await expect(page.getByRole('link', { name: 'Watchlist' })).toHaveAttribute(
			'href',
			/\/auth\/login\?returnTo=/u
		);
		await expect(page.getByRole('link', { name: 'Rate' })).toHaveAttribute(
			'href',
			/\/auth\/login\?returnTo=/u
		);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(1);
	});
});
