import { existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { firstMovieHref } from './helpers';

const publicRoutes = [
	'/',
	'/about',
	'/movies',
	'/tv',
	'/discover',
	'/picker',
	'/search',
	'/search?q=the',
	'/auth/login',
	'/auth/register',
	'/status',
	'/disclaimer',
	'/kit',
	'/does-not-exist'
];

// Signed-in pages run when E2E_OWNER_STATE points at a Playwright storage state of a signed-in owner.
const OWNER_STATE = process.env.E2E_OWNER_STATE;
const HAS_OWNER = Boolean(OWNER_STATE && existsSync(OWNER_STATE));
const ownerRoutes = [
	'/my/films',
	'/my/films?tab=local',
	'/my/films?tab=watchlist',
	'/my/films?tab=stats',
	'/my/lists',
	'/my/lists/create'
];

async function blockingViolations(page: Page) {
	const scan = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	return scan.violations.filter(
		(violation) => violation.impact === 'serious' || violation.impact === 'critical'
	);
}

test.describe('WCAG 2.2 AA critical surfaces', () => {
	for (const route of publicRoutes) {
		test(`${route} has no serious or critical automated violations`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			const violations = await blockingViolations(page);
			expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
		});
	}
});

test.describe('WCAG 2.2 AA detail pages', () => {
	test('a real film page has no serious or critical automated violations', async ({ page }) => {
		const href = await firstMovieHref(page);
		test.skip(!href, 'needs catalogue data');

		await page.goto(href as string, { waitUntil: 'domcontentloaded' });
		const violations = await blockingViolations(page);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	});

	test('a series page and a person page have no serious or critical violations', async ({
		page
	}) => {
		await page.goto('/tv', { waitUntil: 'domcontentloaded' });
		const series = await page.locator('a[href^="/tv/"]').first().getAttribute('href');
		test.skip(!series, 'needs the TV chart');
		await page.goto(series as string, { waitUntil: 'domcontentloaded' });
		let violations = await blockingViolations(page);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);

		const film = await firstMovieHref(page);
		test.skip(!film, 'needs catalogue data');
		await page.goto(film as string, { waitUntil: 'domcontentloaded' });
		const person = await page.locator('a[href^="/people/"]').first().getAttribute('href');
		test.skip(!person, 'needs cast data');
		await page.goto(person as string, { waitUntil: 'domcontentloaded' });
		violations = await blockingViolations(page);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	});
});

test.describe('WCAG 2.2 AA signed-in pages', () => {
	test.skip(!HAS_OWNER, 'needs E2E_OWNER_STATE');
	test.use({ storageState: HAS_OWNER ? OWNER_STATE : undefined });

	for (const route of ownerRoutes) {
		test(`${route} has no serious or critical automated violations`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			const violations = await blockingViolations(page);
			expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
		});
	}
});
