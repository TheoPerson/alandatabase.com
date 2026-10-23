import type { PlayerPrefs } from './prefs';

export type ShortcutAction =
	| 'toggle'
	| 'back10'
	| 'forward10'
	| 'back5'
	| 'forward5'
	| 'volumeUp'
	| 'volumeDown'
	| 'mute'
	| 'fullscreen'
	| 'captions'
	| 'slower'
	| 'faster'
	| 'help';

export interface Shortcut {
	keys: string[];
	action: ShortcutAction;
	label: string;
	/** How the keys are shown in the help dialog. */
	display: string;
}

// One table feeds both the key handler and the help dialog.
export const SHORTCUTS: Shortcut[] = [
	{ keys: [' ', 'k', 'K'], action: 'toggle', label: 'Play / pause', display: 'Space or K' },
	{ keys: ['j', 'J'], action: 'back10', label: 'Back 10 seconds', display: 'J' },
	{ keys: ['l', 'L'], action: 'forward10', label: 'Forward 10 seconds', display: 'L' },
	{ keys: ['ArrowLeft'], action: 'back5', label: 'Back 5 seconds', display: '←' },
	{ keys: ['ArrowRight'], action: 'forward5', label: 'Forward 5 seconds', display: '→' },
	{ keys: ['ArrowUp'], action: 'volumeUp', label: 'Volume up', display: '↑' },
	{ keys: ['ArrowDown'], action: 'volumeDown', label: 'Volume down', display: '↓' },
	{ keys: ['m', 'M'], action: 'mute', label: 'Mute / unmute', display: 'M' },
	{ keys: ['f', 'F'], action: 'fullscreen', label: 'Fullscreen', display: 'F' },
	{ keys: ['c', 'C'], action: 'captions', label: 'Captions', display: 'C' },
	{ keys: ['<'], action: 'slower', label: 'Slower', display: '<' },
	{ keys: ['>'], action: 'faster', label: 'Faster', display: '>' },
	{ keys: ['?'], action: 'help', label: 'Keyboard shortcuts', display: '?' }
];

export function matchShortcut(event: Pick<KeyboardEvent, 'key'>): ShortcutAction | null {
	return SHORTCUTS.find((shortcut) => shortcut.keys.includes(event.key))?.action ?? null;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const CONTROL_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
const CONTROL_ROLES = new Set(['slider', 'button', 'switch', 'tab', 'radio', 'checkbox']);
// Keys a focused control must keep for its own activation or stepping.
const CONTROL_KEYS = new Set([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

interface ShortcutTarget {
	tagName?: string;
	isContentEditable?: boolean;
	getAttribute?: (name: string) => string | null;
}

function isControl(target: ShortcutTarget | null): boolean {
	if (!target) return false;
	if (CONTROL_TAGS.has(target.tagName ?? '')) return true;
	const role = target.getAttribute?.('role');
	return role !== null && role !== undefined && CONTROL_ROLES.has(role);
}

/** Shortcuts are single keys, so they never fire while typing or when turned off. */
export function shouldHandleShortcut(
	event: Pick<KeyboardEvent, 'key' | 'target'>,
	prefs: Pick<PlayerPrefs, 'shortcuts'>
): boolean {
	if (!prefs.shortcuts) return false;
	const target = event.target as ShortcutTarget | null;
	if (target && (TYPING_TAGS.has(target.tagName ?? '') || target.isContentEditable)) return false;
	if (CONTROL_KEYS.has(event.key) && isControl(target)) return false;
	return matchShortcut(event) !== null;
}
