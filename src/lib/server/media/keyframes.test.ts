import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
	ffprobeKeyframeArgs,
	keyframeCacheKey,
	keyframeCachePath,
	parseFfprobePackets,
	planKeyframeSegments,
	planUniformSegments,
	readCachedIndex,
	segmentAt,
	segmentDurations,
	usableKeyframes,
	writeCachedIndex
} from './keyframes';

const dirs: string[] = [];
afterAll(async () => {
	for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

describe('planKeyframeSegments', () => {
	it('cuts at the first keyframe at or after the 4 s target', () => {
		const keyframes = [0, 3.792, 6.542, 16.542, 26, 36, 40.25, 41, 44.5];
		expect(planKeyframeSegments(keyframes, 50)).toEqual([0, 6.542, 16.542, 26, 36, 40.25, 44.5]);
	});

	it('starts at zero even when the first keyframe is a little later', () => {
		expect(planKeyframeSegments([0.083, 2.1, 4.2, 8.4], 10)).toEqual([0, 4.2, 8.4]);
	});

	it('merges a final sliver into the previous segment and ignores keyframes past the end', () => {
		expect(planKeyframeSegments([0, 4, 8, 9.8, 12], 10.1)).toEqual([0, 4, 8]);
		expect(planKeyframeSegments([0, 4, 8], 8.2)).toEqual([0, 4]);
	});

	it('handles long GOPs (10.4 s x265 keyint)', () => {
		expect(planKeyframeSegments([0, 10.43, 20.86, 31.29], 40)).toEqual([0, 10.43, 20.86, 31.29]);
	});
});

describe('planUniformSegments', () => {
	it('lists every multiple of 4 s below the duration', () => {
		expect(planUniformSegments(13)).toEqual([0, 4, 8, 12]);
		expect(planUniformSegments(12.3)).toEqual([0, 4, 8]);
		expect(planUniformSegments(2)).toEqual([0]);
	});

	it('computes durations and finds the segment of a time', () => {
		const boundaries = [0, 6.5, 16.5, 26];
		expect(segmentDurations(boundaries, 30)).toEqual([6.5, 10, 9.5, 4]);
		expect(segmentAt(boundaries, 0)).toBe(0);
		expect(segmentAt(boundaries, 6.49)).toBe(0);
		expect(segmentAt(boundaries, 6.5)).toBe(1);
		expect(segmentAt(boundaries, 100)).toBe(3);
		expect(segmentAt(boundaries, -5)).toBe(0);
	});
});

describe('usableKeyframes', () => {
	it('sorts, dedupes and drops keyframes past the duration', () => {
		expect(usableKeyframes([4, 0, 4, 8, 99], 10)).toEqual([0, 4, 8]);
	});

	it('keeps a first keyframe slightly before zero (MP4 edit list)', () => {
		expect(usableKeyframes([-0.04, 1.36, 1.88, 3.8], 5)).toEqual([-0.04, 1.36, 1.88, 3.8]);
		expect(planKeyframeSegments([-0.04, 1.36, 4.1], 9)).toEqual([0, 4.1]);
	});

	it('rejects sparse, truncated or late-starting indexes', () => {
		expect(usableKeyframes([0, 40], 50)).toBeNull();
		expect(usableKeyframes([0, 4, 8], 600)).toBeNull();
		expect(usableKeyframes([5, 9], 12)).toBeNull();
		expect(usableKeyframes([], 12)).toBeNull();
	});
});

describe('ffprobe keyframe scan', () => {
	it('builds read-only probe arguments for the first video stream', () => {
		expect(ffprobeKeyframeArgs('F:/MOVIES/a.mp4')).toEqual([
			'-v',
			'error',
			'-select_streams',
			'v:0',
			'-show_entries',
			'packet=pts_time,duration_time,flags',
			'-of',
			'csv=p=0',
			'F:/MOVIES/a.mp4'
		]);
	});

	it('keeps keyframe packets and the end of the last video packet', () => {
		const csv =
			'0.000000,0.041708,K__\r\n0.333000,0.041708,___\n1.001000,0.041708,K_\nN/A,0.04,K__\n,0.04,K__\n11.428083,0.041708,K__\n1.001000,0.041708,K__\n12.000000,0.041708,___\n';
		const parsed = parseFfprobePackets(csv);
		expect(parsed.keyframes).toEqual([0, 1.001, 11.428083]);
		expect(parsed.videoEnd).toBeCloseTo(12.041708, 6);
		expect(parseFfprobePackets('0.5,K__\n').keyframes).toEqual([0.5]);
	});

	it('accepts a picture that ends before the audio when the video end is known', () => {
		const keyframes = Array.from({ length: 597 }, (_, i) => i * 10); // 0 .. 5960
		expect(usableKeyframes(keyframes, 6223.9)).toBeNull();
		expect(usableKeyframes(keyframes, 6223.9, 5967.9)).toHaveLength(597);
	});
});

describe('keyframe cache', () => {
	it('keys on path, size and mtime and round-trips through disk', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kf-'));
		dirs.push(dir);
		const file = { path: 'F:/MOVIES/a.mkv', size: 10, mtimeMs: 1000.4 };
		expect(keyframeCacheKey(file)).not.toBe(keyframeCacheKey({ ...file, size: 11 }));
		expect(keyframeCacheKey(file)).not.toBe(keyframeCacheKey({ ...file, mtimeMs: 2000 }));
		expect(await readCachedIndex(dir, file)).toBeNull();
		await writeCachedIndex(dir, file, { version: 1, method: 'ffprobe', keyframes: [0, 4] });
		expect(await readCachedIndex(dir, file)).toEqual({
			version: 1,
			method: 'ffprobe',
			keyframes: [0, 4]
		});
	});

	it('ignores corrupt or outdated cache files', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kf-'));
		dirs.push(dir);
		const file = { path: 'F:/MOVIES/b.mkv', size: 10, mtimeMs: 1 };
		await writeCachedIndex(dir, file, { version: 1, method: 'ffprobe', keyframes: [0] });
		await writeFile(
			keyframeCachePath(dir, file),
			'{"version":0,"method":"ffprobe","keyframes":[0]}'
		);
		expect(await readCachedIndex(dir, file)).toBeNull();
		await writeFile(keyframeCachePath(dir, file), 'not json');
		expect(await readCachedIndex(dir, file)).toBeNull();
	});
});
