// The sticky filter bar tucks away while the visitor reads down the grid and comes back the
// moment they scroll up, the way Safari and the TV apps treat their toolbars.

export interface RevealState {
	hidden: boolean;
	/** Where the last direction change was measured from. */
	anchorY: number;
}

/** Scroll distance that counts as a deliberate direction, not a momentum bounce. */
export const REVEAL_TOLERANCE = 12;

/**
 * @param y the current scroll position
 * @param tuckAfter the scroll position below which the bar always shows (its natural place)
 */
export function nextReveal(state: RevealState, y: number, tuckAfter: number): RevealState {
	if (y <= tuckAfter) return { hidden: false, anchorY: y };
	const delta = y - state.anchorY;
	if (Math.abs(delta) <= REVEAL_TOLERANCE) return state;
	return { hidden: delta > 0, anchorY: y };
}
