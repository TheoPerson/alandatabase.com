import { expect, test } from '@playwright/test';

test.describe('release calendar access boundaries', () => {
	test('anonymous users are redirected from the protected calendar with the deep link intact', async ({
		page
	}) => {
		await page.goto('/movies/calendar?range=90&region=FR');
		await expect(page).toHaveURL(
			/\/auth\/login\?returnTo=%2Fmovies%2Fcalendar%3Frange%3D90%26region%3DFR/u
		);
	});

	test('anonymous users cannot synchronize or export reminders', async ({ request }) => {
		const sync = await request.post('/api/admin/calendar/sync', { data: {} });
		expect(sync.status()).toBe(401);
		expect(await sync.json()).toEqual({ error: 'Unauthorized' });

		const calendar = await request.get(
			'/movies/calendar/reminders/00000000-0000-4000-8000-000000000001.ics',
			{ maxRedirects: 0 }
		);
		expect(calendar.status()).toBe(302);
		expect(calendar.headers().location).toContain('/auth/login?returnTo=');
	});
});
