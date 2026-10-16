import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// The first page shows 24 films; "Load more" adds the next 24.
const PAGE_SIZE = 24;

test.describe.configure({ timeout: 90_000 });

const films = (page: Page) => page.getByRole('list', { name: 'Films' }).getByRole('link');
const countLine = (page: Page) => page.locator('.count');
const group = (page: Page, name: string) => page.getByRole('group', { name });
const loadMore = (page: Page) => page.getByRole('link', { name: 'Load more' });

async function totalFilms(page: Page): Promise<number> {
	const match = /of (\d+) films?/u.exec(await countLine(page).innerText());
	return match ? Number(match[1]) : 0;
}

test.describe('Browse: filters', () => {
	test('a genre chip filters the grid, updates the address and the count', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await gotoHydrated(page, '/movies');
		await expect(page.getByRole('heading', { level: 1, name: 'Movies' })).toBeVisible();

		const genres = group(page, 'Genre').getByRole('link');
		test.skip((await genres.count()) < 2, 'needs genres in the catalogue');
		const before = await countLine(page).innerText();
		const genre = genres.nth(1);
		const name = (await genre.innerText()).trim();

		await genre.click();

		await expect(page).toHaveURL(/\/movies\?genre=\d+$/u);
		await expect(genre).toHaveAttribute('aria-current', 'true');
		await expect(group(page, 'Genre').getByRole('link', { name: 'All' })).not.toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(countLine(page)).toContainText(`· ${name}`);
		await expect(countLine(page)).not.toHaveText(before);
		await expect(page.getByRole('heading', { level: 1, name: 'Movies' })).toBeVisible();
	});

	test('combines a rating and a sort, and the films obey both', async ({ page }) => {
		await gotoHydrated(page, '/movies');

		await group(page, 'Rating').getByRole('link', { name: '7+' }).click();
		await expect(page).toHaveURL(/\/movies\?rating=7$/u);
		await group(page, 'Sort').getByRole('link', { name: 'Top rated' }).click();
		await expect(page).toHaveURL(/\/movies\?rating=7&sort=rating$/u);
		await expect(countLine(page)).toContainText('7+ rating · Top rated');
		await expect(group(page, 'Rating').getByRole('link', { name: '7+' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(group(page, 'Sort').getByRole('link', { name: 'Top rated' })).toHaveAttribute(
			'aria-current',
			'true'
		);

		const scores = (
			await page.getByRole('list', { name: 'Films' }).locator('.rating .value').allInnerTexts()
		).map(Number);
		test.skip(scores.length === 0, 'no film is rated 7 or more');
		for (const score of scores) expect(score).toBeGreaterThanOrEqual(7);
		expect(scores).toEqual([...scores].sort((a, b) => b - a));
	});

	test('changing a filter does not jump the page, and keyboard focus stays on the chip', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 700 });
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < PAGE_SIZE, 'needs a full page of films');

		await page.evaluate(() => window.scrollTo(0, 500));
		const sort = group(page, 'Sort').getByRole('link', { name: 'Top rated' });
		await sort.focus();
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/sort=rating$/u);
		await expect(sort).toHaveAttribute('aria-current', 'true');
		await expect(sort).toBeFocused();
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
	});

	test('arrow keys move between the chips of a strip', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		const genres = group(page, 'Genre').getByRole('link');
		test.skip((await genres.count()) < 3, 'needs genres in the catalogue');

		await genres.nth(0).focus();
		await page.keyboard.press('ArrowRight');
		await expect(genres.nth(1)).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(genres.nth(2)).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(genres.nth(1)).toBeFocused();
	});

	test('Clear filters resets everything and keeps focus in the filter bar', async ({ page }) => {
		await gotoHydrated(page, '/movies?rating=7&sort=rating');
		const clear = page.getByRole('link', { name: 'Clear filters' });
		await expect(clear).toBeVisible();

		await clear.click();

		await expect(page).toHaveURL(/\/movies$/u);
		await expect(clear).toHaveCount(0);
		await expect(countLine(page)).not.toContainText('Top rated');
		await expect(
			page.getByRole('navigation', { name: 'Filter films' }).locator(':focus')
		).toHaveCount(1);
	});

	test('a search with no match explains itself and offers a way back', async ({ page }) => {
		await gotoHydrated(page, '/movies?genre=999999');

		await expect(page.getByRole('heading', { name: 'No films match these filters' })).toBeVisible();
		await expect(countLine(page)).toContainText('No films match');
		await page.getByRole('main').getByRole('link', { name: 'Clear filters' }).last().click();

		await expect(page).toHaveURL(/\/movies$/u);
		await expect(page.getByRole('heading', { name: 'No films match these filters' })).toHaveCount(
			0
		);
	});

	test('the filter bar stays under the top bar while the grid scrolls', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < PAGE_SIZE, 'needs a full page of films');

		await page.evaluate(() => window.scrollTo(0, 1200));
		const bar = page.getByRole('navigation', { name: 'Filter films' });
		await expect
			.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1))
			.toBeGreaterThanOrEqual(55);
		expect((await bar.boundingBox())?.y ?? 999).toBeLessThanOrEqual(70);
	});
});

test.describe('Browse: paging', () => {
	test('Load more appends films, keeps ?page= current and does not stack history', async ({
		page
	}) => {
		await gotoHydrated(page, '/movies');
		test.skip((await loadMore(page).count()) === 0, 'needs more than one page of films');
		const total = await totalFilms(page);
		await expect(films(page)).toHaveCount(PAGE_SIZE);
		const history = await page.evaluate(() => window.history.length);

		await loadMore(page).click();

		await expect(films(page)).toHaveCount(PAGE_SIZE * 2);
		await expect(page).toHaveURL(/\/movies\?page=2$/u);
		await expect(countLine(page)).toHaveText(`Showing ${PAGE_SIZE * 2} of ${total} films`);
		await expect(page.getByRole('status').filter({ hasText: 'more films loaded' })).toHaveText(
			`${PAGE_SIZE} more films loaded.`
		);
		// Keyboard focus stays on the button so the next press loads the next page.
		await expect(loadMore(page)).toBeFocused();
		expect(await page.evaluate(() => window.history.length)).toBe(history);
	});

	test('shows skeletons while a page loads and keeps the films already shown', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		test.skip((await loadMore(page).count()) === 0, 'needs more than one page of films');
		await page.route('**/movies/__data.json*', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});

		await loadMore(page).click();

		await expect(page.locator('li.placeholder')).toHaveCount(6);
		await expect(page.getByRole('region', { name: 'Results' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
		await expect(films(page)).toHaveCount(PAGE_SIZE);
		await expect(films(page)).toHaveCount(PAGE_SIZE * 2);
		await expect(page.locator('li.placeholder')).toHaveCount(0);
	});

	test('a failed Load more keeps the films on screen and offers a retry', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		test.skip((await loadMore(page).count()) === 0, 'needs more than one page of films');
		// What the loader answers when the catalogue read fails: a normal response flagged as
		// unavailable (SvelteKit's devalue encoding of {items: [], unavailable: true, ...}).
		const unavailable = {
			type: 'data',
			nodes: [
				{ type: 'skip' },
				{ type: 'skip' },
				{
					type: 'data',
					data: [
						{ items: 1, genres: 2, filters: 3, pagination: 6, unavailable: 10 },
						[],
						[],
						{ genreId: 4, decade: 4, minRating: 4, sortBy: 5 },
						null,
						'popularity',
						{ page: 7, pageSize: 8, totalCount: 9, totalPages: 9 },
						2,
						PAGE_SIZE,
						0,
						true
					],
					uses: { search_params: ['page', 'genre', 'decade', 'rating', 'sort'] }
				}
			]
		};
		await page.route('**/movies/__data.json*', (route) =>
			route.fulfill({ contentType: 'application/json', body: JSON.stringify(unavailable) })
		);

		await loadMore(page).click();

		await expect(
			page.getByRole('heading', { name: 'More films could not be loaded' })
		).toBeVisible();
		await expect(films(page)).toHaveCount(PAGE_SIZE);
		await expect(countLine(page)).toHaveText('Some films could not be loaded');
		await expect(loadMore(page)).toHaveCount(0);

		await page.unroute('**/movies/__data.json*');
		await page.getByRole('button', { name: 'Try again' }).click();

		await expect(films(page)).toHaveCount(PAGE_SIZE * 2);
		await expect(page.getByRole('heading', { name: 'More films could not be loaded' })).toHaveCount(
			0
		);
	});

	test('coming back from a film restores the films that were loaded', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		test.skip((await loadMore(page).count()) === 0, 'needs more than one page of films');
		await loadMore(page).click();
		await expect(films(page)).toHaveCount(PAGE_SIZE * 2);

		const film = films(page).nth(PAGE_SIZE + 4);
		const href = (await film.getAttribute('href')) as string;
		await film.scrollIntoViewIfNeeded();
		const before = await page.evaluate(() => window.scrollY);
		await film.click();
		await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));

		await page.goBack();

		await expect(page).toHaveURL(/\/movies\?page=2$/u);
		await expect(films(page)).toHaveCount(PAGE_SIZE * 2);
		await expect(countLine(page)).toContainText(`Showing ${PAGE_SIZE * 2} of`);
		// The visitor lands where they left, not a page of films further down.
		await expect
			.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - before))
			.toBeLessThan(120);
		await expect(page.locator(`a[href="${href}"]`)).toBeInViewport();
	});

	test('a filter change shows a skeleton grid until the new films arrive', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < PAGE_SIZE, 'needs a full page of films');
		await page.route('**/movies/__data.json*', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});

		await group(page, 'Sort').getByRole('link', { name: 'Newest' }).click();

		const loading = page.getByRole('list', { name: 'Loading films' });
		await expect(loading).toBeVisible();
		await expect(loading.locator('li')).toHaveCount(PAGE_SIZE);
		await expect(page.getByRole('list', { name: 'Films' })).toBeVisible();
		await expect(loading).toHaveCount(0);
		await expect(countLine(page)).toContainText('Newest');
	});

	test('a deep link to page 3 shows that page, and earlier films can be added in front', async ({
		page
	}) => {
		await gotoHydrated(page, '/movies');
		test.skip((await totalFilms(page)) <= PAGE_SIZE * 2, 'needs at least three pages of films');
		const total = await totalFilms(page);
		const lastOnPage3 = Math.min(total, PAGE_SIZE * 3);

		await gotoHydrated(page, '/movies?page=3');
		await expect(countLine(page)).toContainText(
			`Showing ${PAGE_SIZE * 2 + 1}–${lastOnPage3} of ${total}`
		);
		const earlier = page.getByRole('link', { name: 'Show earlier films' });
		await expect(earlier).toHaveAttribute('href', '/movies?page=2');

		await earlier.click();
		await expect(page).toHaveURL(/\/movies\?page=2$/u);
		await expect(countLine(page)).toContainText(`Showing ${PAGE_SIZE + 1}–${lastOnPage3} of`);
		await expect(earlier).toHaveAttribute('href', '/movies');

		await earlier.click();
		await expect(page).toHaveURL(/\/movies$/u);
		await expect(earlier).toHaveCount(0);
		await expect(films(page)).toHaveCount(lastOnPage3);
		// The link that was pressed is gone, so focus moves to the first film that was added.
		await expect(page.getByRole('list', { name: 'Films' }).locator(':focus')).toHaveCount(1);
	});

	test('loading the last page removes the button and moves focus onto a film', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		const lastPage = Math.ceil((await totalFilms(page)) / PAGE_SIZE);
		test.skip(lastPage < 2, 'needs more than one page of films');

		await gotoHydrated(page, lastPage - 1 > 1 ? `/movies?page=${lastPage - 1}` : '/movies');
		await loadMore(page).click();

		await expect(page).toHaveURL(new RegExp(`page=${lastPage}$`, 'u'));
		await expect(loadMore(page)).toHaveCount(0);
		await expect(page.getByText('That is every film for these filters.')).toBeVisible();
		await expect(page.getByRole('list', { name: 'Films' }).locator(':focus')).toHaveCount(1);
	});

	test('the first screen of artwork loads eagerly and the rest lazily', async ({ page }) => {
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < PAGE_SIZE, 'needs a full page of films');

		const loading = await page.evaluate(() =>
			[...document.querySelectorAll('ul[aria-label="Films"] > li')].map(
				(item) => item.querySelector('img')?.getAttribute('loading') ?? null
			)
		);
		expect(loading.slice(0, 6).filter((value) => value === 'lazy')).toEqual([]);
		expect(loading.slice(6).filter((value) => value === 'eager')).toEqual([]);
	});
});

test.describe('Browse: addresses, SEO and errors', () => {
	test('the legacy catalogue address redirects permanently and keeps the filters', async ({
		page,
		request
	}) => {
		const response = await request.get('/movies/catalog?genre=28&sort=rating', {
			maxRedirects: 0
		});
		expect(response.status()).toBe(308);
		expect(response.headers().location).toMatch(/\/movies\?genre=28&sort=rating$/u);

		await page.goto('/movies/catalog?genre=28');
		await expect(page).toHaveURL(/\/movies\?genre=28$/u);
		await expect(page.getByRole('heading', { level: 1, name: 'Movies' })).toBeVisible();
	});

	test('an invalid filter shows the 400 error page, not a crash or an empty grid', async ({
		page
	}) => {
		const response = await page.goto('/movies?genre=abc');

		expect(response?.status()).toBe(400);
		await expect(page.getByLabel('Error 400')).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('list', { name: 'Films' })).toHaveCount(0);
	});

	test('is indexable only without filters or paging, and always canonical', async ({ page }) => {
		await page.goto('/movies');
		await expect(page).toHaveTitle("Browse movies | Alan's Database");
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://alandatabase.com/movies'
		);
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

		await page.goto('/movies?genre=28&sort=rating');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://alandatabase.com/movies'
		);
	});
});

test.describe('Browse: small screens', () => {
	test('has no horizontal overflow at 320px and the chip strips scroll inside themselves', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/movies');

		const sizes = await page.evaluate(() => ({
			page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			strips: [...document.querySelectorAll('nav[aria-label="Filter films"] .scroller')].map(
				(strip) => strip.scrollWidth > strip.clientWidth
			)
		}));
		expect(sizes.page).toBeLessThanOrEqual(0);
		expect(sizes.strips.length).toBeGreaterThan(0);
		expect(sizes.strips.at(-1)).toBe(true);

		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBeLessThanOrEqual(0);
	});

	test('the grid keeps two columns at 320px with touch-sized chips', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < 2, 'needs films');

		const [first, second] = await Promise.all([
			films(page).nth(0).boundingBox(),
			films(page).nth(1).boundingBox()
		]);
		expect(first && second && Math.abs(first.y - second.y) < 2).toBe(true);
		for (const chip of await group(page, 'Sort').getByRole('link').all()) {
			expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(40);
		}
	});
});

test.describe('Browse: phone filters', () => {
	const filtersButton = (page: Page) => page.getByRole('button', { name: /^Filters/u });
	const sheet = (page: Page) => page.getByRole('dialog', { name: 'Filters' });

	test('below 768px a Filters button opens every Sort, Decade and Rating chip in a sheet', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/movies');

		await expect(filtersButton(page)).toBeVisible();
		expect((await filtersButton(page).boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await expect(page.locator('#browse-filters-summary')).toHaveText(
			'Popular · Any decade · Any rating'
		);
		await expect(filtersButton(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(group(page, 'Rating')).toHaveCount(0);

		await filtersButton(page).click();

		await expect(sheet(page)).toBeVisible();
		await expect(filtersButton(page)).toHaveAttribute('aria-expanded', 'true');
		for (const name of ['Sort', 'Decade', 'Rating']) {
			await expect(group(page, name)).toBeVisible();
		}
		const chips = await sheet(page).getByRole('link').all();
		expect(chips).toHaveLength(15);
		for (const chip of chips) {
			await expect
				.poll(async () => (await chip.boundingBox())?.height ?? 0)
				.toBeGreaterThanOrEqual(44);
			const box = await chip.boundingBox();
			expect((box?.x ?? 999) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
		}
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBeLessThanOrEqual(0);
	});

	test('a chip in the sheet filters, closes the sheet and hands focus back to Filters', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await gotoHydrated(page, '/movies');

		await filtersButton(page).click();
		await group(page, 'Rating').getByRole('link', { name: '7+' }).click();

		await expect(page).toHaveURL(/\/movies\?rating=7$/u);
		await expect(sheet(page)).toHaveCount(0);
		await expect(filtersButton(page)).toBeFocused();
		await expect(filtersButton(page)).toHaveAccessibleName('Filters · 1 active');
		await expect(page.locator('#browse-filters-summary')).toHaveText(
			'Popular · Any decade · 7+ rating'
		);
		await expect(countLine(page)).toContainText('7+ rating');

		// The same flow from the keyboard, then Escape also returns focus.
		await page.keyboard.press('Enter');
		await expect(sheet(page)).toBeVisible();
		await expect(group(page, 'Rating').getByRole('link', { name: '7+' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await group(page, 'Decade').getByRole('link', { name: '2010s' }).focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/movies\?decade=2010&rating=7$/u);
		await expect(sheet(page)).toHaveCount(0);
		await expect(filtersButton(page)).toBeFocused();
		await expect(filtersButton(page)).toHaveAccessibleName('Filters · 2 active');

		await page.keyboard.press('Enter');
		await expect(sheet(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(sheet(page)).toHaveCount(0);
		await expect(filtersButton(page)).toBeFocused();
	});

	test('from 768px the desktop strip stays and there is no Filters button', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 900 });
		await gotoHydrated(page, '/movies');

		await expect(filtersButton(page)).toHaveCount(0);
		for (const name of ['Sort', 'Decade', 'Rating']) {
			await expect(group(page, name)).toHaveCount(1);
		}
	});

	test('on a short phone screen the sticky filter bar stays compact', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await gotoHydrated(page, '/movies');
		test.skip((await films(page).count()) < PAGE_SIZE, 'needs a full page of films');

		await page.evaluate(() => window.scrollTo(0, 1200));
		const bar = page.getByRole('navigation', { name: 'Filter films' });
		await expect
			.poll(async () => Math.round((await bar.boundingBox())?.y ?? -1))
			.toBeGreaterThanOrEqual(55);
		const box = await bar.boundingBox();
		expect(box?.y ?? 999).toBeLessThanOrEqual(70);
		// The genre strip (50px) plus the 44px Filters row, with no extra padding.
		expect(box?.height).toBeLessThanOrEqual(96);
	});
});

test.describe('Browse: without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a phone keeps the Sort, Decade and Rating chips as working links', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/movies');

		await expect(page.getByRole('button', { name: /^Filters/u })).toHaveCount(0);
		await group(page, 'Rating').getByRole('link', { name: '7+' }).click();
		await expect(page).toHaveURL(/\/movies\?rating=7$/u);
		await expect(countLine(page)).toContainText('7+ rating');
	});

	test('every filter chip and Load more are plain links that still work', async ({ page }) => {
		await page.goto('/movies');
		await expect(page.getByRole('heading', { level: 1, name: 'Movies' })).toBeVisible();

		await group(page, 'Sort').getByRole('link', { name: 'Top rated' }).click();
		await expect(page).toHaveURL(/\/movies\?sort=rating$/u);
		await expect(countLine(page)).toContainText('Top rated');

		test.skip((await loadMore(page).count()) === 0, 'needs more than one page of films');
		await loadMore(page).click();
		await expect(page).toHaveURL(/\/movies\?sort=rating&page=2$/u);
		await expect(page.getByRole('link', { name: 'Show earlier films' })).toHaveAttribute(
			'href',
			'/movies?sort=rating'
		);
	});
});
