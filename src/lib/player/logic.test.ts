import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, normalizePrefs, savePrefs } from './prefs';
import {
	clearAllResume,
	listResume,
	pruneResume,
	readResume,
	resumeOffer,
	writeResume
} from './resume';
import { formatTime, spokenTime } from './format-time';
import { shouldHideControls } from './auto-hide';
import { matchShortcut, shouldHandleShortcut } from './shortcuts';

function memoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => map.get(key) ?? null,
		key: (index: number) => [...map.keys()][index] ?? null,
		removeItem: (key: string) => void map.delete(key),
		setItem: (key: string, value: string) => void map.set(key, String(value))
	} as Storage;
}

describe('prefs', () => {
	it('falls back to defaults for garbage and clamps ranges', () => {
		expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
		expect(normalizePrefs('{broken')).toEqual(DEFAULT_PREFS);
		expect(
			normalizePrefs({ version: 1, speed: 9, volume: -3, captionSize: 'huge', unknown: 1 })
		).toEqual({ ...DEFAULT_PREFS, speed: 2, volume: 0 });
		expect(normalizePrefs({ version: 0, speed: 1.5 }).speed).toBe(1);
		expect(normalizePrefs({ version: 1, speed: 1.3 }).speed).toBe(1.25);
		expect(normalizePrefs({ version: 1, autoHideMs: 4000 }).autoHideMs).toBe(3000);
	});

	it('round-trips through storage and survives a throwing storage', () => {
		const storage = memoryStorage();
		savePrefs(storage, { ...DEFAULT_PREFS, speed: 1.25, oled: true });
		expect(loadPrefs(storage)).toMatchObject({ speed: 1.25, oled: true });

		const broken = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			}
		} as unknown as Storage;
		expect(loadPrefs(broken)).toEqual(DEFAULT_PREFS);
		expect(() => savePrefs(broken, DEFAULT_PREFS)).not.toThrow();
		expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
	});
});

describe('resume', () => {
	const now = Date.parse('2026-10-12T00:00:00Z');

	it('offers a resume only between 10 s and the last 15 s', () => {
		expect(resumeOffer(5, 120)).toBe(false);
		expect(resumeOffer(20, 120)).toBe(true);
		expect(resumeOffer(110, 120)).toBe(false);
		expect(resumeOffer(20, 0)).toBe(false);
	});

	it('writes, reads, expires after 90 days and keeps at most 50 entries', () => {
		const storage = memoryStorage();
		writeResume(storage, 'abcdefghijk', 42, 120, now);
		expect(readResume(storage, 'abcdefghijk', now)).toEqual({ position: 42, duration: 120 });
		expect(readResume(storage, 'abcdefghijk', now + 91 * 86_400_000)).toBeNull();
		expect(readResume(storage, 'missing0000', now)).toBeNull();

		for (let index = 0; index < 60; index += 1) {
			writeResume(storage, `k${String(index).padStart(10, '0')}`, 30, 100, now + index);
		}
		pruneResume(storage, now + 100);
		expect(listResume(storage).length).toBeLessThanOrEqual(50);
		expect(readResume(storage, 'k0000000059', now + 100)).not.toBeNull();
		expect(readResume(storage, 'abcdefghijk', now + 100)).toBeNull();

		expect(clearAllResume(storage)).toBe(50);
		expect(listResume(storage)).toEqual([]);
	});

	it('ignores corrupted entries and a missing storage', () => {
		const storage = memoryStorage();
		storage.setItem('player:pos:broken00000', '{not json');
		expect(readResume(storage, 'broken00000', now)).toBeNull();
		expect(readResume(null, 'abcdefghijk', now)).toBeNull();
		expect(() => writeResume(null, 'abcdefghijk', 1, 2, now)).not.toThrow();
	});
});

describe('time', () => {
	it('formats clock and spoken time', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(75)).toBe('1:15');
		expect(formatTime(3725)).toBe('1:02:05');
		expect(formatTime(Number.NaN)).toBe('0:00');
		expect(formatTime(-5)).toBe('0:00');
		expect(spokenTime(75)).toBe('1 minute 15 seconds');
		expect(spokenTime(3601)).toBe('1 hour 1 second');
		expect(spokenTime(0)).toBe('0 seconds');
	});
});

describe('auto-hide', () => {
	const base = {
		fullscreen: true,
		playing: true,
		buffering: false,
		focusWithin: false,
		sheetOpen: false,
		pillVisible: false,
		touch: false,
		idleMs: 3000,
		delayMs: 3000
	};

	it('hides only in fullscreen while playing after the delay', () => {
		expect(shouldHideControls(base)).toBe(true);
		expect(shouldHideControls({ ...base, idleMs: 1000 })).toBe(false);
		expect(shouldHideControls({ ...base, fullscreen: false })).toBe(false);
		expect(shouldHideControls({ ...base, playing: false })).toBe(false);
		expect(shouldHideControls({ ...base, buffering: true })).toBe(false);
		expect(shouldHideControls({ ...base, focusWithin: true })).toBe(false);
		expect(shouldHideControls({ ...base, sheetOpen: true })).toBe(false);
		expect(shouldHideControls({ ...base, pillVisible: true })).toBe(false);
		expect(shouldHideControls({ ...base, touch: true })).toBe(false);
	});
});

describe('shortcuts', () => {
	const div = { tagName: 'DIV', isContentEditable: false } as HTMLElement;

	it('maps keys to actions', () => {
		expect(matchShortcut({ key: ' ' })).toBe('toggle');
		expect(matchShortcut({ key: 'k' })).toBe('toggle');
		expect(matchShortcut({ key: 'j' })).toBe('back10');
		expect(matchShortcut({ key: 'ArrowRight' })).toBe('forward5');
		expect(matchShortcut({ key: '?' })).toBe('help');
		expect(matchShortcut({ key: 'q' })).toBeNull();
	});

	it('ignores typing targets and disabled prefs', () => {
		const textarea = { tagName: 'TEXTAREA', isContentEditable: false } as HTMLElement;
		const editable = { tagName: 'DIV', isContentEditable: true } as HTMLElement;
		expect(shouldHandleShortcut({ key: 'k', target: textarea }, DEFAULT_PREFS)).toBe(false);
		expect(shouldHandleShortcut({ key: 'k', target: editable }, DEFAULT_PREFS)).toBe(false);
		expect(
			shouldHandleShortcut({ key: 'k', target: div }, { ...DEFAULT_PREFS, shortcuts: false })
		).toBe(false);
		expect(shouldHandleShortcut({ key: 'k', target: div }, DEFAULT_PREFS)).toBe(true);
		expect(shouldHandleShortcut({ key: 'q', target: div }, DEFAULT_PREFS)).toBe(false);
	});
});
