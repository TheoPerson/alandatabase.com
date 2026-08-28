import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicRoutes = ['/', '/movies', '/search', '/auth/login', '/status'];

test.describe('WCAG 2.2 AA critical surfaces', () => {
	for (const route of publicRoutes) {
		test(`${route} has no serious or critical automated violations`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			const scan = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			const blockingViolations = scan.violations.filter(
				(violation) => violation.impact === 'serious' || violation.impact === 'critical'
			);

			expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
		});
	}
});
