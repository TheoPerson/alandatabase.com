import { isApplePlatform, shortcutLabel } from './shortcuts';

// One shared switch for the search palette: the layout renders the palette once and
// anything (the top bar, a keyboard shortcut) opens it through here.
//
// Module state is shared by every request on the server. Nothing below writes to it
// while rendering: it only changes from event handlers and effects, which run in the
// browser, so no request can leak into another.

let isOpen = $state(false);
let apple = $state(false);

export const palette = {
	get isOpen() {
		return isOpen;
	},
	set isOpen(value: boolean) {
		isOpen = value;
	},
	open() {
		isOpen = true;
	},
	close() {
		isOpen = false;
	},
	toggle() {
		isOpen = !isOpen;
	},
	/** "Ctrl K" until the browser proves it is an Apple platform, so server and client markup agree. */
	get shortcut() {
		return shortcutLabel(apple);
	},
	/** Call from an effect or onMount only. */
	detectPlatform() {
		apple = isApplePlatform(navigator as unknown as Parameters<typeof isApplePlatform>[0]);
	}
};
