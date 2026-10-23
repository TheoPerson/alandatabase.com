// HQP keyboard shortcuts (spec 6.4). One table feeds the key handler and the help dialog.
// The trailer player's table (src/lib/player/shortcuts.ts) is separate and unchanged.
import type { HqpShortcut, HqpShortcutAction } from './types';

const s = (
	keys: string[],
	action: HqpShortcutAction,
	label: string,
	display: string,
	shift?: boolean
): HqpShortcut =>
	shift === undefined ? { keys, action, label, display } : { keys, shift, action, label, display };

export const HQP_SHORTCUTS: HqpShortcut[] = [
	s([' ', 'k', 'K'], 'toggle', 'Play / pause', 'Space or K'),
	s(['j', 'J'], 'back10', 'Back 10 seconds', 'J'),
	s(['l', 'L'], 'forward10', 'Forward 10 seconds', 'L'),
	s(['ArrowLeft'], 'back5', 'Back 5 seconds', '←', false),
	s(['ArrowRight'], 'forward5', 'Forward 5 seconds', '→', false),
	s(['ArrowLeft'], 'prevChapter', 'Previous chapter', 'Shift + ←', true),
	s(['ArrowRight'], 'nextChapter', 'Next chapter', 'Shift + →', true),
	s(['ArrowUp'], 'volumeUp', 'Volume up', '↑'),
	s(['ArrowDown'], 'volumeDown', 'Volume down', '↓'),
	s(['m', 'M'], 'mute', 'Mute / unmute', 'M'),
	s(['f', 'F'], 'fullscreen', 'Fullscreen', 'F'),
	s(['c', 'C'], 'subtitles', 'Subtitles on / off', 'C'),
	s(['a', 'A'], 'audioNext', 'Next audio track', 'A'),
	s(['s', 'S'], 'tracks', 'Audio and subtitles', 'S'),
	s(['i', 'I'], 'info', 'Playback info', 'I'),
	s(['e', 'E'], 'episodes', 'Episodes', 'E'),
	s(['n', 'N'], 'nextItem', 'Next episode', 'N'),
	s(['p', 'P'], 'pip', 'Picture in Picture', 'P'),
	s(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'percent', 'Jump to 0–90%', '0–9'),
	s(['Home'], 'home', 'Start', 'Home'),
	s(['End'], 'end', 'End', 'End'),
	s([','], 'frameBack', 'One frame back (paused)', ','),
	s(['.'], 'frameForward', 'One frame forward (paused)', '.'),
	s(['<'], 'slower', 'Slower', '<'),
	s(['>'], 'faster', 'Faster', '>'),
	s(['?'], 'help', 'Keyboard shortcuts', '?'),
	s(['Escape'], 'escape', 'Close the top layer', 'Esc')
];

type KeyInput = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

export function matchHqpShortcut(
	event: KeyInput
): { action: HqpShortcutAction; percent?: number } | null {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	const hit = HQP_SHORTCUTS.find(
		(sc) => sc.keys.includes(event.key) && (sc.shift === undefined || sc.shift === event.shiftKey)
	);
	if (!hit) return null;
	return hit.action === 'percent'
		? { action: 'percent', percent: Number(event.key) * 10 }
		: { action: hit.action };
}

// Same rules as the trailer player: never while typing; focused controls keep their own keys.
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const CONTROL_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
const CONTROL_ROLES = new Set(['slider', 'button', 'switch', 'tab', 'radio', 'checkbox']);
const CONTROL_KEYS = new Set([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const SLIDER_KEYS = new Set(['Home', 'End', 'PageUp', 'PageDown']);

interface ShortcutTarget {
	tagName?: string;
	isContentEditable?: boolean;
	getAttribute?: (name: string) => string | null;
}

export function shouldHandleHqpShortcut(
	event: Pick<KeyboardEvent, 'key' | 'target' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>
): boolean {
	const target = event.target as ShortcutTarget | null;
	if (target) {
		const tag = target.tagName ?? '';
		if (TYPING_TAGS.has(tag) || target.isContentEditable) return false;
		const role = target.getAttribute?.('role') ?? null;
		const control = CONTROL_TAGS.has(tag) || (role !== null && CONTROL_ROLES.has(role));
		if (control && CONTROL_KEYS.has(event.key)) return false;
		if (role === 'slider' && SLIDER_KEYS.has(event.key)) return false;
	}
	return matchHqpShortcut(event) !== null;
}
