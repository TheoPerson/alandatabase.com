import { describe, expect, it } from 'vitest';
import { shouldHideChrome, type ChromeInput } from './chrome';

const idle: ChromeInput = {
	playing: true,
	buffering: false,
	focusWithin: false,
	overlayOpen: false,
	scrubbing: false,
	pointerOverControls: false,
	idleMs: 3000,
	delayMs: 3000
};

describe('shouldHideChrome', () => {
	it('hides after the delay while playing and idle', () => {
		expect(shouldHideChrome(idle)).toBe(true);
		expect(shouldHideChrome({ ...idle, idleMs: 2999 })).toBe(false);
		expect(shouldHideChrome({ ...idle, idleMs: 2600, delayMs: 2500 })).toBe(true);
	});

	it('stays while any blocking condition holds', () => {
		expect(shouldHideChrome({ ...idle, playing: false })).toBe(false);
		expect(shouldHideChrome({ ...idle, buffering: true })).toBe(false);
		expect(shouldHideChrome({ ...idle, focusWithin: true })).toBe(false);
		expect(shouldHideChrome({ ...idle, overlayOpen: true })).toBe(false);
		expect(shouldHideChrome({ ...idle, scrubbing: true })).toBe(false);
		expect(shouldHideChrome({ ...idle, pointerOverControls: true })).toBe(false);
	});
});
