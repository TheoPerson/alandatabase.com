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
