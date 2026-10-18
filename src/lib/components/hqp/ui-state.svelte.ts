// UI-only state of Alan's HQP (runes). The engine owns playback; this owns what the chrome shows.
import type { HqpLayout } from './logic/layout';

export type HqpOverlay = 'sheet' | 'episodes' | 'help' | 'homescreen' | null;
export type HqpSheetTab = 'tracks' | 'picture' | 'playback';
export type HqpSheetPage = 'main' | 'style';
export type FineRate = 1 | 0.5 | 0.25;

export interface HqpScrub {
	source: 'timeline' | 'pan';
	origin: number;
	target: number;
	rate: FineRate;
}

export interface HqpRipple {
	side: 'back' | 'forward';
	total: number; // signed seconds
	key: number;
}

export interface HqpUiToast {
	id: number;
	text: string;
	action: { label: string; run: () => void } | null;
}

/** Initial UI state for the dev harness (spec 13.5). Never used by the /watch route. */
export interface HqpUiSeed {
	chrome?: boolean;
	pinChrome?: boolean;
	overlay?: HqpOverlay;
	sheetTab?: HqpSheetTab;
	sheetPage?: HqpSheetPage;
	info?: boolean;
	scrub?: HqpScrub | null;
	ripple?: HqpRipple | null;
	peekAt?: number | null;
	locked?: boolean;
	lockPill?: boolean;
}

export class HqpUi {
	layout = $state<HqpLayout>('phone-portrait');
	landscapeShort = $state(false);
	finePointer = $state(false);
	reducedMotion = $state(false);
	reducedTransparency = $state(false);
	/** iOS Safari in a tab (not the Home Screen app): edge exclusion and the Home Screen hint. */
	iosTab = $state(false);
	viewport = $state({ width: 0, height: 0 });

	chrome = $state(true);
	/** Harness only: the chrome never auto-hides. */
	pinChrome = $state(false);
	/** Bumped on every interaction so the auto-hide timer restarts. */
	activity = $state(0);
	focusWithin = $state(false);
	pointerOverControls = $state(false);

	overlay = $state<HqpOverlay>(null);
	/**
	 * The overlay whose panel is mounted. Opening flips `overlay` at once (chrome fade, frame glide,
	 * HDR limit start on the tap's own frame) and mounts the panel right after that frame is painted,
	 * so the tap never waits for a mount (INP). Closing is immediate.
	 */
	shown = $state<HqpOverlay>(null);
	/**
	 * The settings sheet is built ahead of time (idle, about 2 s after the first frame) and parked
	 * hidden, so opening it only flips attributes instead of mounting its nodes inside the tap.
	 */
	warmSheet = $state(false);
	sheetTab = $state<HqpSheetTab>('tracks');
	sheetPage = $state<HqpSheetPage>('main');
	info = $state(false);

	locked = $state(false);
	lockPill = $state(false);

	scrub = $state<HqpScrub | null>(null);
	/** Portrait scrub: where the video was moved while the finger rested (section 6.3). */
	scrubSeek = $state<number | null>(null);
	hoverAt = $state<number | null>(null);
	ripple = $state<HqpRipple | null>(null);
	peekAt = $state<number | null>(null);
	dragging = $state(false);
	dismissing = $state(false);
	pinching = $state(false);
	/** Fit/Fill FLIP phase (section 5.5). */
	flip = $state<'to-fill' | 'from-fill' | 'settle' | null>(null);
	/** Timeline track rectangle, measured at pointerdown / gesture start only. */
	track = $state.raw({ left: 0, width: 0 });
	mounted = $state(false);

	toasts = $state<HqpUiToast[]>([]);
	announcement = $state<{ id: number; text: string } | null>(null);

	/** The element that opened the current dialog, focused again when it closes. */
	opener: HTMLElement | null = null;

	#ids = 0;
	#timers: Array<ReturnType<typeof setTimeout>> = [];
	#lockTimer: ReturnType<typeof setTimeout> | null = null;
	#rippleTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(seed?: HqpUiSeed) {
		if (!seed) return;
		if (seed.chrome !== undefined) this.chrome = seed.chrome;
		if (seed.pinChrome) this.pinChrome = true;
		if (seed.overlay !== undefined) {
			this.overlay = seed.overlay;
			this.shown = seed.overlay;
		}
		if (seed.sheetTab) this.sheetTab = seed.sheetTab;
		if (seed.sheetPage) this.sheetPage = seed.sheetPage;
		if (seed.info) this.info = true;
		if (seed.scrub) this.scrub = seed.scrub;
		if (seed.ripple) {
			this.ripple = seed.ripple;
			this.peekAt = seed.peekAt ?? null;
		}
		if (seed.locked) this.locked = true;
		if (seed.lockPill) this.lockPill = true;
	}

	get portrait(): boolean {
		return this.layout === 'phone-portrait' || this.layout === 'phone-portrait-short';
	}

	get large(): boolean {
		return this.layout === 'large';
	}

	/** A modal layer is open (focus is trapped there). */
	get modal(): boolean {
		return this.overlay !== null;
	}

	poke(): void {
		this.activity += 1;
	}

	showChrome(): void {
		if (this.locked) return;
		this.chrome = true;
		this.poke();
	}

	toggleChrome(): void {
		if (this.locked) return;
		this.chrome = !this.chrome;
		this.poke();
	}

	/** Chrome shown by a tap: controls ignore pointers for the double-tap window. */
	arming = $state(false);
	#armTimer: ReturnType<typeof setTimeout> | null = null;
	arm(ms = 300): void {
		this.arming = true;
		if (this.#armTimer) clearTimeout(this.#armTimer);
		this.#armTimer = setTimeout(() => {
			this.arming = false;
			this.#armTimer = null;
		}, ms);
	}

	open(overlay: Exclude<HqpOverlay, null>, opener?: Element | null): void {
		if (this.overlay === null) {
			this.opener = opener instanceof HTMLElement ? opener : null;
		}
		if (overlay === 'sheet' || overlay === 'episodes') this.info = false;
		this.overlay = overlay;
		this.poke();
		this.#cancelShow();
		if (this.shown !== null) {
			// Switching from one overlay to another: swap the panel at once.
			this.shown = overlay;
			return;
		}
		if (typeof requestAnimationFrame !== 'function') {
			this.shown = overlay;
			return;
		}
		this.#showRaf = requestAnimationFrame(() => {
			this.#showRaf = 0;
			this.#showTimer = setTimeout(() => {
				this.#showTimer = null;
				if (this.overlay === overlay) this.shown = overlay;
			});
		});
	}

	#showRaf = 0;
	#showTimer: ReturnType<typeof setTimeout> | null = null;
	#cancelShow(): void {
		if (this.#showRaf) cancelAnimationFrame(this.#showRaf);
		if (this.#showTimer) clearTimeout(this.#showTimer);
		this.#showRaf = 0;
		this.#showTimer = null;
	}

	openSheet(tab: HqpSheetTab, opener?: Element | null): void {
		this.sheetTab = tab;
		this.sheetPage = 'main';
		this.open('sheet', opener);
	}

	close(): void {
		const opener = this.opener;
		this.#cancelShow();
		this.overlay = null;
		this.shown = null;
		this.sheetPage = 'main';
		this.opener = null;
		this.poke();
		if (opener?.isConnected) queueMicrotask(() => opener.focus({ preventScroll: true }));
	}

	/**
	 * Ends a scrub: seeks to `target`, or back to `origin` when cancelled (null) after a rest-seek
	 * moved the video. A target the rest-seek already reached is not sought twice.
	 */
	finishScrub(seek: (seconds: number) => void, target: number | null, origin: number): void {
		const moved = this.scrubSeek;
		this.scrubSeek = null;
		if (target === null) {
			if (moved !== null && Math.abs(moved - origin) >= 0.5) seek(origin);
			return;
		}
		if (moved !== null && Math.abs(moved - target) < 0.5) return;
		seek(target);
	}

	toast(text: string, ms = 1600, action: HqpUiToast['action'] = null): void {
		const id = ++this.#ids;
		this.toasts = [...this.toasts, { id, text, action }];
		this.#later(() => this.dismissToast(id), action ? Math.max(ms, 4000) : ms);
	}

	dismissToast(id: number): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	announce(text: string): void {
		this.announcement = { id: ++this.#ids, text };
	}

	showLockPill(): void {
		this.lockPill = true;
		if (this.#lockTimer) clearTimeout(this.#lockTimer);
		this.#lockTimer = setTimeout(() => {
			this.lockPill = false;
			this.#lockTimer = null;
		}, 2000);
	}

	setLocked(on: boolean): void {
		this.locked = on;
		if (on) {
			this.chrome = false;
			this.info = false;
			this.showLockPill();
		} else {
			this.lockPill = false;
			this.chrome = true;
			this.poke();
		}
	}

	/** Double-tap or key seek feedback: lens, label and peek line for 700 ms. */
	flashSeek(side: 'back' | 'forward', total: number, peekAt: number | null): void {
		this.ripple = { side, total, key: ++this.#ids };
		this.peekAt = peekAt;
		if (this.#rippleTimer) clearTimeout(this.#rippleTimer);
		this.#rippleTimer = setTimeout(() => {
			this.ripple = null;
			this.peekAt = null;
			this.#rippleTimer = null;
		}, 700);
	}

	#later(fn: () => void, ms: number): void {
		const id = setTimeout(() => {
			this.#timers = this.#timers.filter((t) => t !== id);
			fn();
		}, ms);
		this.#timers.push(id);
	}

	dispose(): void {
		for (const id of this.#timers) clearTimeout(id);
		this.#timers = [];
		if (this.#lockTimer) clearTimeout(this.#lockTimer);
		if (this.#rippleTimer) clearTimeout(this.#rippleTimer);
		if (this.#armTimer) clearTimeout(this.#armTimer);
		this.#cancelShow();
	}
}
