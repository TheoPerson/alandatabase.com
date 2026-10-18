// Keyframe indexes on demand: cached JSON first, then the Matroska Cues (milliseconds), and
// otherwise a background ffprobe packet scan (whole-file read, low priority, one at a time).
// While a file has no index, playback uses the GPU transcode path; the next session goes direct.

import type { BackgroundQueue } from './background';
import {
	ffprobeKeyframeArgs,
	keyframeCacheKey,
	KEYFRAME_INDEX_VERSION,
	parseFfprobePackets,
	readCachedIndex,
	readFastKeyframeIndex,
	usableKeyframes,
	writeCachedIndex,
	type FileIdentity,
	type KeyframeIndex
} from './keyframes';
import { runCommand, type RunResult } from './process';

export interface IndexTarget extends FileIdentity {
	durationSeconds: number | null;
}

type Runner = (command: string, args: string[], signal?: AbortSignal) => Promise<RunResult>;

const scanRunner: Runner = (command, args, signal) =>
	runCommand(command, args, { lowPriority: true, timeoutMs: 15 * 60_000, signal });

export class KeyframeIndexer {
	constructor(
		private readonly options: {
			cacheDir: string;
			ffprobePath: string;
			queue: BackgroundQueue;
			run?: Runner;
		}
	) {}

	cached(file: FileIdentity): Promise<KeyframeIndex | null> {
		return readCachedIndex(this.options.cacheDir, file);
	}

	/** Cached index, else the fast Matroska path (cached on success), else null. */
	async quick(file: IndexTarget): Promise<KeyframeIndex | null> {
		const cached = await readCachedIndex(this.options.cacheDir, file);
		if (cached) return cached;
		const fast = await readFastKeyframeIndex(file.path, file.durationSeconds);
		if (fast) {
			await writeCachedIndex(this.options.cacheDir, file, fast).catch(() => undefined);
			return fast;
		}
		return null;
	}

	/** Full ffprobe packet scan (reads the whole file). */
	async scan(file: IndexTarget, signal?: AbortSignal): Promise<KeyframeIndex | null> {
		const run = this.options.run ?? scanRunner;
		const result = await run(this.options.ffprobePath, ffprobeKeyframeArgs(file.path), signal);
		if (result.code !== 0 || signal?.aborted) return null;
		const packets = parseFfprobePackets(result.stdout);
		const keyframes = usableKeyframes(packets.keyframes, file.durationSeconds, packets.videoEnd);
		if (!keyframes) return null;
		const index: KeyframeIndex = {
			version: KEYFRAME_INDEX_VERSION,
			method: 'ffprobe',
			keyframes,
			...(packets.videoEnd !== null ? { videoEnd: Math.round(packets.videoEnd * 1000) / 1000 } : {})
		};
		await writeCachedIndex(this.options.cacheDir, file, index);
		return index;
	}

	/** quick(), and when that fails a scan is queued for the next session. */
	async forPlayback(file: IndexTarget): Promise<KeyframeIndex | null> {
		const index = await this.quick(file);
		if (!index) this.enqueue(file, 10);
		return index;
	}

	enqueue(file: IndexTarget, priority = 0): boolean {
		return this.options.queue.enqueue({
			key: `keyframes:${keyframeCacheKey(file)}`,
			priority,
			// A whole-file read: an urgent job (subtitles the player asked for) goes first.
			preemptible: true,
			run: async (signal) => {
				if (await readCachedIndex(this.options.cacheDir, file)) return;
				await this.scan(file, signal);
			}
		});
	}
}
