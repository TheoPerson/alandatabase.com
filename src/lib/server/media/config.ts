// Runtime configuration of the owner's media streaming, read from the process environment.
// Streaming is disabled (every media route answers 503) until MEDIA_LIBRARY_ROOTS is set, so a
// hosted deployment without a local library never spawns ffmpeg.

import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

export interface MediaConfig {
	/** Library folders; a file is only ever streamed when its real path is inside one of them. */
	roots: string[];
	ffmpegPath: string;
	ffprobePath: string;
	/** Keyframe indexes, subtitles, chapters, trickplay sheets and live session segments. */
	cacheDir: string;
}

type Env = Record<string, string | undefined>;

/** Splits MEDIA_LIBRARY_ROOTS on the platform path delimiter (";" on Windows) or new lines. */
export function parseLibraryRoots(value: string | undefined, separator = delimiter): string[] {
	if (!value) return [];
	return value
		.split(separator)
		.flatMap((part) => part.split(/\r?\n/u))
		.map((part) => part.trim())
		.filter(Boolean);
}

export function readMediaConfig(env: Env = process.env): MediaConfig | null {
	const roots = parseLibraryRoots(env.MEDIA_LIBRARY_ROOTS);
	if (roots.length === 0) return null;
	return {
		roots,
		ffmpegPath: env.FFMPEG_PATH?.trim() || 'ffmpeg',
		ffprobePath: env.FFPROBE_PATH?.trim() || 'ffprobe',
		cacheDir: env.MEDIA_CACHE_DIR?.trim() || join(tmpdir(), 'alandb-media')
	};
}
