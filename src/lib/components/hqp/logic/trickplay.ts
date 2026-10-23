// Trickplay sprite maths. Pure. Sheets hold columns x rows tiles, one every intervalSeconds.
import type { TrickplayManifest } from '$lib/media/types';

export interface TrickplayTile {
	url: string;
	x: number;
	y: number;
	tileWidth: number;
	tileHeight: number;
	sheetWidth: number;
	sheetHeight: number;
}

export const TRICKPLAY_SHEET_LIMIT = 3;

function usable(manifest: TrickplayManifest): boolean {
	return (
		manifest.status === 'ready' &&
		manifest.sheets.length > 0 &&
		manifest.intervalSeconds > 0 &&
		manifest.columns > 0 &&
		manifest.rows > 0
	);
}

function tileIndex(manifest: TrickplayManifest, seconds: number): number {
	const perSheet = manifest.columns * manifest.rows;
	const last = manifest.sheets.length * perSheet - 1;
	const raw = Math.floor(Math.max(0, seconds) / manifest.intervalSeconds);
	return Math.min(raw, last);
}

export function tileAt(manifest: TrickplayManifest, seconds: number): TrickplayTile | null {
	if (!usable(manifest)) return null;
	const perSheet = manifest.columns * manifest.rows;
	const index = tileIndex(manifest, seconds);
	const sheet = Math.floor(index / perSheet);
	const within = index % perSheet;
	return {
		url: manifest.sheets[sheet],
		x: (within % manifest.columns) * manifest.tileWidth,
		y: Math.floor(within / manifest.columns) * manifest.tileHeight,
		tileWidth: manifest.tileWidth,
		tileHeight: manifest.tileHeight,
		sheetWidth: manifest.columns * manifest.tileWidth,
		sheetHeight: manifest.rows * manifest.tileHeight
	};
}

/** The sheet under `seconds` first, then its neighbours (current +- 1). */
export function sheetsAround(manifest: TrickplayManifest, seconds: number): string[] {
	if (!usable(manifest)) return [];
	const perSheet = manifest.columns * manifest.rows;
	const sheet = Math.floor(tileIndex(manifest, seconds) / perSheet);
	return [sheet, sheet - 1, sheet + 1]
		.filter((n) => n >= 0 && n < manifest.sheets.length)
		.map((n) => manifest.sheets[n]);
}

/** Moves `url` to the front of a most-recent-first list capped at `limit`; returns the evicted. */
export function lruTouch(
	list: string[],
	url: string,
	limit = TRICKPLAY_SHEET_LIMIT
): [string[], string[]] {
	const next = [url, ...list.filter((entry) => entry !== url)];
	return [next.slice(0, limit), next.slice(limit)];
}
