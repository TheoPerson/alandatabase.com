// Player context: the engine (or a no-op stand-in until it exists), its four stores, the UI state
// and the root element. Components read stores as $snapshot, $clock, $cues and $prefs.
import { getContext, setContext } from 'svelte';
import type {
	FrameMode,
	HqpClock,
	HqpCue,
	HqpEngine,
	HqpLaunchPayload,
	HqpPrefs,
	HqpState,
	Readable
} from '$lib/player/hqp/types';
import type { HqpUi } from './ui-state.svelte';

export interface HqpContext {
	/** The live engine; a no-op stand-in before the client creates it. */
	readonly engine: HqpEngine;
	readonly snapshot: Readable<HqpState>;
	readonly clock: Readable<HqpClock>;
	readonly cues: Readable<HqpCue[]>;
	readonly prefs: Readable<HqpPrefs>;
	readonly ui: HqpUi;
	readonly launch: HqpLaunchPayload;
	/** The player root (null during SSR). */
	readonly root: () => HTMLElement | null;
	/** Leaves the player (the route navigates back). */
	readonly close: () => void;
	/** Fit / Fill with the FLIP of section 5.5, remembered per aspect class. */
	readonly setFrame: (mode: FrameMode) => void;
}

const KEY = Symbol('hqp');

export function setHqpContext(context: HqpContext): HqpContext {
	return setContext(KEY, context);
}

export function getHqpContext(): HqpContext {
	const context = getContext<HqpContext | undefined>(KEY);
	if (!context) throw new Error('HQP parts must render inside HqpPlayer');
	return context;
}
