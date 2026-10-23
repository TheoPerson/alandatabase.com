// LRU of decoded trickplay sheets (at most 3, about 40 MB). The loader is injected so the policy is
// testable without images.
import { lruTouch, TRICKPLAY_SHEET_LIMIT } from './trickplay';

export interface HeldSheet {
	release(): void;
}

export function createSheetCache(load: (url: string) => HeldSheet, limit = TRICKPLAY_SHEET_LIMIT) {
	let order: string[] = [];
	const held = new Map<string, HeldSheet>();
	return {
		/** `urls` is current first, then neighbours (sheetsAround); the current ends most recent. */
		touch(urls: string[]) {
			// Load the current sheet first; then order so the current one ends most recent.
			for (const url of urls) if (!held.has(url)) held.set(url, load(url));
			for (const url of [...urls].reverse()) {
				const [next, evicted] = lruTouch(order, url, limit);
				order = next;
				for (const gone of evicted) {
					held.get(gone)?.release();
					held.delete(gone);
				}
			}
		},
		held: () => [...order],
		clear() {
			for (const sheet of held.values()) sheet.release();
			held.clear();
			order = [];
		}
	};
}

/** Browser loader: decodes off the main thread and drops the bitmap on release. */
export function imageSheet(url: string): HeldSheet {
	const img = new Image();
	img.decoding = 'async';
	img.src = url;
	img.decode?.().catch(() => {});
	return { release: () => img.removeAttribute('src') };
}
