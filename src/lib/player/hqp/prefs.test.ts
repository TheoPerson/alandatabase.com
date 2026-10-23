import { describe, expect, it } from 'vitest';
import {
	aspectClassOf,
	DEFAULT_HQP_PREFS,
	HQP_PREFS_KEY,
	loadHqpPrefs,
	mergeHqpPrefs,
	normalizeHqpPrefs,
	saveHqpPrefs
} from './prefs';

function memoryStorage(initial: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(initial));
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k) => data.get(k) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (k) => void data.delete(k),
		setItem: (k, v) => void data.set(k, String(v))
	};
}

describe('prefs', () => {
	it('has the documented defaults', () => {
		expect(HQP_PREFS_KEY).toBe('hqp:prefs');
		expect(DEFAULT_HQP_PREFS).toEqual({
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
		});
	});

	it('normalizes garbage to defaults field by field', () => {
		for (const input of [null, undefined, 42, 'x', [], { version: 9 }]) {
			expect(normalizeHqpPrefs(input)).toEqual(DEFAULT_HQP_PREFS);
		}
		const prefs = normalizeHqpPrefs({
			quality: '1080p',
			volume: 7,
			muted: 'yes',
			audioLanguage: 'ENG',
			subtitleMode: 'loud',
			subtitleLanguage: '<script>',
			subtitleStyle: { size: 'xl', background: 'neon', color: 'yellow' },
			autoplayNext: false,
			autoHideMs: 4000,
			frameModes: { scope: 'fill', wide: 'stretch' },
			liteGlass: true,
			resume: false,
			hints: { fineScrub: true }
		});
		expect(prefs.quality).toBe('1080p');
		expect(prefs.volume).toBe(1);
		expect(prefs.muted).toBe(false);
		expect(prefs.audioLanguage).toBe('eng');
		expect(prefs.subtitleMode).toBe('auto');
		expect(prefs.subtitleLanguage).toBe('fre');
		expect(prefs.subtitleStyle).toEqual({
			size: 'xl',
			background: 'shadow',
			color: 'yellow',
			position: 'auto'
		});
		expect(prefs.autoplayNext).toBe(false);
		expect(prefs.autoHideMs).toBe(3000);
		expect(prefs.frameModes).toEqual({ standard: 'fit', wide: 'fit', scope: 'fill' });
		expect(prefs.liteGlass).toBe(true);
		expect(prefs.resume).toBe(false);
		expect(prefs.hints).toEqual({ fineScrub: true, homeScreen: false });
		expect(normalizeHqpPrefs({ volume: -1 }).volume).toBe(0);
		expect(normalizeHqpPrefs({ volume: 0.4 }).volume).toBe(0.4);
		expect(normalizeHqpPrefs({ quality: 'best' }).quality).toBe('auto');
	});

	it('merges a patch and keeps the nested groups', () => {
		const next = mergeHqpPrefs(DEFAULT_HQP_PREFS, {
			volume: 0.5,
			subtitleStyle: { color: 'yellow' },
			frameModes: { scope: 'fill' },
			hints: { homeScreen: true }
		});
		expect(next.volume).toBe(0.5);
		expect(next.subtitleStyle).toEqual({ ...DEFAULT_HQP_PREFS.subtitleStyle, color: 'yellow' });
		expect(next.frameModes.scope).toBe('fill');
		expect(next.frameModes.standard).toBe('fit');
		expect(next.hints).toEqual({ fineScrub: false, homeScreen: true });
	});

	it('loads and saves through a guarded storage', () => {
		const storage = memoryStorage();
		expect(loadHqpPrefs(storage)).toEqual(DEFAULT_HQP_PREFS);
		saveHqpPrefs(storage, { ...DEFAULT_HQP_PREFS, muted: true });
		expect(JSON.parse(storage.getItem(HQP_PREFS_KEY) as string).muted).toBe(true);
		expect(loadHqpPrefs(storage).muted).toBe(true);
		expect(loadHqpPrefs(memoryStorage({ [HQP_PREFS_KEY]: '{oops' }))).toEqual(DEFAULT_HQP_PREFS);
		expect(loadHqpPrefs(null)).toEqual(DEFAULT_HQP_PREFS);
		const throwing = {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		} as unknown as Storage;
		expect(loadHqpPrefs(throwing)).toEqual(DEFAULT_HQP_PREFS);
		expect(() => saveHqpPrefs(throwing, DEFAULT_HQP_PREFS)).not.toThrow();
		expect(() => saveHqpPrefs(undefined, DEFAULT_HQP_PREFS)).not.toThrow();
	});

	it('classifies picture aspects', () => {
		expect(aspectClassOf(16 / 9)).toBe('standard');
		expect(aspectClassOf(1.85)).toBe('standard');
		expect(aspectClassOf(2)).toBe('wide');
		expect(aspectClassOf(2.2)).toBe('wide');
		expect(aspectClassOf(2.39)).toBe('scope');
		expect(aspectClassOf(null)).toBe('standard');
	});
});
