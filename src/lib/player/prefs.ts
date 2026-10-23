// Player preferences live under one versioned localStorage key. Anything we
// cannot understand (old version, garbage, out-of-range values) collapses to
// the defaults so the player never breaks on stored state.

export const PREFS_VERSION = 1;
export const PREFS_KEY = 'player:prefs';
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const AUTO_HIDE_DELAYS = [2000, 3000, 5000] as const;

export type CaptionSize = 'small' | 'medium' | 'large';
export type AutoHideDelay = (typeof AUTO_HIDE_DELAYS)[number];

export interface PlayerPrefs {
	version: number;
	speed: number;
	volume: number;
	muted: boolean;
	captions: boolean;
	captionSize: CaptionSize;
	resume: boolean;
	shortcuts: boolean;
	autoHideMs: AutoHideDelay;
	oled: boolean;
	format: 'fit';
}

export const DEFAULT_PREFS: PlayerPrefs = Object.freeze({
	version: PREFS_VERSION,
	speed: 1,
	volume: 1,
	muted: false,
	captions: false,
	captionSize: 'medium',
	resume: true,
	shortcuts: true,
	autoHideMs: 3000,
	oled: false,
	format: 'fit'
}) as PlayerPrefs;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

/** Snaps any number to the nearest supported speed. */
export function nearestSpeed(value: number): number {
	return SPEEDS.reduce<number>(
		(best, speed) => (Math.abs(speed - value) < Math.abs(best - value) ? speed : best),
		1
	);
}

export function normalizePrefs(input: unknown): PlayerPrefs {
	let raw: unknown = input;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return { ...DEFAULT_PREFS };
		}
	}
	if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== PREFS_VERSION) {
		return { ...DEFAULT_PREFS };
	}
	const r = raw as Record<string, unknown>;
	const autoHide = Number(r.autoHideMs);
	return {
		version: PREFS_VERSION,
		speed: nearestSpeed(clamp(r.speed, 0.5, 2, 1)),
		volume: clamp(r.volume, 0, 1, 1),
		muted: r.muted === true,
		captions: r.captions === true,
		captionSize: r.captionSize === 'small' || r.captionSize === 'large' ? r.captionSize : 'medium',
		resume: r.resume !== false,
		shortcuts: r.shortcuts !== false,
		autoHideMs: (AUTO_HIDE_DELAYS as readonly number[]).includes(autoHide)
			? (autoHide as AutoHideDelay)
			: 3000,
		oled: r.oled === true,
		format: 'fit'
	};
}

export function loadPrefs(storage: Storage | null | undefined): PlayerPrefs {
	try {
		return normalizePrefs(storage?.getItem(PREFS_KEY));
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function savePrefs(storage: Storage | null | undefined, prefs: PlayerPrefs): void {
	try {
		storage?.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
	} catch {
		// Storage may be unavailable (private mode, quota); prefs then live for the session only.
	}
}
