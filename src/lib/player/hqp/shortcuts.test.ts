import { describe, expect, it } from 'vitest';
import { HQP_SHORTCUTS, matchHqpShortcut, shouldHandleHqpShortcut } from './shortcuts';

const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({
	key: k,
	shiftKey: false,
	altKey: false,
	ctrlKey: false,
	metaKey: false,
	target: null,
	...extra
});

describe('HQP shortcuts', () => {
	it('maps every key of the spec table', () => {
		const table: Array<[string, boolean, string]> = [
			[' ', false, 'toggle'],
			['k', false, 'toggle'],
			['K', true, 'toggle'],
			['j', false, 'back10'],
			['l', false, 'forward10'],
			['ArrowLeft', false, 'back5'],
			['ArrowRight', false, 'forward5'],
			['ArrowLeft', true, 'prevChapter'],
			['ArrowRight', true, 'nextChapter'],
			['ArrowUp', false, 'volumeUp'],
			['ArrowDown', false, 'volumeDown'],
			['m', false, 'mute'],
			['f', false, 'fullscreen'],
			['c', false, 'subtitles'],
			['a', false, 'audioNext'],
			['s', false, 'tracks'],
			['i', false, 'info'],
			['e', false, 'episodes'],
			['n', false, 'nextItem'],
			['p', false, 'pip'],
			['Home', false, 'home'],
			['End', false, 'end'],
			[',', false, 'frameBack'],
			['.', false, 'frameForward'],
			['.', true, 'frameForward'],
			['<', false, 'slower'],
			['>', true, 'faster'],
			['?', true, 'help'],
			['Escape', false, 'escape']
		];
		for (const [k, shift, action] of table) {
			expect(matchHqpShortcut(key(k, { shiftKey: shift }))?.action, k).toBe(action);
		}
		expect(matchHqpShortcut(key('0'))).toEqual({ action: 'percent', percent: 0 });
		expect(matchHqpShortcut(key('7', { shiftKey: true }))).toEqual({
			action: 'percent',
			percent: 70
		});
		expect(matchHqpShortcut(key('x'))).toBeNull();
	});

	it('lists each action once in the help table with a label and display', () => {
		const actions = HQP_SHORTCUTS.map((s) => s.action);
		expect(new Set(actions).size).toBe(actions.length);
		for (const s of HQP_SHORTCUTS) expect(s.label && s.display).toBeTruthy();
	});

	it('ignores Ctrl, Meta and Alt combinations', () => {
		expect(matchHqpShortcut(key('k', { ctrlKey: true }))).toBeNull();
		expect(matchHqpShortcut(key('f', { metaKey: true }))).toBeNull();
		expect(matchHqpShortcut(key('ArrowLeft', { altKey: true }))).toBeNull();
		expect(shouldHandleHqpShortcut(key('k', { ctrlKey: true }))).toBe(false);
	});

	it('ignores typing targets and leaves controls their own keys', () => {
		const input = { tagName: 'INPUT', getAttribute: () => null };
		const editable = { tagName: 'DIV', isContentEditable: true, getAttribute: () => null };
		const button = { tagName: 'BUTTON', getAttribute: () => null };
		const slider = {
			tagName: 'DIV',
			getAttribute: (n: string) => (n === 'role' ? 'slider' : null)
		};
		const radio = { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'radio' : null) };
		const t = (target: unknown, k: string) =>
			shouldHandleHqpShortcut(key(k, { target: target as EventTarget }));
		expect(t(input, 'k')).toBe(false);
		expect(t(editable, 'f')).toBe(false);
		expect(t(button, ' ')).toBe(false);
		expect(t(button, 'ArrowLeft')).toBe(false);
		expect(t(button, 'k')).toBe(true);
		expect(t(slider, 'ArrowRight')).toBe(false);
		expect(t(slider, 'Home')).toBe(false);
		expect(t(slider, 'End')).toBe(false);
		expect(t(button, 'End')).toBe(true);
		expect(t(radio, 'ArrowDown')).toBe(false);
		expect(t(null, ' ')).toBe(true);
		expect(t(null, 'q')).toBe(false);
	});
});
