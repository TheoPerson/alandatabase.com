// Keyframe index of a library file and the HLS segment boundaries derived from it.
//
// Direct stream copies the video untouched, so a segment can only start on a keyframe. Matroska
// files carry their keyframe list in the Cues element (read in ~30 ms on the HDD library and
// verified identical to an ffprobe packet scan); other files need an ffprobe packet scan, which
// reads the whole file (~180 MB/s on the library disk: 7-30 s per file) and therefore runs in the
// background. Indexes are cached as JSON keyed by path + size + mtime.

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMkvCueKeyframes } from './mkv-cues';

export const KEYFRAME_INDEX_VERSION = 1;
/** Target segment length; a segment ends at the first keyframe at or after this many seconds. */
export const TARGET_SEGMENT_SECONDS = 4;
/** Transcoded output forces a keyframe exactly every this many seconds. */
export const UNIFORM_SEGMENT_SECONDS = 4;

export interface FileIdentity {
	path: string;
	size: number;
	mtimeMs: number;
}

export interface KeyframeIndex {
	version: number;
	method: 'mkv-cues' | 'ffprobe';
	keyframes: number[]; // seconds, ascending, source timeline
	// End of the last video packet when known (ffprobe scan). Some files carry audio long after
	// the picture ends; playback stops with the picture.
	videoEnd?: number;
}

export function keyframeCacheKey(file: FileIdentity): string {
	return createHash('sha1')
		.update(`${file.path}\n${file.size}\n${Math.round(file.mtimeMs)}`)
		.digest('hex');
}

export function keyframeCachePath(cacheDir: string, file: FileIdentity): string {
	return join(cacheDir, 'keyframes', `${keyframeCacheKey(file)}.json`);
}

function isValidIndex(value: unknown): value is KeyframeIndex {
	const index = value as KeyframeIndex | null;
	return (
		!!index &&
		index.version === KEYFRAME_INDEX_VERSION &&
		(index.method === 'mkv-cues' || index.method === 'ffprobe') &&
		Array.isArray(index.keyframes) &&
		index.keyframes.length > 0 &&
		index.keyframes.every((t) => typeof t === 'number' && Number.isFinite(t))
	);
}

export async function readCachedIndex(
	cacheDir: string,
	file: FileIdentity
): Promise<KeyframeIndex | null> {
	try {
		const parsed: unknown = JSON.parse(await readFile(keyframeCachePath(cacheDir, file), 'utf8'));
		return isValidIndex(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export async function writeCachedIndex(
	cacheDir: string,
	file: FileIdentity,
	index: KeyframeIndex
): Promise<void> {
	const target = keyframeCachePath(cacheDir, file);
	await mkdir(join(cacheDir, 'keyframes'), { recursive: true });
	const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temp, JSON.stringify(index));
	await rename(temp, target);
}

/**
 * Keyframes usable for segmenting: sorted, unique, within the file, and dense enough that no
 * segment would be absurdly long (a truncated or sparse index falls back to a packet scan).
 */
export function usableKeyframes(
	keyframes: number[],
	durationSeconds: number | null,
	videoEnd?: number | null
): number[] | null {
	// A first keyframe slightly before zero (B-frame delay in MP4 edit lists) still opens segment 0.
	const sorted = [...new Set(keyframes.filter((t) => Number.isFinite(t) && t > -2))].sort(
		(a, b) => a - b
	);
	if (sorted.length === 0) return null;
	if (sorted[0] > 1) return null;
	let end = durationSeconds && durationSeconds > 0 ? durationSeconds : sorted[sorted.length - 1];
	if (videoEnd && videoEnd > 0) end = Math.min(end, videoEnd);
	const within = sorted.filter((t) => t < end);
	let maxGap = 0;
	for (let i = 1; i < within.length; i++) maxGap = Math.max(maxGap, within[i] - within[i - 1]);
	maxGap = Math.max(maxGap, end - within[within.length - 1]);
	if (maxGap > 30) return null;
	return within;
}

/** Fast path: the Matroska Cues (null for other containers or unusable cues). */
export async function readFastKeyframeIndex(
	path: string,
	durationSeconds: number | null
): Promise<KeyframeIndex | null> {
	if (!/\.(mkv|webm|mk3d)$/iu.test(path)) return null;
	const cues = await readMkvCueKeyframes(path).catch(() => null);
	const keyframes = cues ? usableKeyframes(cues, durationSeconds) : null;
	return keyframes ? { version: KEYFRAME_INDEX_VERSION, method: 'mkv-cues', keyframes } : null;
}

export function ffprobeKeyframeArgs(path: string): string[] {
	return [
		'-v',
		'error',
		'-select_streams',
		'v:0',
		'-show_entries',
		'packet=pts_time,duration_time,flags',
		'-of',
		'csv=p=0',
		path
	];
}

/** Parses `pts_time,duration_time,flags` CSV lines: keyframe times and the end of the video. */
export function parseFfprobePackets(csv: string): { keyframes: number[]; videoEnd: number | null } {
	const times: number[] = [];
	let videoEnd: number | null = null;
	for (const line of csv.split(/\r?\n/u)) {
		const fields = line.split(',');
		if (fields.length < 2) continue;
		const time = fields[0];
		const flags = fields[fields.length - 1];
		const value = Number(time);
		if (time === '' || !Number.isFinite(value)) continue;
		const duration = fields.length > 2 ? Number(fields[1]) : 0;
		const end = value + (Number.isFinite(duration) ? duration : 0);
		videoEnd = videoEnd === null ? end : Math.max(videoEnd, end);
		if (flags.includes('K')) times.push(value);
	}
	return { keyframes: [...new Set(times)].sort((a, b) => a - b), videoEnd };
}

/**
 * Segment start times (source seconds). Segment 0 starts at 0; each next segment starts at the
 * first keyframe at least `target` seconds after the previous start. A final sliver shorter than
 * half a second is merged into the previous segment.
 */
export function planKeyframeSegments(
	keyframes: number[],
	durationSeconds: number,
	target = TARGET_SEGMENT_SECONDS
): number[] {
	const boundaries = [0];
	for (const time of keyframes) {
		if (time >= durationSeconds) break;
		if (time >= boundaries[boundaries.length - 1] + target) boundaries.push(time);
	}
	if (boundaries.length > 1 && durationSeconds - boundaries[boundaries.length - 1] < 0.5) {
		boundaries.pop();
	}
	return boundaries;
}

/** Uniform boundaries for transcoded output (keyframes forced at every multiple of `seconds`). */
export function planUniformSegments(
	durationSeconds: number,
	seconds = UNIFORM_SEGMENT_SECONDS
): number[] {
	const boundaries: number[] = [];
	for (let t = 0; t < durationSeconds; t += seconds) boundaries.push(t);
	if (boundaries.length > 1 && durationSeconds - boundaries[boundaries.length - 1] < 0.5) {
		boundaries.pop();
	}
	return boundaries.length ? boundaries : [0];
}

export function segmentDurations(boundaries: number[], durationSeconds: number): number[] {
	return boundaries.map((start, k) => (boundaries[k + 1] ?? durationSeconds) - start);
}

/** Index of the segment containing `seconds` (clamped). */
export function segmentAt(boundaries: number[], seconds: number): number {
	let low = 0;
	let high = boundaries.length - 1;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if (boundaries[mid] <= seconds) low = mid;
		else high = mid - 1;
	}
	return low;
}
