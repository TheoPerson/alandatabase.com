import type { Page } from '@playwright/test';

// Production pages are server-rendered; clicks sent before Svelte hydrates are lost.
export async function gotoHydrated(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForSelector('html[data-hydrated]', { state: 'attached', timeout: 15_000 });
}
