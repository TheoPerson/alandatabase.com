import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const input = (page: Page) => page.getByRole('combobox', { name: 'Search films and pages' });
const movieOptions = (page: Page) => dialog(page).locator('[role="option"][data-kind="movie"]');
const activeOption = (page: Page) => dialog(page).locator('[role="option"][data-selected]');

// A query the local catalogue can answer, or null on an empty one (specs then skip).
async function searchableQuery(page: Page): Promise<string | null> {
	for (const query of ['the', 'an', 'of', 'in']) {
		const response = await page.request.get(`/api/search?q=${query}&limit=6`);
		if (!response.ok()) continue;
		const body = (await response.json()) as { results?: unknown[] };
		if ((body.results ?? []).length > 0) return query;
	}
	return null;
}

async function openWithShortcut(page: Page) {
	await page.keyboard.press('Control+k');
	await expect(dialog(page)).toBeVisible();
	await expect(input(page)).toBeFocused();
}

test.describe('Search palette', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await gotoHydrated(page, '/');
	});

	test('Ctrl+K opens it with the input focused, and Ctrl+K again closes it', async ({ page }) => {
		await openWithShortcut(page);
		await expect(dialog(page).getByText('Go to', { exact: true })).toBeVisible();
		await page.keyboard.press('Control+k');
		await expect(dialog(page)).toBeHidden();
	});

	test('Cmd+K opens it too', async ({ page }) => {
		await page.keyboard.press('Meta+k');
		await expect(dialog(page)).toBeVisible();
	});

	test('"/" opens it, but not while typing in a field', async ({ page }) => {
		await page.keyboard.press('/');
		await expect(dialog(page)).toBeVisible();
		await expect(input(page)).toBeFocused();
		// Typing "/" inside the palette input is a plain character.
		await page.keyboard.type('a/b');
		await expect(input(page)).toHaveValue('a/b');
		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();

		await page.getByRole('searchbox', { name: 'Search the catalogue' }).click();
		await page.keyboard.type('x/y');
		await expect(page.getByRole('searchbox', { name: 'Search the catalogue' })).toHaveValue('x/y');
		await expect(dialog(page)).toBeHidden();
	});

	test('Escape closes it and focus goes back to where it was', async ({ page }) => {
		const link = page.getByRole('link', { name: 'Movies', exact: true }).first();
		await link.focus();
		await openWithShortcut(page);
		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();
		await expect(link).toBeFocused();
	});

	test('a click outside the card closes it', async ({ page }) => {
		await openWithShortcut(page);
		await page.mouse.click(1240, 760);
		await expect(dialog(page)).toBeHidden();
	});

	test('the header shortcut button opens it and Escape returns focus to the button', async ({
		page
	}) => {
		const opener = page.getByRole('button', { name: /^Quick search/ });
		await expect(opener).toHaveText(/Ctrl K|⌘K/);
		await opener.click();
		await expect(dialog(page)).toBeVisible();
		await expect(input(page)).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();
		await expect(opener).toBeFocused();
	});

	test('the phone header search icon opens it', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator('header').getByRole('link', { name: 'Search' }).click();
		await expect(dialog(page)).toBeVisible();
		await expect(input(page)).toBeFocused();
	});

	test('the page behind is inert and the page cannot scroll while it is open', async ({ page }) => {
		await openWithShortcut(page);
		const state = () =>
			page.evaluate(() =>
				[...document.body.children].map((child) => ({
					inert: (child as HTMLElement).inert,
					hasDialog: child.matches('[role="dialog"], [data-dialog-overlay]')
				}))
			);

		const open = await state();
		expect(open.some((child) => child.hasDialog && !child.inert)).toBe(true);
		expect(open.filter((child) => !child.hasDialog).every((child) => child.inert)).toBe(true);
		// The page does not scroll under the palette either.
		expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

		// Tab never leaves the card, however many times it is pressed.
		for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
		expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
			true
		);

		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();
		expect((await state()).some((child) => child.inert)).toBe(false);
	});

	test('typing shows film results with year and rating, under a Movies group', async ({ page }) => {
		const query = await searchableQuery(page);
		test.skip(!query, 'needs catalogue data');
		await openWithShortcut(page);
		await page.keyboard.type(query as string);
		await expect(movieOptions(page).first()).toBeVisible();
		await expect(dialog(page).getByText('Movies', { exact: true })).toBeVisible();
		expect(await movieOptions(page).count()).toBeLessThanOrEqual(6);
		await expect(movieOptions(page).first()).toContainText(/\b(19|20)\d{2}\b/);
		await expect(dialog(page).getByRole('listbox', { name: 'Results' })).toHaveAttribute(
			'aria-busy',
			'false'
		);
		// "See all results" leads the list so Enter is predictable.
		await expect(dialog(page).getByRole('option').first()).toHaveText(
			new RegExp(`See all results for .${query}.`)
		);
	});

	test('ArrowDown then Enter opens that film page', async ({ page }) => {
		const query = await searchableQuery(page);
		test.skip(!query, 'needs catalogue data');
		await openWithShortcut(page);
		await page.keyboard.type(query as string);
		await expect(movieOptions(page).first()).toBeVisible();

		await page.keyboard.press('ArrowDown');
		const active = activeOption(page);
		await expect(active).toHaveAttribute('data-kind', 'movie');
		const value = await active.getAttribute('data-value');
		const id = (value ?? '').replace(/^movie:/, '');
		expect(id).not.toBe('');
		await expect(input(page)).toHaveAttribute('aria-activedescendant', /.+/);

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(new RegExp(`/movies/${id}$`));
		await expect(dialog(page)).toBeHidden();
	});

	test('Enter on free text goes to the search page with that query', async ({ page }) => {
		await openWithShortcut(page);
		await page.keyboard.type('no such film xyzzy');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/search\?q=no%20such%20film%20xyzzy$/);
		await expect(dialog(page)).toBeHidden();
	});

	test('a submitted search is listed under Recent searches next time, and can be cleared', async ({
		page
	}) => {
		await openWithShortcut(page);
		await page.keyboard.type('zzqq recent');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/search\?q=zzqq%20recent/);

		await openWithShortcut(page);
		await expect(dialog(page).getByText('Recent searches', { exact: true })).toBeVisible();
		const recent = dialog(page).locator('[role="option"][data-kind="recent"]');
		await expect(recent).toHaveCount(1);
		await expect(recent.first()).toHaveText(/zzqq recent/);
		expect(await page.evaluate(() => localStorage.getItem('ui:recent-searches'))).toBe(
			JSON.stringify(['zzqq recent'])
		);

		await dialog(page).getByRole('option', { name: 'Clear recent searches' }).click();
		await expect(recent).toHaveCount(0);
		await expect(dialog(page)).toBeVisible();
		await expect(input(page)).toBeFocused();
		expect(await page.evaluate(() => localStorage.getItem('ui:recent-searches'))).toBeNull();
	});

	test('a recent search re-runs when chosen', async ({ page }) => {
		await page.evaluate(() =>
			localStorage.setItem('ui:recent-searches', JSON.stringify(['heat', 'alien']))
		);
		await openWithShortcut(page);
		const recent = dialog(page).locator('[role="option"][data-kind="recent"]');
		await expect(recent).toHaveText([/heat/, /alien/]);
		await recent.nth(1).click();
		await expect(page).toHaveURL(/\/search\?q=alien$/);
	});

	test('the Go to group opens pages', async ({ page }) => {
		await openWithShortcut(page);
		await dialog(page).getByRole('option', { name: 'Discover' }).click();
		await expect(page).toHaveURL(/\/discover$/);
		await expect(dialog(page)).toBeHidden();
	});

	test('one character never calls the API', async ({ page }) => {
		let calls = 0;
		await page.route('**/api/search**', (route) => {
			calls += 1;
			return route.continue();
		});
		await openWithShortcut(page);
		await page.keyboard.type('a');
		await expect(
			dialog(page).getByText('Type at least 2 characters to preview films')
		).toBeVisible();
		await page.waitForTimeout(500);
		expect(calls).toBe(0);
	});

	test('shows skeleton rows with aria-busy while loading', async ({ page }) => {
		await page.route('**/api/search**', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1200));
			await route.fulfill({ json: { query: 'slow', results: [] } });
		});
		await openWithShortcut(page);
		await page.keyboard.type('slow');
		const list = dialog(page).getByRole('listbox', { name: 'Results' });
		await expect(list).toHaveAttribute('aria-busy', 'true');
		await expect(dialog(page).locator('.kit-palette-skeleton')).toHaveCount(4);
		await expect(list).toHaveAttribute('aria-busy', 'false');
		await expect(dialog(page).locator('.kit-palette-skeleton')).toHaveCount(0);
	});

	test('says so when no film matches and offers the catalogue', async ({ page }) => {
		await page.route('**/api/search**', (route) =>
			route.fulfill({ json: { query: 'zzzz', results: [] } })
		);
		await openWithShortcut(page);
		await page.keyboard.type('zzzz');
		await expect(dialog(page).locator('.kit-palette-note')).toHaveText('No films match “zzzz”');
		await expect(dialog(page).getByRole('status')).toHaveText('No films match “zzzz”');
		await dialog(page).getByRole('option', { name: 'Browse all films' }).click();
		await expect(page).toHaveURL(/\/movies$/);
	});

	test('reports an unavailable search with an alert and recovers on retry', async ({ page }) => {
		let fail = true;
		await page.route('**/api/search**', (route) =>
			fail
				? route.fulfill({ status: 500, json: { error: 'down' } })
				: route.fulfill({
						json: {
							query: 'matrix',
							results: [
								{
									id: 'abc-123',
									title: 'The Matrix',
									releaseDate: '1999-03-31',
									posterPath: null,
									voteAverage: '8.2'
								}
							]
						}
					})
		);
		await openWithShortcut(page);
		await page.keyboard.type('matrix');
		await expect(dialog(page).getByRole('alert')).toHaveText('Search is unavailable right now');

		fail = false;
		await dialog(page).getByRole('option', { name: 'Try again' }).click();
		await expect(dialog(page).getByRole('alert')).toHaveCount(0);
		await expect(movieOptions(page)).toHaveCount(1);
		await expect(movieOptions(page).first()).toContainText('The Matrix');
		await expect(input(page)).toBeFocused();
	});

	test('ignores a slow answer to an older query', async ({ page }) => {
		const film = (id: string, title: string) => ({
			id,
			title,
			releaseDate: '2000-01-01',
			posterPath: null,
			voteAverage: '7.0'
		});
		await page.route('**/api/search**', async (route) => {
			const q = new URL(route.request().url()).searchParams.get('q');
			if (q === 'ol') {
				await new Promise((resolve) => setTimeout(resolve, 1500));
				return route.fulfill({ json: { query: q, results: [film('old-1', 'Old Answer')] } });
			}
			return route.fulfill({ json: { query: q, results: [film('new-1', 'New Answer')] } });
		});
		await openWithShortcut(page);
		await page.keyboard.type('ol');
		await page.waitForTimeout(350); // past the debounce: the slow request is in flight
		await page.keyboard.type('d new');
		await expect(movieOptions(page)).toHaveText([/New Answer/]);
		await page.waitForTimeout(1500);
		await expect(movieOptions(page)).toHaveText([/New Answer/]);
	});

	test('fits a 320px screen without horizontal overflow, list scrolling inside the card', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 480 });
		const query = await searchableQuery(page);
		await openWithShortcut(page);
		if (query) {
			await page.keyboard.type(query);
			await expect(movieOptions(page).first()).toBeVisible();
		}

		const metrics = await page.evaluate(() => {
			const card = document.querySelector('.kit-palette') as HTMLElement;
			const list = document.querySelector('.kit-palette-list') as HTMLElement;
			const box = card.getBoundingClientRect();
			return {
				overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				left: box.left,
				right: window.innerWidth - box.right,
				bottom: box.bottom,
				viewport: window.innerHeight,
				listScrolls: list.scrollHeight > list.clientHeight
			};
		});
		expect(metrics.overflow).toBe(0);
		expect(metrics.left).toBeCloseTo(16, 0);
		expect(metrics.right).toBeCloseTo(16, 0);
		expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewport);
		if (query) expect(metrics.listScrolls).toBe(true);
	});

	test('rows are at least 44px tall', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openWithShortcut(page);
		// The opening animation scales the panel slightly; measure the settled layout.
		await dialog(page).evaluate((panel) =>
			Promise.all(
				panel
					.getAnimations({ subtree: true })
					.filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
					.map((animation) => animation.finished)
			)
		);
		for (const option of await dialog(page).getByRole('option').all()) {
			expect((await option.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('has no serious or critical accessibility violations while open', async ({ page }) => {
		const query = await searchableQuery(page);
		await openWithShortcut(page);

		const scan = async () => {
			const result = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			return result.violations.filter(
				(violation) => violation.impact === 'serious' || violation.impact === 'critical'
			);
		};

		const empty = await scan();
		expect(empty, JSON.stringify(empty, null, 2)).toEqual([]);

		if (query) {
			await page.keyboard.type(query);
			await expect(movieOptions(page).first()).toBeVisible();
			const withResults = await scan();
			expect(withResults, JSON.stringify(withResults, null, 2)).toEqual([]);
		}
	});

	test('the shortcut hint stays AA-contrast on the transparent and the scrolled bar', async ({
		page
	}) => {
		const contrast = async () => {
			const result = await new AxeBuilder({ page })
				.include('header')
				.withRules(['color-contrast'])
				.analyze();
			return result.violations;
		};
		const top = await contrast();
		expect(top, JSON.stringify(top, null, 2)).toEqual([]);
		await page.evaluate(() => window.scrollTo(0, 400));
		await expect(page.locator('header.bar.scrolled')).toBeVisible();
		const scrolled = await contrast();
		expect(scrolled, JSON.stringify(scrolled, null, 2)).toEqual([]);
	});

	test('the header search form still submits to /search without the palette', async ({ page }) => {
		// The form carries its own action, so it also works before (or without) hydration.
		const form = page.locator('header form[role="search"]');
		await expect(form).toHaveAttribute('action', '/search');
		await expect(form).toHaveAttribute('method', 'get');

		const box = page.getByRole('searchbox', { name: 'Search the catalogue' });
		await box.fill('blade runner');
		await box.press('Enter');
		await expect(page).toHaveURL(/\/search\?q=blade%20runner$/);
		await expect(dialog(page)).toBeHidden();
	});
});
