// Auto quality (spec 4.3). The server offers one variant per session, so adaptation is a pure
// decision here and a session restart at the current position in the engine.
import type { QualityLevel } from '$lib/media/types';
import type { Delivery, QualityChoice } from './types';

export interface AbrInput {
	now: number;
	choice: QualityChoice;
	active: QualityLevel;
	available: QualityLevel[];
	lastSwitchAt: number;
	stalls: Array<{ start: number; end: number | null; seek: boolean }>;
	bufferAhead: number;
	throughput: number | null;
	bitrate: number | null;
	remaining: number;
	paused: boolean;
	seeking: boolean;
	/** Optional: path in use; defaults to hls.js when a throughput is known, else native. */
	delivery?: Delivery;
	/** Optional (hls.js): lowest throughput measured over the last 60 s; null when under 60 s. */
	sustainedThroughput?: number | null;
	/** Optional: the original stream's measured bitrate, the target when stepping back to it. */
	originalBitrate?: number | null;
}

export type AbrDecision =
	| { action: 'none' }
	| { action: 'down' | 'up'; to: QualityLevel }
	| { action: 'suggest'; to: QualityLevel };

const LEVEL_BITRATE: Record<Exclude<QualityLevel, 'original'>, number> = {
	'2160p': 20e6,
	'1080p': 8e6,
	'720p': 4e6,
	'480p': 1.5e6
};

/** Approximate bitrate of a level (spec 4.2); Original uses its measured rate when known. */
export function levelBitrate(
	level: QualityLevel,
	originalBitrate: number | null | undefined
): number {
	return level === 'original' ? (originalBitrate ?? 40e6) : LEVEL_BITRATE[level];
}

const NONE: AbrDecision = { action: 'none' };

export function decideQuality(input: AbrInput): AbrDecision {
	const { now, stalls, available, active } = input;
	if (input.paused || input.seeking) return NONE;
	const at = available.indexOf(active);
	const lower = at >= 0 ? available[at + 1] : undefined;
	const higher = at > 0 ? available[at - 1] : undefined;
	const real = stalls
		.filter((s) => !s.seek && s.start >= input.lastSwitchAt)
		.map((s) => ({ start: s.start, length: (s.end ?? now) - s.start, end: s.end ?? now }));

	if (input.choice !== 'auto') {
		const long = real.filter((s) => s.length > 4000 && s.start >= now - 120_000);
		return long.length >= 2 && lower ? { action: 'suggest', to: lower } : NONE;
	}
	if (now - input.lastSwitchAt < 30_000) return NONE;

	const hlsJs = (input.delivery ?? (input.throughput === null ? 'native' : 'hls.js')) === 'hls.js';
	const weak =
		hlsJs &&
		input.throughput !== null &&
		input.bitrate !== null &&
		input.throughput < 1.1 * input.bitrate &&
		input.bufferAhead < 8;
	if (
		lower &&
		(real.some((s) => s.length > 4000) ||
			real.filter((s) => s.length > 1000 && s.start >= now - 60_000).length >= 2 ||
			weak)
	) {
		return { action: 'down', to: lower };
	}

	const calm = !real.some((s) => s.end > now - 120_000);
	if (!higher || !calm || now - input.lastSwitchAt < 180_000 || input.remaining <= 300) return NONE;
	const ok = hlsJs
		? (input.sustainedThroughput ?? 0) >= 1.6 * levelBitrate(higher, input.originalBitrate)
		: input.bufferAhead >= 45;
	return ok ? { action: 'up', to: higher } : NONE;
}
