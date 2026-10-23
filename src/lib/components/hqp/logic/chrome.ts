// When the player chrome may hide (section 6.5). Pure.

export interface ChromeInput {
	playing: boolean;
	buffering: boolean;
	focusWithin: boolean;
	overlayOpen: boolean;
	scrubbing: boolean;
	pointerOverControls: boolean;
	idleMs: number;
	delayMs: number;
}

export function shouldHideChrome(input: ChromeInput): boolean {
	return (
		input.playing &&
		!input.buffering &&
		!input.focusWithin &&
		!input.overlayOpen &&
		!input.scrubbing &&
		!input.pointerOverControls &&
		input.idleMs >= input.delayMs
	);
}

/**
 * Chrome visibility after a tap on the picture. While playing, a tap toggles it; on a paused,
 * ended or autoplay-blocked player the chrome always stays, so a tap never leaves a still frame
 * with no controls and no cue.
 */
export function chromeAfterTap(input: { chrome: boolean; playing: boolean }): boolean {
	return input.playing ? !input.chrome : true;
}
