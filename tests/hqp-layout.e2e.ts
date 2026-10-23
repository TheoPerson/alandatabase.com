import { expect, test, type Browser, type Page } from '@playwright/test';

// Alan's HQP layout checks on the dev-only demo harness (/demo/hqp, fake engine, no media) and the
// Home Screen status bar check on the site pages. Spec sections 3.3, 9.7, 10.3, 11 and 13.6.
// The harness exists only on a dev server: everything here skips with a reason elsewhere.

test.use({ channel: 'chrome' });

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

// Section 2: the island of a 6.9-inch iPhone, portrait and both landscape sides.
const ISLAND_PORTRAIT: Rect[] = [{ x: 157, y: 11, width: 126, height: 37 }];
const ISLAND_LANDSCAPE: Rect[] = [
	{ x: 11, y: 157, width: 37, height: 126 },
	{ x: 908, y: 157, width: 37, height: 126 }
];

const STATES_COMMON = [
	'controls',
	'sheet',
	'info',
	'scrub',
	'upnext',
	'episodes',
	'resume',
	'error-503'
];
const STATES_LANDSCAPE = [...STATES_COMMON, 'locked'];

const INTERACTIVE =
	'button, a, [role="slider"], [role="radio"], [role="tab"], [role="switch"], input, select';

async function phone(browser: Browser, width: number, height: number, reducedMotion = false) {
	return browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
		userAgent: IPHONE_UA,
		reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
	});
}

async function openHarness(page: Page, query: string): Promise<boolean> {
	const response = await page.goto(`/demo/hqp?${query}`);
	if (!response || response.status() !== 200) return false;
	await page.locator('.hqp').waitFor({ state: 'visible', timeout: 15_000 });
	// Let the state settle (sheet springs, chrome fades).
	await page.waitForTimeout(700);
	return true;
}

/** Visible interactive elements in the player: bounding boxes and labels. */
async function visibleControls(page: Page) {
	return page.evaluate((selector) => {
		const root = document.querySelector('.hqp');
		if (!root) return [];
		const effectiveOpacity = (element: Element) => {
			let opacity = 1;
			for (
				let node: Element | null = element;
				node && node !== document.body;
				node = node.parentElement
			) {
				opacity *= Number(getComputedStyle(node).opacity);
			}
			return opacity;
		};
		return [...root.querySelectorAll(selector)]
			.filter((element) => {
				const style = getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				return (
					style.visibility !== 'hidden' &&
					style.display !== 'none' &&
					rect.width > 0 &&
					rect.height > 0 &&
					effectiveOpacity(element) > 0.01
				);
			})
			.map((element) => {
				const rect = element.getBoundingClientRect();
				return {
					label:
						element.getAttribute('aria-label') ??
						element.textContent?.trim().slice(0, 40) ??
						element.tagName,
					rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
				};
			});
	}, INTERACTIVE);
}

function intersects(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Elements whose hit area (including ::after extensions) is under 44 x 44 CSS px. */
async function smallTargets(page: Page) {
	return page.evaluate((selector) => {
		const root = document.querySelector('.hqp');
		if (!root) return [];
		const small: string[] = [];
		for (const element of root.querySelectorAll(selector)) {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			if (style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
			if (Number(style.opacity) <= 0.01) continue;
			const cx = rect.x + rect.width / 2;
			const cy = rect.y + rect.height / 2;
			const probes = [
				[cx - 21.5, cy],
				[cx + 21.5, cy],
				[cx, cy - 21.5],
				[cx, cy + 21.5]
			];
			const reachable = probes.every(([x, y]) => {
				if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
				const hit = document.elementFromPoint(x, y);
				return Boolean(hit && (hit === element || element.contains(hit)));
			});
			if (!reachable && (rect.width < 44 || rect.height < 44)) {
				small.push(
					`${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30)} ${Math.round(rect.width)}x${Math.round(rect.height)}`
				);
			}
		}
		return small;
	}, INTERACTIVE);
}

test.describe('Alan’s HQP island-free geometry (demo harness)', () => {
	for (const [name, width, height, island, states] of [
		['portrait', 440, 956, ISLAND_PORTRAIT, STATES_COMMON],
		['landscape', 956, 440, ISLAND_LANDSCAPE, STATES_LANDSCAPE]
	] as const) {
		test(`no control touches the island in ${name}, in every state`, async ({ browser }) => {
			const context = await phone(browser, width, height);
			const page = await context.newPage();
			test.skip(
				!(await openHarness(page, 'state=controls&sim=iphone18')),
				'No /demo/hqp harness (dev server only)'
			);
			const failures: string[] = [];
			for (const state of states) {
				for (const kind of ['episode', 'movie']) {
					if (!(await openHarness(page, `state=${state}&kind=${kind}&sim=iphone18`))) continue;
					for (const control of await visibleControls(page)) {
						if (island.some((rect) => intersects(control.rect, rect))) {
							failures.push(`${state}/${kind}: "${control.label}" ${JSON.stringify(control.rect)}`);
						}
					}
				}
			}
			expect(failures).toEqual([]);
			await context.close();
		});
	}

	test('portrait keeps the band above the island pure black and the top bar at y 53', async ({
		browser
	}) => {
		const context = await phone(browser, 440, 956);
		const page = await context.newPage();
		test.skip(
			!(await openHarness(page, 'state=controls&sim=iphone18')),
			'No /demo/hqp harness (dev server only)'
		);
		const controls = await visibleControls(page);
		const top = Math.min(...controls.map((control) => control.rect.y));
		expect(top).toBeGreaterThanOrEqual(48);
		await context.close();
	});

	test('every control has a 44 px target in portrait and landscape', async ({ browser }) => {
		const failures: string[] = [];
		for (const [width, height] of [
			[440, 956],
			[956, 440]
		]) {
			const context = await phone(browser, width, height);
			const page = await context.newPage();
			if (!(await openHarness(page, 'state=controls&kind=episode&sim=iphone18'))) {
				await context.close();
				test.skip(true, 'No /demo/hqp harness (dev server only)');
			}
			for (const state of ['controls', 'sheet', 'episodes', 'upnext']) {
				if (!(await openHarness(page, `state=${state}&kind=episode&sim=iphone18`))) continue;
				failures.push(
					...(await smallTargets(page)).map((entry) => `${width}x${height} ${state}: ${entry}`)
				);
			}
			await context.close();
		}
		expect(failures).toEqual([]);
	});

	test('no horizontal overflow at 320 px wide in either orientation', async ({ browser }) => {
		for (const [width, height] of [
			[320, 693],
			[693, 320]
		]) {
			const context = await phone(browser, width, height);
			const page = await context.newPage();
			if (!(await openHarness(page, 'state=controls&kind=episode'))) {
				await context.close();
				test.skip(true, 'No /demo/hqp harness (dev server only)');
			}
			for (const state of ['controls', 'sheet', 'episodes', 'upnext', 'error-503']) {
				if (!(await openHarness(page, `state=${state}&kind=episode`))) continue;
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, `${width}x${height} ${state}`).toBeLessThanOrEqual(0);
			}
			await context.close();
		}
	});

	test('reduced motion: chrome, sheet and frame never translate or scale', async ({ browser }) => {
		const context = await phone(browser, 440, 956, true);
		const page = await context.newPage();
		test.skip(
			!(await openHarness(page, 'state=controls&kind=episode')),
			'No /demo/hqp harness (dev server only)'
		);
		await page.evaluate(() => {
			(window as unknown as { __moves: string[] }).__moves = [];
			// The pressed control's own press feedback is not layout motion; everything else is.
			let pressed: Element | null = null;
			document.addEventListener(
				'pointerdown',
				(event) => (pressed = event.target as Element),
				true
			);
			const record = (event: Event) => {
				const property = (event as TransitionEvent).propertyName ?? '';
				const target = event.target as Element;
				// Progress fills on the timeline may scale: they show time, they do not move the UI.
				if (target.closest?.('[role="slider"]')) return;
				if (pressed && (target === pressed || target.contains(pressed))) return;
				if (/transform|translate|scale/u.test(property)) {
					(window as unknown as { __moves: string[] }).__moves.push(
						`${(event.target as Element).className} ${property}`
					);
				}
			};
			document.addEventListener('transitionstart', record, true);
			document.addEventListener(
				'animationstart',
				(event) => {
					const animation = (event.target as Element)
						.getAnimations()
						.find(
							(entry) =>
								(entry as CSSAnimation).animationName === (event as AnimationEvent).animationName
						);
					const frames = (animation?.effect as KeyframeEffect | undefined)?.getKeyframes() ?? [];
					if (
						frames.some((frame) => 'transform' in frame || 'translate' in frame || 'scale' in frame)
					) {
						(window as unknown as { __moves: string[] }).__moves.push(
							`${(event.target as Element).className} @${(event as AnimationEvent).animationName}`
						);
					}
				},
				true
			);
		});
		await page.touchscreen.tap(220, 300);
		await page.waitForTimeout(400);
		await page.touchscreen.tap(220, 300);
		await page.waitForTimeout(400);
		const settings = page.getByRole('button', { name: /audio and subtitles|settings/iu }).first();
		if ((await settings.count()) > 0) {
			await settings.click();
			await page.waitForTimeout(600);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(400);
		}
		const moves = await page.evaluate(() => (window as unknown as { __moves: string[] }).__moves);
		// Buffering arcs rotate; everything else must crossfade only.
		expect(moves.filter((entry) => !/rotate|spin|arc/iu.test(entry))).toEqual([]);
		await context.close();
	});

	test('keyboard focus is visible and Esc closes the top-most layer first', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		test.skip(
			!(await openHarness(page, 'state=controls&kind=episode')),
			'No /demo/hqp harness (dev server only)'
		);
		await page.locator('.hqp').focus();
		await page.keyboard.press('Tab');
		const ring = await page.evaluate(() => {
			const element = document.activeElement as HTMLElement | null;
			if (!element || !element.closest('.hqp')) return null;
			const style = getComputedStyle(element);
			return {
				outline: style.outlineStyle,
				width: parseFloat(style.outlineWidth),
				shadow: style.boxShadow
			};
		});
		expect(ring, 'focus stays inside the player').not.toBeNull();
		expect(ring!.outline !== 'none' && ring!.width >= 2).toBe(true);

		// One thick layer at a time: Esc closes whichever is on top and leaves the player open.
		const root = page.locator('.hqp');
		for (const key of ['s', 'e', '?']) {
			await root.focus();
			await page.keyboard.press(key);
			await expect(page.getByRole('dialog').first(), `${key} opens a dialog`).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(page.getByRole('dialog'), `Esc closes the ${key} dialog`).toHaveCount(0);
			await expect(root).toBeVisible();
		}
		// The info panel is not modal: Esc closes it too before anything else.
		await root.focus();
		await page.keyboard.press('i');
		await expect(page.locator('.hqp-signal')).toHaveAttribute('aria-expanded', 'true');
		await page.keyboard.press('Escape');
		await expect(page.locator('.hqp-signal')).toHaveAttribute('aria-expanded', 'false');
		await expect(root).toBeVisible();
	});
});

// ── Home Screen web app: nothing under a 62 px status bar ────────────

test.describe('Home Screen web app', () => {
	test('the manifest and Apple meta tags are served', async ({ page, request }) => {
		const manifest = await (await request.get('/manifest.json')).json();
		expect(manifest).toMatchObject({
			id: '/',
			name: "Alan's Data Base",
			short_name: 'Alan DB',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			orientation: 'any'
		});
		const sizes = manifest.icons.map(
			(icon: { sizes: string; purpose?: string }) => `${icon.sizes}:${icon.purpose ?? 'any'}`
		);
		expect(sizes).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
		for (const icon of [
			...manifest.icons.map((entry: { src: string }) => entry.src),
			'/icons/apple-touch-icon.png'
		]) {
			const response = await request.get(icon);
			expect(response.status(), icon).toBe(200);
			expect(response.headers()['content-type']).toContain('image/png');
		}
		await page.goto('/');
		await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
			'content',
			'yes'
		);
		await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
			'content',
			'yes'
		);
		await expect(
			page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')
		).toHaveAttribute('content', 'black-translucent');
		await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
			'content',
			'Alan DB'
		);
		await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
	});

	test('no page puts text or a control under a 62 px status bar', async ({ browser }) => {
		const context = await phone(browser, 440, 956);
		const page = await context.newPage();
		// Standalone with black-translucent: env(safe-area-inset-top) is 62 px on the phone.
		await page.addInitScript(() => {
			document.addEventListener('DOMContentLoaded', () => {
				const style = document.createElement('style');
				style.textContent = ':root:root { --safe-top: 62px !important; }';
				document.head.append(style);
			});
		});
		const pages = ['/', '/movies', '/tv', '/search', '/discover', '/auth/login'];
		await page.goto('/');
		const film = await page.locator('a[href^="/movies/"]').first().getAttribute('href');
		if (film) pages.push(film);
		await page.goto('/tv');
		const series = await page.locator('a[href^="/tv/"]').first().getAttribute('href');
		if (series) pages.push(series);

		const failures: string[] = [];
		for (const path of pages) {
			await page.goto(path);
			await page.waitForTimeout(300);
			const under = await page.evaluate(() => {
				const found: string[] = [];
				const visible = (element: Element) => {
					const style = getComputedStyle(element);
					const rect = element.getBoundingClientRect();
					return (
						style.visibility !== 'hidden' &&
						style.display !== 'none' &&
						rect.width > 1 &&
						rect.height > 1
					);
				};
				const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
				for (let node = walker.nextNode(); node; node = walker.nextNode()) {
					if (!node.textContent?.trim() || !node.parentElement || !visible(node.parentElement))
						continue;
					const range = document.createRange();
					range.selectNodeContents(node);
					const rect = range.getBoundingClientRect();
					if (rect.height > 0 && rect.top < 62 && rect.bottom > 0) {
						found.push(`text "${node.textContent.trim().slice(0, 30)}" at ${Math.round(rect.top)}`);
					}
				}
				for (const element of document.querySelectorAll('a, button, input, [role="button"]')) {
					if (!visible(element)) continue;
					const rect = element.getBoundingClientRect();
					if (rect.top < 62 && rect.bottom > 0) {
						found.push(
							`${element.tagName} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}" at ${Math.round(rect.top)}`
						);
					}
				}
				return found;
			});
			failures.push(...under.map((entry) => `${path}: ${entry}`));
		}
		expect(failures).toEqual([]);
		await context.close();
	});
});
