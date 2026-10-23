export interface AutoHideInput {
	fullscreen: boolean;
	playing: boolean;
	buffering: boolean;
	focusWithin: boolean;
	sheetOpen: boolean;
	pillVisible: boolean;
	touch: boolean;
	idleMs: number;
	delayMs: number;
}

/**
 * Controls hide only when nothing needs them: fullscreen, playing, not
 * buffering, nothing focused or open, no touch session, idle past the delay.
 * Pure so the shell's timer can call it every tick without side effects.
 */
export function shouldHideControls(input: AutoHideInput): boolean {
	if (!input.fullscreen || !input.playing || input.buffering) return false;
	if (input.focusWithin || input.sheetOpen || input.pillVisible || input.touch) return false;
	return input.idleMs >= input.delayMs;
}
