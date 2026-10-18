// Layout geometry for Alan's HQP. Mirrors the media queries and tokens in hqp-tokens.css and the
// player CSS, so logic (gestures, FLIP, tests) and styles agree on every rectangle.
import type { AspectClass, FrameMode } from '$lib/player/hqp/types';

export type HqpLayout = 'phone-portrait' | 'phone-portrait-short' | 'phone-landscape' | 'large';

export interface Size {
	width: number;
	height: number;
}

export interface Insets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

const DEFAULT_ASPECT = 16 / 9;
/** Portrait picture: never above the top bar (53 + 44) plus 12 px, whatever the aspect. */
export const PORTRAIT_FRAME_MIN_TOP = 118;

/** `orientation: portrait` is true when height >= width, exactly like CSS. */
export function layoutFor(width: number, height: number): HqpLayout {
	if (height >= width) {
		if (width >= 600) return 'large';
		return height <= 759 ? 'phone-portrait-short' : 'phone-portrait';
	}
	return height <= 499 ? 'phone-landscape' : 'large';
}

export function isPortrait(layout: HqpLayout): boolean {
	return layout === 'phone-portrait' || layout === 'phone-portrait-short';
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Island-free chrome edges (section 3.2), mirroring --hqp-edge-top/x/bottom. */
export function chromeEdges(
	layout: HqpLayout,
	safe: Insets
): { top: number; x: number; bottom: number } {
	if (layout === 'large') return { top: 24, x: 48, bottom: 24 };
	const x = clamp(Math.max(safe.left, safe.right) - 14, 16, 48);
	const bottom = Math.max(safe.bottom, 14) + 4;
	const top = isPortrait(layout) ? Math.min(safe.top, 47) + 6 : 12;
	return { top, x, bottom };
}

function safeAspect(aspect: number): number {
	return Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT;
}

/** The picture rectangle in viewport coordinates (section 5.5). */
export function frameRect(
	layout: HqpLayout,
	viewport: Size,
	aspect: number,
	mode: FrameMode
): Rect {
	const { width: vw, height: vh } = viewport;
	if (mode === 'fill') return { x: 0, y: 0, width: vw, height: vh };
	const ar = safeAspect(aspect);
	const width = Math.min(vw, vh * ar);
	const height = Math.min(vh, vw / ar);
	const x = (vw - width) / 2;
	if (isPortrait(layout)) {
		const centre = (layout === 'phone-portrait-short' ? 0.36 : 0.43) * vh;
		const y = Math.min(Math.max(PORTRAIT_FRAME_MIN_TOP, centre - height / 2), vh - height);
		return { x, y: Math.max(0, y), width, height };
	}
	return { x, y: (vh - height) / 2, width, height };
}

/** Cover scale from the Fit size and the share of the picture Fill crops (section 5.5). */
export function fillCrop(viewport: Size, aspect: number): { scale: number; cropPercent: number } {
	const ar = safeAspect(aspect);
	const vr = viewport.width / viewport.height;
	const lo = Math.min(ar, vr);
	const hi = Math.max(ar, vr);
	return { scale: hi / lo, cropPercent: Math.round(100 * (1 - lo / hi)) };
}

export function aspectClass(aspect: number): AspectClass {
	const ar = safeAspect(aspect);
	if (ar <= 1.85) return 'standard';
	if (ar <= 2.2) return 'wide';
	return 'scope';
}

/** The Dynamic Island of an iPhone 18 Pro Max (assumed geometry, section 2); [] on large layouts. */
export function islandRects(viewport: Size): Rect[] {
	const { width: vw, height: vh } = viewport;
	if (layoutFor(vw, vh) === 'large') return [];
	if (vh >= vw) return [{ x: (vw - 126) / 2, y: 11, width: 126, height: 37 }];
	const y = (vh - 126) / 2;
	return [
		{ x: 11, y, width: 37, height: 126 },
		{ x: vw - 48, y, width: 37, height: 126 }
	];
}

/** Strict overlap: rectangles that only touch do not intersect. */
export function intersects(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
