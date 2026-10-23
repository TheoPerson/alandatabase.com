import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { gotoHydrated } from './helpers';

// Alan's HQP performance budget (spec section 12), in Chrome with a 4x CPU throttle:
// - controls INP under 100 ms (play, chrome toggle, open sheet, select subtitle, select tab);
// - zero layout shift across 5 chrome cycles; glass surfaces within budget; no rAF loop hidden;
// - no long task over 50 ms during 20 s of real playback (owner and local library only).
// The first group runs on the dev-only /demo/hqp harness and skips elsewhere.

test.use({ channel: 'chrome' });

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const LOCAL = process.env.E2E_LOCAL_LIBRARY === '1';
const STATE = process.env.E2E_OWNER_STATE;
const USERNAME = process.env.E2E_OWNER_USERNAME;
const PASSWORD = process.env.E2E_OWNER_PASSWORD;

// Collects event timings (INP), layout shifts, long tasks and rAF calls from the first paint.
function instrument() {
	const perf = {
		events: [] as Array<{ name: string; duration: number }>,
		shift: 0,
		long: [] as number[],
		raf: 0
	};
	(window as unknown as { __hqpPerf: typeof perf }).__hqpPerf = perf;
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries() as Array<
			PerformanceEventTiming & { interactionId?: number }
		>) {
			if (entry.interactionId) perf.events.push({ name: entry.name, duration: entry.duration });
		}
	}).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries() as Array<
			PerformanceEntry & { value: number; hadRecentInput: boolean }
		>) {
			perf.shift += entry.value;
		}
	}).observe({ type: 'layout-shift', buffered: true });
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) perf.long.push(entry.duration);
	}).observe({ type: 'longtask', buffered: true });
	const raf = window.requestAnimationFrame.bind(window);
	window.requestAnimationFrame = (callback) => {
		perf.raf += 1;
		return raf(callback);
	};
}

type Perf = {
	events: Array<{ name: string; duration: number }>;
	shift: number;
	long: number[];
	raf: number;
};
const readPerf = (page: Page) =>
	page.evaluate(() => (window as unknown as { __hqpPerf: Perf }).__hqpPerf);

async function throttle(context: BrowserContext, page: Page, rate: number) {
	const cdp = await context.newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate });
	return cdp;
}

async function phone(browser: Browser) {
	const context = await browser.newContext({
		viewport: { width: 440, height: 956 },
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
		userAgent: IPHONE_UA
	});
	await context.addInitScript(instrument);
	return context;
}

async function openHarness(page: Page, query: string): Promise<boolean> {
	const response = await page.goto(`/demo/hqp?${query}`);
	if (!response || response.status() !== 200) return false;
	await page.locator('.hqp').waitFor({ state: 'visible', timeout: 15_000 });
	await page.waitForTimeout(800);
	return true;
}

/** Visible glass surfaces: [small, thick]. */
async function glassCount(page: Page): Promise<[number, number]> {
	return page.evaluate(() => {
		let small = 0;
		let thick = 0;
		for (const element of document.querySelectorAll('.hqp [class*="hqp-glass"]')) {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			let opacity = 1;
			for (
				let node: Element | null = element;
				node && node !== document.body;
				node = node.parentElement
			) {
				opacity *= Number(getComputedStyle(node).opacity);
			}
			if (style.visibility === 'hidden' || rect.width === 0 || opacity <= 0.01) continue;
			if (/hqp-glass-thick/u.test(element.className.toString())) thick += 1;
			else small += 1;
		}
		return [small, thick] as [number, number];
	});
}

/** Closes the player: shows the chrome (it hides while playing), clicks Close, else Esc. */
async function closePlayer(page: Page) {
	await page.mouse.move(700, 420);
	await page.mouse.move(720, 440);
	const close = page.getByRole('button', { name: /close player/iu }).first();
	try {
		await close.click({ timeout: 3_000 });
	} catch {
		for (let attempt = 0; attempt < 4 && /\/watch\//u.test(page.url()); attempt += 1) {
			await page.keyboard.press('Escape');
			await page.waitForTimeout(300);
		}
	}
}

test.describe('Alan’s HQP budgets on the demo harness (4x CPU throttle)', () => {
	test('controls respond under 100 ms (INP)', async ({ browser }) => {
		const context = await phone(browser);
		const page = await context.newPage();
		test.skip(
			!(await openHarness(page, 'state=controls&kind=episode')),
			'No /demo/hqp harness (dev server only)'
		);
		// Warm-up without throttling: a dev server compiles each part on first use, which is not
		// what the budget measures. Then only the measured interactions count.
		const opener = page.getByRole('button', { name: /audio and subtitles/iu }).first();
		if ((await opener.count()) > 0) {
			await opener.tap();
			await page.waitForTimeout(500);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(500);
		}
		await page.evaluate(() => {
			(window as unknown as { __hqpPerf: Perf }).__hqpPerf.events.length = 0;
		});
		await throttle(context, page, 4);

		const play = page.getByRole('button', { name: /^(play|pause)$/iu }).first();
		if ((await play.count()) > 0) await play.tap();
		await page.touchscreen.tap(220, 300); // toggle the chrome
		await page.waitForTimeout(300);
		await page.touchscreen.tap(220, 300);
		await page.waitForTimeout(300);
		await page
			.getByRole('button', { name: /audio and subtitles/iu })
			.first()
			.tap();
		const sheet = page.getByRole('dialog').first();
		await expect(sheet).toBeVisible();
		const subtitle = sheet.getByRole('radiogroup', { name: /subtitles/iu }).getByRole('radio');
		if ((await subtitle.count()) > 1) await subtitle.nth(1).tap();
		await sheet.getByRole('tab', { name: /picture/iu }).tap();
		await page.waitForTimeout(500);

		const perf = await readPerf(page);
		const worst = Math.max(0, ...perf.events.map((event) => event.duration));
		expect(perf.events.length, 'interactions were measured').toBeGreaterThan(0);
		expect(worst, JSON.stringify(perf.events)).toBeLessThan(100);
		await context.close();
	});

	test('showing and hiding the chrome shifts no layout (5 cycles)', async ({ browser }) => {
		const context = await phone(browser);
		const page = await context.newPage();
		test.skip(
			!(await openHarness(page, 'state=controls&kind=movie')),
			'No /demo/hqp harness (dev server only)'
		);
		const before = (await readPerf(page)).shift;
		for (let cycle = 0; cycle < 10; cycle += 1) {
			await page.touchscreen.tap(220, 300);
			await page.waitForTimeout(450);
		}
		const after = (await readPerf(page)).shift;
		expect(after - before).toBeLessThan(0.001);
		await context.close();
	});

	test('glass budget: 8 small and 1 thick at most; none and no rAF loop when hidden', async ({
		browser
	}) => {
		const context = await phone(browser);
		const page = await context.newPage();
		test.skip(
			!(await openHarness(page, 'state=controls&kind=episode')),
			'No /demo/hqp harness (dev server only)'
		);
		const [small, thick] = await glassCount(page);
		expect(small).toBeLessThanOrEqual(8);
		expect(thick).toBeLessThanOrEqual(1);

		await openHarness(page, 'state=sheet&kind=episode');
		expect((await glassCount(page))[1]).toBeLessThanOrEqual(1);

		await openHarness(page, 'state=hidden&kind=episode');
		await page.waitForTimeout(600);
		expect(await glassCount(page)).toEqual([0, 0]);
		const start = (await readPerf(page)).raf;
		await page.waitForTimeout(2_000);
		const frames = (await readPerf(page)).raf - start;
		expect(frames, 'requestAnimationFrame calls in 2 s with the chrome hidden').toBeLessThan(10);
		await context.close();
	});
});

test.describe('Alan’s HQP during real playback', () => {
	test.skip(
		!LOCAL || !((STATE && existsSync(STATE)) || (USERNAME && PASSWORD)),
		'Needs E2E_LOCAL_LIBRARY=1 and an owner (E2E_OWNER_STATE or E2E_OWNER_USERNAME/PASSWORD)'
	);
	test.setTimeout(120_000);

	test('no long task over 50 ms during 20 s of playback', async ({ browser }) => {
		let state = STATE && existsSync(STATE) ? STATE : null;
		if (!state) {
			const login = await browser.newContext();
			const page = await login.newPage();
			await gotoHydrated(page, '/auth/login');
			await page.fill('input[name="identifier"]', USERNAME ?? '');
			await page.fill('input[name="password"]', PASSWORD ?? '');
			await Promise.all([
				page.waitForURL((url) => !url.pathname.startsWith('/auth/login')),
				page.getByRole('button', { name: 'Sign in' }).click()
			]);
			state = test.info().outputPath('owner-state.json');
			await login.storageState({ path: state });
			await login.close();
		}
		const context = await browser.newContext({
			storageState: state,
			viewport: { width: 1440, height: 900 },
			hasTouch: true
		});
		await context.addInitScript(instrument);
		const page = await context.newPage();
		await gotoHydrated(page, '/my/films?tab=local');
		const film = await page.locator('#local-films li a').first().getAttribute('href');
		test.skip(!film, 'No film on this PC');
		await gotoHydrated(page, film!);
		const href = await page
			.getByRole('group', { name: 'On this PC' })
			.getByRole('link')
			.first()
			.getAttribute('href');
		const fileId = /\/watch\/([0-9a-f-]{36})/u.exec(href ?? '')?.[1];
		test.skip(!fileId, 'No local copy');
		const chapters = await page.request.get(`/api/media/files/${fileId}/chapters`);
		test.skip(chapters.status() === 503, 'The media library answers 503 (offline)');

		await page.goto(`/watch/${fileId}?t=0`);
		const video = page.locator('.hqp video');
		await expect
			.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), {
				timeout: 45_000
			})
			.toBeGreaterThan(1);
		// Measure from steady playback: 10 s with the chrome hidden, then 10 s with it shown.
		const start = (await readPerf(page)).long.length;
		await page.waitForTimeout(10_000);
		await page.touchscreen.tap(720, 450);
		await page.waitForTimeout(10_000);
		const long = (await readPerf(page)).long.slice(start);
		expect(long.filter((duration) => duration > 50)).toEqual([]);
		await closePlayer(page);
		await context.close();
	});
});
