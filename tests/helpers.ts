import type { Page } from '@playwright/test';

// Production pages are server-rendered; clicks sent before Svelte hydrates are lost.
export async function gotoHydrated(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForSelector('html[data-hydrated]', { state: 'attached', timeout: 15_000 });
}

// The first film Home links to, or null on an empty catalogue (specs then skip).
export async function firstMovieHref(page: Page): Promise<string | null> {
	await page.goto('/');
	const link = page.locator('a[href^="/movies/"]').first();
	if ((await link.count()) === 0) return null;
	return link.getAttribute('href');
}
