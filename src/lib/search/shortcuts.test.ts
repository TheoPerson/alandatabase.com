import { describe, expect, it } from 'vitest';
import {
	isApplePlatform,
	isEditableTarget,
	resolvePaletteShortcut,
	shortcutLabel,
	type ShortcutEvent
} from './shortcuts';

function key(overrides: Partial<ShortcutEvent> & { key: string }): ShortcutEvent {
	return {
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		defaultPrevented: false,
		isComposing: false,
		repeat: false,
		target: { tagName: 'BODY' },
		...overrides
	};
}

describe('isEditableTarget', () => {
	it('is true for text fields, selects and contenteditable', () => {
		expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
		expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
		expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
		expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
	});

	it('is false for buttons, links, the body and nothing', () => {
		expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false);
		expect(isEditableTarget({ tagName: 'A' })).toBe(false);
		expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
		expect(isEditableTarget(null)).toBe(false);
		expect(isEditableTarget({})).toBe(false);
	});
});

describe('resolvePaletteShortcut', () => {
	it('toggles on Ctrl+K and Cmd+K, in any letter case', () => {
		expect(resolvePaletteShortcut(key({ key: 'k', ctrlKey: true }))).toBe('toggle');
		expect(resolvePaletteShortcut(key({ key: 'K', metaKey: true }))).toBe('toggle');
	});

	it('toggles even from inside a text field', () => {
		const target = { tagName: 'INPUT' };
		expect(resolvePaletteShortcut(key({ key: 'k', ctrlKey: true, target }))).toBe('toggle');
	});

	it('opens on a bare slash outside editable targets', () => {
		expect(resolvePaletteShortcut(key({ key: '/' }))).toBe('open');
		expect(resolvePaletteShortcut(key({ key: '/', target: { tagName: 'BUTTON' } }))).toBe('open');
	});

	it('opens on slash typed with Shift (AZERTY keyboards need it)', () => {
		expect(resolvePaletteShortcut(key({ key: '/', shiftKey: true }))).toBe('open');
	});

	it('ignores slash while typing', () => {
		expect(resolvePaletteShortcut(key({ key: '/', target: { tagName: 'INPUT' } }))).toBeNull();
		expect(resolvePaletteShortcut(key({ key: '/', target: { tagName: 'TEXTAREA' } }))).toBeNull();
		expect(
			resolvePaletteShortcut(key({ key: '/', target: { tagName: 'DIV', isContentEditable: true } }))
		).toBeNull();
	});

	it('ignores slash with other modifiers', () => {
		expect(resolvePaletteShortcut(key({ key: '/', ctrlKey: true }))).toBeNull();
		expect(resolvePaletteShortcut(key({ key: '/', metaKey: true }))).toBeNull();
		expect(resolvePaletteShortcut(key({ key: '/', altKey: true }))).toBeNull();
	});

	it('ignores Ctrl+Shift+K and Ctrl+Alt+K (browser and assistive tool shortcuts)', () => {
		expect(resolvePaletteShortcut(key({ key: 'k', ctrlKey: true, shiftKey: true }))).toBeNull();
		expect(resolvePaletteShortcut(key({ key: 'k', ctrlKey: true, altKey: true }))).toBeNull();
	});

	it('ignores plain letters, handled events, IME composition and key repeat', () => {
		expect(resolvePaletteShortcut(key({ key: 'k' }))).toBeNull();
		expect(
			resolvePaletteShortcut(key({ key: 'k', ctrlKey: true, defaultPrevented: true }))
		).toBeNull();
		expect(resolvePaletteShortcut(key({ key: '/', isComposing: true }))).toBeNull();
		expect(resolvePaletteShortcut(key({ key: 'k', ctrlKey: true, repeat: true }))).toBeNull();
	});
});

describe('isApplePlatform and shortcutLabel', () => {
	it('detects Apple platforms from the platform string', () => {
		expect(isApplePlatform({ platform: 'MacIntel' })).toBe(true);
		expect(isApplePlatform({ platform: 'iPhone' })).toBe(true);
		expect(isApplePlatform({ platform: 'iPad' })).toBe(true);
		expect(isApplePlatform({ platform: 'Win32' })).toBe(false);
		expect(isApplePlatform({ platform: 'Linux x86_64' })).toBe(false);
	});

	it('prefers the user-agent data platform when available', () => {
		expect(isApplePlatform({ userAgentData: { platform: 'macOS' }, platform: '' })).toBe(true);
		expect(isApplePlatform({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' })).toBe(
			false
		);
	});

	it('falls back to the user agent, and to false without any information', () => {
		expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe(
			true
		);
		expect(isApplePlatform({})).toBe(false);
		expect(isApplePlatform(undefined)).toBe(false);
	});

	it('labels the shortcut for the platform', () => {
		expect(shortcutLabel(false)).toBe('Ctrl K');
		expect(shortcutLabel(true)).toBe('⌘K');
	});
});
