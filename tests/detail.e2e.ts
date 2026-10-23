import { existsSync } from 'node:fs';
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

	test('Back closes the player, keyboard users can operate the apron and the settings sheet keeps focus', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');
		await gotoHydrated(page, href as string);
		const play = page.getByRole('button', { name: /Play trailer|Resume/ });
		test.skip((await play.count()) === 0, 'this film has no trailer');

		await play.click();
		const dialog = page.getByRole('dialog', { name: /^Trailer: / });
		await expect(dialog).toBeVisible();
		await expect(page.locator('iframe, [role="alert"]').first()).toBeAttached({
			timeout: 20_000
		});

		// Space on a focused control activates that control, never play/pause.
		const settings = dialog.getByRole('button', { name: 'Settings' });
		await settings.focus();
		await page.keyboard.press('Space');
		const sheet = page.getByRole('dialog', { name: 'Player settings' });
		await expect(sheet).toBeVisible();

		// Focus stays inside the settings sheet while it is open.
		for (let index = 0; index < 25; index += 1) await page.keyboard.press('Tab');
		expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.kit-sheet')))).toBe(
			true
		);
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		await expect(dialog).toBeVisible();

		// Arrow keys on the seek thumb move only the slider (no extra 5 s skip per press).
		const thumb = dialog.getByRole('slider', { name: 'Seek' });
		if ((await thumb.getAttribute('aria-valuemax')) !== '1') {
			const before = Number(await thumb.getAttribute('aria-valuenow'));
			await thumb.focus();
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			const after = Number(await thumb.getAttribute('aria-valuenow'));
			expect(after - before).toBeGreaterThanOrEqual(3);
			expect(after - before).toBeLessThan(10);
		}

		await page.goBack();
		await expect(dialog).toBeHidden();
		await expect(page.locator('iframe')).toHaveCount(0);
		await expect(page.locator('html')).not.toHaveAttribute('data-player-open', '');
		expect(new URL(page.url()).pathname).toBe(href);
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

test.describe('Series detail in phone landscape', () => {
	const state = process.env.E2E_OWNER_STATE;
	test.use({
		viewport: { width: 956, height: 440 },
		hasTouch: true,
		isMobile: true,
		// The owner sees the tallest hero: Play, Start over and the episodes note.
		storageState: state && existsSync(state) ? state : undefined
	});

	test('the whole series hero, actions included, fits above the tab bar', async ({ page }) => {
		await page.goto('/tv');
		const hrefs = [
			...new Set(
				await page
					.locator('a[href^="/tv/"]')
					.evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))
			)
		].filter((href) => /^\/tv\/\d+$/.test(href));
		test.skip(hrefs.length === 0, 'needs a series in the catalogue');
		// Prefer a series with episodes on this PC (its hero is the tallest).
		let target = hrefs[0];
		for (const href of hrefs) {
			await page.goto(href);
			if ((await page.getByRole('group', { name: 'On this PC' }).count()) > 0) {
				target = href;
				break;
			}
		}
		await gotoHydrated(page, target);
		const tabBar = await page.getByRole('navigation', { name: 'Primary' }).boundingBox();
		const share = await page.getByRole('button', { name: 'Share' }).boundingBox();
		const poster = await page.locator('.header .poster').boundingBox();
		expect(tabBar).not.toBeNull();
		expect(share).not.toBeNull();
		const limit = tabBar?.y ?? 440;
		expect((share?.y ?? 0) + (share?.height ?? 0)).toBeLessThanOrEqual(limit);
		expect((poster?.y ?? 0) + (poster?.height ?? 0)).toBeLessThanOrEqual(limit);
	});
});
