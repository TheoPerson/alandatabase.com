import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const FIELD_NAME = 'Movie title';
const NO_MATCH = 'zzqq-no-such-film-xxjj';

const field = (page: Page) => page.getByRole('searchbox', { name: FIELD_NAME });
const results = (page: Page) => page.getByRole('region', { name: 'Search results' });
const resultCards = (page: Page) => results(page).locator('a.card');

// Faults a visitor could hit: script errors, console errors and hydration warnings. A blocked
// third-party request (telemetry) is a network event, not a page fault.
function watchConsole(page: Page): string[] {
	const problems: string[] = [];
	page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		const text = message.text();
		if (message.type() === 'error' && !/Failed to load resource/u.test(text)) problems.push(text);
		if (message.type() === 'warning' && /hydrat/iu.test(text)) problems.push(text);
	});
	return problems;
}

// A title that is certainly in the catalogue: the first one the empty page offers.
async function popularTitle(page: Page): Promise<string | null> {
	await gotoHydrated(page, '/search');
	const first = page
		.getByRole('region', { name: 'Popular right now' })
		.locator('a.card .title')
		.first();
	if ((await first.count()) === 0) return null;
	return (await first.innerText()).slice(0, 100);
}

function isDescendingNullsLast(values: Array<number | null>): boolean {
	let previous = Number.POSITIVE_INFINITY;
	let seenNull = false;
	for (const value of values) {
		if (value === null) {
			seenNull = true;
		} else if (seenNull || value > previous) {
			return false;
		} else {
			previous = value;
		}
	}
	return true;
}

test.describe('Search page', () => {
	test('the empty page offers the field, popular films and genre links', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const problems = watchConsole(page);
		await gotoHydrated(page, '/search');

		await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
		await expect(page.getByRole('search', { name: 'Search films' })).toBeVisible();
		await expect(field(page)).toBeFocused();
		await expect(page).toHaveTitle("Search | Alan's Database");
		await expect(page.locator('main')).toHaveCount(1);

		const popular = page.getByRole('region', { name: 'Popular right now' });
		test.skip((await popular.count()) === 0, 'needs catalogue data');
		expect(await popular.locator('a.card').count()).toBeGreaterThan(0);
		expect(await popular.locator('a.card').count()).toBeLessThanOrEqual(12);

		const genre = page
			.getByRole('region', { name: 'Browse by genre' })
			.locator('a[href^="/movies?genre="]')
			.first();
		await expect(genre).toBeVisible();
		expect(problems).toEqual([]);
	});

	test('submitting a query shows a results grid, the count and keeps the query in the field', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const problems = watchConsole(page);
		const title = await popularTitle(page);
		test.skip(!title, 'needs catalogue data');

		await field(page).fill(title as string);
		await page.getByRole('button', { name: 'Search', exact: true }).click();

		await expect(page).toHaveURL(/\/search\?q=/u);
		await expect(
			page.getByRole('heading', { level: 1, name: `Results for “${title}”` })
		).toBeVisible();
		await expect(page.getByText(/^\d+ films?$/u)).toBeVisible();
		await expect(resultCards(page).first()).toBeVisible();
		await expect(field(page)).toHaveValue(title as string);
		await expect(page).toHaveTitle(`Results for ${title} | Alan's Database`);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://alandatabase.com/search'
		);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
		expect(problems).toEqual([]);
	});

	test('the page works as a plain GET form without a client navigation', async ({ page }) => {
		const title = await popularTitle(page);
		test.skip(!title, 'needs catalogue data');
		await page.goto(`/search?q=${encodeURIComponent(title as string)}`);

		await expect(field(page)).toHaveValue(title as string);
		await expect(page.getByRole('search', { name: 'Search films' })).toHaveAttribute(
			'method',
			'get'
		);
		await expect(page.getByRole('search', { name: 'Search films' })).toHaveAttribute(
			'action',
			'/search'
		);
		await expect(resultCards(page).first()).toBeVisible();
	});

	test('an unknown query shows the empty state with a way back to browsing', async ({ page }) => {
		await gotoHydrated(page, `/search?q=${NO_MATCH}`);

		await expect(page.getByRole('heading', { name: `No films match “${NO_MATCH}”` })).toBeVisible();
		await expect(page.getByText('0 films')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Browse movies' })).toHaveAttribute(
			'href',
			'/movies'
		);
		await expect(resultCards(page)).toHaveCount(0);
	});

	test('sort chips re-order the loaded results and Best match restores the server order', async ({
		page
	}) => {
		await gotoHydrated(page, '/search?q=a');
		const cards = resultCards(page);
		test.skip((await cards.count()) < 2, 'needs at least two results');

		const hrefs = () =>
			cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
		const ratings = () =>
			cards.evaluateAll((nodes) =>
				nodes.map((node) => {
					const value = node.querySelector('.rating .value')?.textContent;
					return value ? Number(value) : null;
				})
			);
		const years = () =>
			cards.evaluateAll((nodes) =>
				nodes.map((node) => {
					const value = node.querySelector('.meta')?.textContent;
					return value ? Number(value) : null;
				})
			);
		const original = await hrefs();

		await expect(page.getByRole('button', { name: 'Best match' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByRole('button', { name: 'Top rated' }).click();
		await expect(page.getByRole('button', { name: 'Top rated' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect.poll(async () => isDescendingNullsLast(await ratings())).toBe(true);
		expect((await hrefs()).slice().sort()).toEqual(original.slice().sort());

		await page.getByRole('button', { name: 'Newest' }).click();
		await expect.poll(async () => isDescendingNullsLast(await years())).toBe(true);

		await page.getByRole('button', { name: 'Best match' }).click();
		await expect.poll(hrefs).toEqual(original);
	});

	test('a query full of markup, quotes and percent signs renders as plain text', async ({
		page
	}) => {
		const problems = watchConsole(page);
		const hostile = `<img src=x onerror="window.__xss=1"> <script>window.__xss=2</script> "q" 'r' & 100%`;
		await gotoHydrated(page, `/search?q=${encodeURIComponent(hostile)}`);

		await expect(
			page.getByRole('heading', { level: 1, name: `Results for “${hostile}”` })
		).toBeVisible();
		await expect(field(page)).toHaveValue(hostile);
		await expect(page.getByText(`No films match “${hostile}”`)).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBe(
			undefined
		);
		await expect(page.locator('main img[src="x"], main script')).toHaveCount(0);
		expect(problems).toEqual([]);

		// A lone percent sign is a literal here, not a wildcard that matches the whole catalogue.
		await gotoHydrated(page, '/search?q=%25');
		await expect(page.getByRole('heading', { name: /^No films match/u })).toBeVisible();
	});

	test('rejects a malformed request with a 400 instead of a server error', async ({ request }) => {
		const response = await request.get(`/search?q=${'a'.repeat(121)}`);
		expect(response.status()).toBe(400);
	});

	test('does not overflow horizontally at 320px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		const title = await popularTitle(page);
		const urls = [
			'/search',
			`/search?q=${NO_MATCH}`,
			`/search?q=${encodeURIComponent('long '.repeat(24))}`
		];
		if (title) urls.push(`/search?q=${encodeURIComponent(title)}`);

		for (const url of urls) {
			await gotoHydrated(page, url);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			const overflow = await page.evaluate(() => ({
				page: document.documentElement.scrollWidth - window.innerWidth,
				body: document.body.scrollWidth - window.innerWidth
			}));
			expect(overflow, url).toEqual({ page: 0, body: 0 });
		}
	});

	test('keyboard: Enter submits, Tab runs field, Search, then the results, and Escape clears', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const title = await popularTitle(page);
		test.skip(!title, 'needs catalogue data');

		await expect(field(page)).toBeFocused();
		await page.keyboard.type(title as string);
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/search\?q=/u);
		await expect(resultCards(page).first()).toBeVisible();
		await expect(field(page)).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect
			.poll(() =>
				page.evaluate(
					() => document.activeElement?.closest('[aria-labelledby="results-heading"]') !== null
				)
			)
			.toBe(true);

		await field(page).focus();
		await page.keyboard.press('Escape');
		await expect(field(page)).toHaveValue('');
		await expect(field(page)).toBeFocused();
	});

	test('the clear button empties the field and returns focus to it', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/search?q=anything');

		const clear = page.getByRole('button', { name: 'Clear text' });
		await expect(clear).toBeVisible();
		expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await clear.click();
		await expect(field(page)).toHaveValue('');
		await expect(field(page)).toBeFocused();
		await expect(clear).toHaveCount(0);
	});

	test('shows a skeleton and a busy region while a slow search is in flight', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const title = await popularTitle(page);
		test.skip(!title, 'needs catalogue data');

		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => (release = resolve));
		await page.route('**/__data.json*', async (route) => {
			await gate;
			await route.continue();
		});

		await field(page).fill(title as string);
		await page.keyboard.press('Enter');

		await expect(page.getByText('Searching…')).toBeVisible();
		await expect(results(page)).toHaveAttribute('aria-busy', 'true');
		await expect(results(page).locator('[aria-hidden="true"]').first()).toBeVisible();
		await expect(resultCards(page)).toHaveCount(0);

		release();
		await expect(resultCards(page).first()).toBeVisible();
		await expect(results(page)).toHaveAttribute('aria-busy', 'false');
		await expect(page.getByText('Searching…')).toHaveCount(0);
	});

	test('shows the error state when the search fails and Try again runs it once more', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const title = await popularTitle(page);
		test.skip(!title, 'needs catalogue data');

		// Flip the loader's searchError flag in the first data response only.
		let failed = false;
		await page.route('**/__data.json*', async (route) => {
			const response = await route.fetch();
			if (failed) return route.fulfill({ response });
			const payload = await response.json();
			for (const node of payload.nodes ?? []) {
				const slots = node?.data;
				if (Array.isArray(slots) && slots[0] && 'searchError' in slots[0]) {
					slots[slots[0].searchError] = true;
					failed = true;
				}
			}
			return route.fulfill({ response, json: payload });
		});

		await field(page).fill(title as string);
		await page.keyboard.press('Enter');

		await expect(
			page.getByRole('heading', { name: 'Search is temporarily unavailable' })
		).toBeVisible();
		await expect(resultCards(page)).toHaveCount(0);

		await page.getByRole('link', { name: 'Try again' }).click();
		await expect(resultCards(page).first()).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Search is temporarily unavailable' })
		).toHaveCount(0);
	});
});
