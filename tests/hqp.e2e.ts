import {
	expect,
	test,
	type APIRequestContext,
	type Browser,
	type BrowserContext,
	type Page
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync } from 'node:fs';
import { gotoHydrated } from './helpers';

// Alan's HQP end to end (spec section 16.3), in Chrome (channel 'chrome'), on a dev server that
// has MEDIA_LIBRARY_ROOTS, FFMPEG_PATH and FFPROBE_PATH set. Owner flows run only when:
//   E2E_LOCAL_LIBRARY=1, and either E2E_OWNER_STATE (a Playwright storage state file of a signed-in
//   owner) or E2E_OWNER_USERNAME + E2E_OWNER_PASSWORD (sign-in is rate limited: one sign-in per run).
// They skip with a reason when the streaming API answers 503 (library offline or not configured).
// Visitor checks need no library and always run.

test.use({ channel: 'chrome' });

const LOCAL = process.env.E2E_LOCAL_LIBRARY === '1';
const STATE = process.env.E2E_OWNER_STATE;
const USERNAME = process.env.E2E_OWNER_USERNAME;
const PASSWORD = process.env.E2E_OWNER_PASSWORD;
const HAS_OWNER = Boolean((STATE && existsSync(STATE)) || (USERNAME && PASSWORD));
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const WATCH_URL = new RegExp(`/watch/(${UUID})`, 'u');
const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

// ── Visitors ──────────────────────────────────────────────────────────

test.describe('Alan’s HQP for visitors', () => {
	test('the player sends an anonymous visitor to sign in and back', async ({ page }) => {
		const file = '00000000-0000-4000-8000-000000000001';
		await page.goto(`/watch/${file}`);
		await expect(page).toHaveURL(
			new RegExp(`/auth/login\\?returnTo=${encodeURIComponent(`/watch/${file}`)}`, 'u')
		);
	});

	test('the media API refuses a visitor', async ({ request }) => {
		for (const path of ['/api/media/continue', '/api/media/progress?fileIds=x']) {
			const response = await request.get(path, { maxRedirects: 0 });
			expect([401, 403], path).toContain(response.status());
		}
		const start = await request.post('/api/media/sessions', {
			data: { fileId: '00000000-0000-4000-8000-000000000001', audio: null, caps: {} },
			headers: { origin: new URL(test.info().project.use.baseURL ?? 'http://x').origin },
			maxRedirects: 0
		});
		expect([401, 403]).toContain(start.status());
	});

	test('a visitor sees no Play, no local section and no Continue watching', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Continue watching' })).toHaveCount(0);
		const film = page.locator('a[href^="/movies/"]').first();
		test.skip((await film.count()) === 0, 'Empty catalogue');
		const href = await film.getAttribute('href');
		await page.goto(href ?? '/');
		await expect(page.locator('a[href^="/watch/"]')).toHaveCount(0);
		await expect(page.getByRole('group', { name: 'On this PC' })).toHaveCount(0);
		await page.goto('/tv');
		const series = page.locator('a[href^="/tv/"]').first();
		if ((await series.count()) > 0) {
			await page.goto((await series.getAttribute('href')) ?? '/tv');
			await expect(page.locator('a[href^="/watch/"]')).toHaveCount(0);
		}
	});
});

// ── Owner ─────────────────────────────────────────────────────────────

let ownerState: string | null = STATE && existsSync(STATE) ? STATE : null;

async function ownerContext(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
	if (!ownerState) {
		const context = await browser.newContext();
		const page = await context.newPage();
		await gotoHydrated(page, '/auth/login');
		await page.fill('input[name="identifier"]', USERNAME ?? '');
		await page.fill('input[name="password"]', PASSWORD ?? '');
		await Promise.all([
			page.waitForURL((url) => !url.pathname.startsWith('/auth/login')),
			page.getByRole('button', { name: 'Sign in' }).click()
		]);
		ownerState = test.info().outputPath('owner-state.json');
		await context.storageState({ path: ownerState });
		await context.close();
	}
	return browser.newContext({ ...options, storageState: ownerState });
}

async function libraryOffline(request: APIRequestContext, fileId: string): Promise<boolean> {
	const response = await request.get(`/api/media/files/${fileId}/chapters`);
	return response.status() === 503;
}

/** The first film and the first series of the On this PC tab. */
async function localTitles(page: Page) {
	await gotoHydrated(page, '/my/films?tab=local');
	const film = await page.locator('#local-films li a').first().getAttribute('href');
	const series = await page.locator('#local-shows li a').first().getAttribute('href');
	const unmatched = await page.locator('.unmatched a').first().getAttribute('href');
	return { film, series, unmatched };
}

async function currentTime(page: Page): Promise<number> {
	return page.locator('.hqp video').evaluate((video: HTMLVideoElement) => video.currentTime);
}

async function waitForPlayback(page: Page, timeout = 30_000): Promise<number> {
	await page.locator('.hqp video').waitFor({ state: 'attached', timeout });
	const start = await currentTime(page);
	await expect
		.poll(() => currentTime(page), { timeout, message: 'currentTime advances' })
		.toBeGreaterThan(start + 1);
	return currentTime(page);
}

function fileIdOf(url: string): string {
	const match = WATCH_URL.exec(url);
	if (!match) throw new Error(`not a watch URL: ${url}`);
	return match[1];
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

test.describe('Alan’s HQP for the owner', () => {
	test.skip(
		!LOCAL || !HAS_OWNER,
		'Needs E2E_LOCAL_LIBRARY=1 and an owner (E2E_OWNER_STATE or E2E_OWNER_USERNAME/PASSWORD)'
	);
	test.describe.configure({ mode: 'serial' });
	test.setTimeout(300_000);

	let context: BrowserContext;
	let page: Page;
	let titles: Awaited<ReturnType<typeof localTitles>>;

	test.beforeAll(async ({ browser }) => {
		// Touch on a large screen: a tap toggles the chrome without a mouse move showing it first.
		context = await ownerContext(browser, {
			viewport: { width: 1440, height: 900 },
			hasTouch: true
		});
		page = await context.newPage();
		titles = await localTitles(page);
	});

	test.afterAll(async () => {
		await context?.close();
	});

	test('the film page shows Play and the quality line for the owner', async () => {
		test.skip(!titles.film, 'No film on this PC');
		await gotoHydrated(page, titles.film!);
		const group = page.getByRole('group', { name: 'On this PC' });
		await expect(group).toBeVisible();
		const play = group.getByRole('link', { name: /^(Play|Resume)/u });
		await expect(play).toHaveAttribute('href', WATCH_URL);
		await expect(page.locator('.quality')).toContainText(/1080p|4K|720p|SD/u);
	});

	test('the owner pages have no serious or critical automated violations', async () => {
		const routes = ['/', '/my/films?tab=local', titles.film, titles.series].filter(
			(route): route is string => Boolean(route)
		);
		for (const route of routes) {
			await gotoHydrated(page, route);
			const scan = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			const blocking = scan.violations.filter(
				(violation) => violation.impact === 'serious' || violation.impact === 'critical'
			);
			expect(blocking, `${route}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
		}
	});

	test('a film plays, seeks, switches tracks and quality, and saves progress', async () => {
		test.skip(!titles.film, 'No film on this PC');
		await gotoHydrated(page, titles.film!);
		const play = page.getByRole('group', { name: 'On this PC' }).getByRole('link').first();
		const fileId = fileIdOf((await play.getAttribute('href')) ?? '');
		test.skip(
			await libraryOffline(page.request, fileId),
			'The media library answers 503 (offline)'
		);

		// Start over so the test does not depend on an earlier position.
		await page.goto(`/watch/${fileId}?t=0`);
		await expect(page.locator('.hqp')).toBeVisible();
		await expect(page.locator('header.top-bar, .bottom-tab-bar')).toHaveCount(0);
		await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
			'content',
			'black'
		);
		const startedAt = await waitForPlayback(page, 45_000);
		expect(startedAt).toBeGreaterThan(0);
		await expect(page.locator('.hqp-signal')).toContainText(/Original|Converted/u);

		// Chrome toggles on a tap of the picture.
		const root = page.locator('.hqp');
		const before = await root.getAttribute('data-chrome');
		await page.touchscreen.tap(720, 450);
		await expect(root).not.toHaveAttribute('data-chrome', before ?? 'on', { timeout: 4_000 });

		// Seek forward 10 s with the keyboard (large layout).
		const beforeSeek = await currentTime(page);
		await page.keyboard.press('l');
		await expect.poll(() => currentTime(page), { timeout: 10_000 }).toBeGreaterThan(beforeSeek + 8);

		// The settings sheet opens on S.
		await page.keyboard.press('s');
		const sheet = page.getByRole('dialog');
		await expect(sheet).toBeVisible();

		// Subtitles: choosing a text track renders cues (cold extraction can take 40 s).
		const subtitles = sheet.getByRole('radiogroup', { name: /subtitles/iu });
		const subtitle = subtitles
			.locator('[role="radio"]:not([aria-disabled="true"]):not([disabled])')
			.filter({ hasNotText: /\boff\b/iu })
			.filter({ hasNotText: /not supported/iu });
		if ((await subtitle.count()) > 0) {
			const choice = subtitle.last();
			await choice.click({ timeout: 15_000 });
			await expect(choice).toHaveAttribute('aria-checked', 'true');
			await expect(page.locator('.hqp-subs .cue').first()).toBeVisible({ timeout: 60_000 });
		}

		// Audio: a second track restarts the stream at the same position.
		const audio = sheet.getByRole('radiogroup', { name: /audio/iu }).getByRole('radio');
		if ((await audio.count()) > 1) {
			const at = await currentTime(page);
			await audio.nth(1).click();
			await expect.poll(() => currentTime(page), { timeout: 20_000 }).toBeGreaterThan(at - 1);
			expect(Math.abs((await waitForPlayback(page)) - at)).toBeLessThan(15);
		}

		// Quality: a lower level keeps the position.
		await sheet.getByRole('tab', { name: /picture/iu }).click();
		const quality = sheet.getByRole('radiogroup', { name: /quality/iu }).getByRole('radio');
		const lower = quality.filter({ hasText: /1080p|720p/u }).first();
		if ((await lower.count()) > 0) {
			const at = await currentTime(page);
			await lower.click();
			const after = await waitForPlayback(page, 45_000);
			expect(Math.abs(after - at)).toBeLessThan(20);
		}
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();

		// Progress is saved on close; Close returns to the film page.
		const position = await currentTime(page);
		await closePlayer(page);
		await expect(page).toHaveURL(new RegExp(`${titles.film!}$`, 'u'));
		await expect
			.poll(
				async () => {
					const response = await page.request.get(`/api/media/progress?fileIds=${fileId}`);
					// A lost session answers 401 with an { error } body: report it as -1, not as "0 s".
					if (!response.ok()) return -1;
					const entries = (await response.json()) as Array<{ positionSeconds: number }>;
					return entries[0]?.positionSeconds ?? 0;
				},
				{ timeout: 10_000 }
			)
			.toBeGreaterThan(position - 15);

		// Home and Library show it in Continue watching.
		await gotoHydrated(page, '/');
		const homeRail = page
			.getByRole('region', { name: 'Continue watching' })
			.or(
				page.locator('section', { has: page.getByRole('heading', { name: 'Continue watching' }) })
			);
		await expect(homeRail.locator(`a[href="/watch/${fileId}"]`).first()).toBeVisible();
		await gotoHydrated(page, '/my/films');
		await expect(page.locator(`.continue a[href="/watch/${fileId}"]`)).toBeVisible();
	});

	test('an episode near its end offers Up next and moves the URL to the next file', async () => {
		test.skip(!titles.series, 'No series on this PC');
		await gotoHydrated(page, titles.series!);
		const rows = page.locator('a.episode.playable');
		test.skip((await rows.count()) < 2, 'Needs two local episodes of one series');
		const first = fileIdOf((await rows.nth(0).getAttribute('href')) ?? '');
		test.skip(await libraryOffline(page.request, first), 'The media library answers 503 (offline)');

		await page.goto(`/watch/${first}?t=0`);
		await waitForPlayback(page, 45_000);
		const duration = await page
			.locator('.hqp video')
			.evaluate((video: HTMLVideoElement) => video.duration);
		test.skip(!Number.isFinite(duration) || duration < 120, 'Episode duration unknown');

		// The episodes drawer opens on E and lists the queue.
		await page.keyboard.press('e');
		const drawer = page.getByRole('dialog');
		await expect(drawer).toBeVisible();
		await page.keyboard.press('Escape');

		// Near the end (past duration - max(45 s, 2%)): Up next shows at once and counts down 10 s;
		// "Play now" or the countdown plays the next file in place and the URL follows.
		await page.goto(`/watch/${first}?t=${Math.floor(duration - 40)}`);
		await expect(page.getByText(/up next/iu).first()).toBeAttached({ timeout: 45_000 });
		const playNow = page.getByRole('button', { name: /play now|play next/iu }).first();
		await playNow.click({ timeout: 5_000 }).catch(() => {
			// The countdown may already have started the next episode.
		});
		await expect(page).not.toHaveURL(new RegExp(`/watch/${first}`, 'u'), { timeout: 45_000 });
		await expect(page).toHaveURL(WATCH_URL);
		await expect
			.poll(() => currentTime(page), { timeout: 45_000, message: 'the next episode plays' })
			.toBeGreaterThan(1);
		await closePlayer(page);
		await expect(page).toHaveURL(/\/tv\/\d+/u);
	});

	test('an iPhone never downloads hls.js and reports native HLS caps', async ({ browser }) => {
		test.skip(!titles.film, 'No film on this PC');
		const phone = await ownerContext(browser, {
			viewport: { width: 440, height: 956 },
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
			userAgent: IPHONE_UA
		});
		// Chrome stands in for Safari: Apple vendor and a native HLS answer from canPlayType.
		await phone.addInitScript(() => {
			Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.' });
			const canPlay = HTMLMediaElement.prototype.canPlayType;
			HTMLMediaElement.prototype.canPlayType = function (type: string) {
				if (/mpegurl/iu.test(type)) return 'maybe';
				if (/ec-3|ac-3|hvc1|av01/iu.test(type)) return 'probably';
				return canPlay.call(this, type);
			};
		});
		const iphone = await phone.newPage();
		const requests: string[] = [];
		const bodies: string[] = [];
		iphone.on('request', (request) => {
			requests.push(request.url());
			if (request.url().endsWith('/api/media/sessions') && request.method() === 'POST') {
				bodies.push(request.postData() ?? '');
			}
		});
		await gotoHydrated(iphone, titles.film!);
		const href = await iphone
			.getByRole('group', { name: 'On this PC' })
			.getByRole('link')
			.first()
			.getAttribute('href');
		const fileId = fileIdOf(href ?? '');
		test.skip(
			await libraryOffline(iphone.request, fileId),
			'The media library answers 503 (offline)'
		);
		await iphone.goto(`/watch/${fileId}`);
		await expect(iphone.locator('.hqp')).toBeVisible();
		await expect.poll(() => bodies.length, { timeout: 20_000 }).toBeGreaterThan(0);
		expect(requests.filter((url) => /hls[._-]?js|hls__js|\/hls\.js/iu.test(url))).toEqual([]);
		const caps = JSON.parse(bodies[0]).caps;
		expect(caps).toMatchObject({ nativeHls: true, eac3: true, ac3: true, multichannel: true });
		await closePlayer(iphone);
		await phone.close();
	});
});
