// Player preferences (localStorage 'hqp:prefs', version 1). Every read is validated field by
// field so a corrupt or foreign value falls back to the defaults.
import type { QualityLevel } from '$lib/media/types';
import type { AspectClass, HqpPrefs, HqpPrefsPatch, QualityChoice } from './types';

export const HQP_PREFS_KEY = 'hqp:prefs';

export const DEFAULT_HQP_PREFS: HqpPrefs = Object.freeze({
	version: 1,
	quality: 'auto',
	volume: 1,
	muted: false,
	audioLanguage: null,
	subtitleMode: 'auto',
	subtitleLanguage: 'fre',
	subtitleStyle: { size: 'm', background: 'shadow', color: 'white', position: 'auto' },
	autoplayNext: true,
	autoHideMs: 3000,
	frameModes: { standard: 'fit', wide: 'fit', scope: 'fit' },
	liteGlass: false,
	resume: true,
	hints: { fineScrub: false, homeScreen: false }
}) as HqpPrefs;

export const QUALITY_LEVELS: QualityLevel[] = ['original', '2160p', '1080p', '720p', '480p'];
const LANGUAGE = /^[a-z]{2,3}$/;

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T =>
	allowed.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const lang = (v: unknown): string | null => {
	const code = typeof v === 'string' ? v.trim().toLowerCase() : '';
	return LANGUAGE.test(code) ? code : null;
};

export function normalizeHqpPrefs(input: unknown): HqpPrefs {
	const d = DEFAULT_HQP_PREFS;
	const o = asObj(input);
	if (o.version !== undefined && o.version !== 1) return structuredClone(d);
	const style = asObj(o.subtitleStyle);
	const modes = asObj(o.frameModes);
	const hints = asObj(o.hints);
	const frame = (k: AspectClass) => pick(modes[k], ['fit', 'fill'] as const, 'fit');
	const volume = typeof o.volume === 'number' && Number.isFinite(o.volume) ? o.volume : d.volume;
	return {
		version: 1,
		quality: pick<QualityChoice>(o.quality, ['auto', ...QUALITY_LEVELS], d.quality),
		volume: Math.min(1, Math.max(0, volume)),
		muted: bool(o.muted, d.muted),
		audioLanguage: lang(o.audioLanguage),
		subtitleMode: pick(o.subtitleMode, ['auto', 'on', 'off'] as const, d.subtitleMode),
		subtitleLanguage: lang(o.subtitleLanguage) ?? d.subtitleLanguage,
		subtitleStyle: {
			size: pick(style.size, ['s', 'm', 'l', 'xl'] as const, 'm'),
			background: pick(style.background, ['shadow', 'outline', 'box'] as const, 'shadow'),
			color: pick(style.color, ['white', 'yellow'] as const, 'white'),
			position: pick(style.position, ['auto', 'low'] as const, 'auto')
		},
		autoplayNext: bool(o.autoplayNext, d.autoplayNext),
		autoHideMs: pick(o.autoHideMs, [2000, 3000, 5000] as const, d.autoHideMs),
		frameModes: { standard: frame('standard'), wide: frame('wide'), scope: frame('scope') },
		liteGlass: bool(o.liteGlass, d.liteGlass),
		resume: bool(o.resume, d.resume),
		hints: {
			fineScrub: bool(hints.fineScrub, false),
			homeScreen: bool(hints.homeScreen, false)
		}
	};
}

/** Applies a patch (nested groups merge) and re-validates the result. */
export function mergeHqpPrefs(prefs: HqpPrefs, patch: HqpPrefsPatch): HqpPrefs {
	return normalizeHqpPrefs({
		...prefs,
		...patch,
		subtitleStyle: { ...prefs.subtitleStyle, ...patch.subtitleStyle },
		frameModes: { ...prefs.frameModes, ...patch.frameModes },
		hints: { ...prefs.hints, ...patch.hints }
	});
}

export function loadHqpPrefs(storage: Storage | null | undefined): HqpPrefs {
	try {
		const raw = storage?.getItem(HQP_PREFS_KEY);
		return normalizeHqpPrefs(raw ? JSON.parse(raw) : null);
	} catch {
		return normalizeHqpPrefs(null);
	}
}

export function saveHqpPrefs(storage: Storage | null | undefined, prefs: HqpPrefs): void {
	try {
		storage?.setItem(HQP_PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// Private mode or blocked storage: preferences stay in memory.
	}
}

/** Fit/Fill is remembered per picture aspect class: <= 1.85, <= 2.2, > 2.2. */
export function aspectClassOf(aspect: number | null): AspectClass {
	if (!aspect || aspect <= 1.85) return 'standard';
	return aspect <= 2.2 ? 'wide' : 'scope';
}
