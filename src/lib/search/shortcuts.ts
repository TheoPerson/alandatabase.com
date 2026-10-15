// Keyboard rules for opening the palette, kept free of the DOM so they are unit tested.

/** The slice of a KeyboardEvent the rules read. */
export interface ShortcutEvent {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	defaultPrevented: boolean;
	isComposing: boolean;
	repeat: boolean;
	target: EditableCandidate | null;
}

export interface EditableCandidate {
	tagName?: string;
	isContentEditable?: boolean;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableTarget(target: EditableCandidate | null | undefined): boolean {
	if (!target) return false;
	if (target.isContentEditable) return true;
	return EDITABLE_TAGS.has((target.tagName ?? '').toUpperCase());
}

export type PaletteShortcut = 'toggle' | 'open';

/**
 * Ctrl/Cmd+K toggles from anywhere, a bare "/" opens when the user is not typing.
 * Shift is allowed on "/" because AZERTY keyboards need it to produce the character.
 */
export function resolvePaletteShortcut(event: ShortcutEvent): PaletteShortcut | null {
	if (event.defaultPrevented || event.isComposing || event.repeat) return null;

	if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
		return event.shiftKey || event.altKey ? null : 'toggle';
	}

	if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
		return isEditableTarget(event.target) ? null : 'open';
	}

	return null;
}

export interface PlatformInfo {
	userAgentData?: { platform?: string };
	platform?: string;
	userAgent?: string;
}

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/iu;

export function isApplePlatform(info: PlatformInfo | null | undefined): boolean {
	if (!info) return false;
	const platform = info.userAgentData?.platform || info.platform || info.userAgent || '';
	return APPLE_PLATFORM.test(platform);
}

export function shortcutLabel(apple: boolean): string {
	return apple ? '⌘K' : 'Ctrl K';
}
