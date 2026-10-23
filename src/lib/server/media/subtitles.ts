// WebVTT subtitles. Embedded text tracks are extracted by ffmpeg; since that reads the whole file,
// every text track of the file is extracted in the same pass and cached. External sidecar files
// (.srt/.ass/.vtt) are converted on request, with the legacy Windows-1252 encoding of many French
// .srt files detected. Image subtitles (PGS) cannot become WebVTT.

import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { SubtitleTrack } from '$lib/media/types';
import { JobCancelledError, type BackgroundQueue } from './background';
import { runCommand, type RunResult } from './process';

/** `stdinFile`: the library file to feed through the paced reader (args then read pipe:0). */
type Runner = (
	command: string,
	args: string[],
	options: { stdinFile?: string; signal?: AbortSignal }
) => Promise<RunResult>;

/** Matroska is read front to back, so it can be fed through a pipe at our pace. */
export function pipeable(path: string): boolean {
	return /\.(mkv|mka|mk3d|webm)$/iu.test(path);
}

const URGENT = 100;

export class SubtitleError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export function subtitleCachePath(
	cacheDir: string,
	fileId: string,
	mtimeMs: number,
	ordinal: number
): string {
	return join(cacheDir, 'subtitles', `${fileId}-${Math.round(mtimeMs)}-${ordinal}.vtt`);
}

const BASE = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y'];

export function embeddedSubtitleArgs(
	input: string,
	outputs: Array<{ streamOrdinal: number; path: string }>
): string[] {
	const args = [...BASE, '-i', input];
	for (const output of outputs) {
		args.push('-map', `0:s:${output.streamOrdinal}`, '-c:s', 'webvtt', '-f', 'webvtt', output.path);
	}
	return args;
}

export function externalSubtitleArgs(
	input: string,
	charset: string | null,
	output: string
): string[] {
	return [
		...BASE,
		...(charset ? ['-sub_charenc', charset] : []),
		'-i',
		input,
		'-map',
		'0:s:0',
		'-c:s',
		'webvtt',
		'-f',
		'webvtt',
		output
	];
}

/** Text encoding of a subtitle file: UTF-8/UTF-16 (BOM) or Windows-1252 for invalid UTF-8. */
export function detectCharset(bytes: Uint8Array): string | null {
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'UTF-16LE';
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'UTF-16BE';
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return null; // UTF-8 (ffmpeg's default)
	} catch {
		return 'CP1252';
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

export interface SubtitleFile {
	id: string;
	path: string;
	mtimeMs: number;
	subtitleTracks: SubtitleTrack[];
}

export class SubtitleService {
	private readonly inflight = new Map<string, Promise<void>>();

	constructor(
		private readonly options: {
			cacheDir: string;
			ffmpegPath: string;
			/** Whole-file extraction goes through the one-at-a-time library queue. */
			queue?: BackgroundQueue;
			/** Whether background reads may proceed (no session needs the disk). */
			gate?: () => boolean;
			run?: Runner;
		}
	) {}

	private runner(): Runner {
		const gate = this.options.gate ?? (() => true);
		return (
			this.options.run ??
			((command, args, { stdinFile, signal }) =>
				runCommand(command, args, {
					lowPriority: true,
					// Paced reads pause while playback needs the disk: allow for it.
					timeoutMs: 60 * 60_000,
					signal,
					stdinFile: stdinFile ? { path: stdinFile, gate } : undefined
				}))
		);
	}

	private extractionKey(file: SubtitleFile): string {
		return `${file.id}-${Math.round(file.mtimeMs)}`;
	}

	private async extractQueued(file: SubtitleFile, priority: number): Promise<void> {
		const queue = this.options.queue;
		if (!queue) return this.once(this.extractionKey(file), () => this.extractEmbedded(file));
		try {
			await queue.schedule({
				key: `subtitles:${this.extractionKey(file)}`,
				priority,
				fileId: file.id,
				run: (signal) => this.extractEmbedded(file, signal)
			});
		} catch (error) {
			if (error instanceof JobCancelledError) {
				throw new SubtitleError(503, 'Subtitle extraction was cancelled');
			}
			throw error;
		}
	}

	/**
	 * Path of the cached WebVTT for a track. `externalPath` must already be resolved and checked
	 * against the library roots by the caller.
	 */
	async get(file: SubtitleFile, ordinal: number, externalPath: string | null): Promise<string> {
		const track = file.subtitleTracks.find((t) => t.ordinal === ordinal);
		if (!track) throw new SubtitleError(404, 'Subtitle track not found');
		if (!track.isText)
			throw new SubtitleError(415, 'Image subtitles cannot be converted to WebVTT');
		const target = subtitleCachePath(this.options.cacheDir, file.id, file.mtimeMs, ordinal);
		if (await exists(target)) return target;
		await mkdir(join(this.options.cacheDir, 'subtitles'), { recursive: true });

		if (track.source === 'external') {
			if (!externalPath) throw new SubtitleError(404, 'Subtitle file not found');
			await this.once(target, () => this.convertExternal(externalPath, target));
		} else {
			await this.extractQueued(file, URGENT);
		}
		if (!(await exists(target))) throw new SubtitleError(502, 'Subtitle conversion failed');
		return target;
	}

	private async once(key: string, work: () => Promise<void>): Promise<void> {
		let entry = this.inflight.get(key);
		if (!entry) {
			entry = work().finally(() => this.inflight.delete(key));
			this.inflight.set(key, entry);
		}
		return entry;
	}

	private async convertExternal(input: string, target: string): Promise<void> {
		const head = await readFile(input).catch(() => null);
		if (!head) throw new SubtitleError(409, 'Subtitle file is gone');
		const temp = `${target}.${Date.now()}.tmp.vtt`;
		const result = await this.runner()(
			this.options.ffmpegPath,
			externalSubtitleArgs(input, detectCharset(head), temp),
			{}
		);
		if (result.code !== 0) {
			await rm(temp, { force: true });
			throw new SubtitleError(502, 'Subtitle conversion failed');
		}
		await rename(temp, target);
	}

	/**
	 * Extracts every embedded text track ahead of need (the whole-file read takes ~30 s for a 4K
	 * film on the library disk), so a subtitle switched on during playback is already there.
	 */
	prefetch(file: SubtitleFile, queue: BackgroundQueue, priority = 8): boolean {
		if (!file.subtitleTracks.some((t) => t.source === 'embedded' && t.isText)) return false;
		return queue.enqueue({
			key: `subtitles:${this.extractionKey(file)}`,
			priority,
			fileId: file.id,
			// A prefetch is a chore: an urgent job (a track the player asked for) goes first.
			preemptible: true,
			run: async (signal) => {
				await mkdir(join(this.options.cacheDir, 'subtitles'), { recursive: true });
				await this.extractEmbedded(file, signal);
			}
		});
	}

	private async extractEmbedded(file: SubtitleFile, signal?: AbortSignal): Promise<void> {
		const tracks = file.subtitleTracks.filter((t) => t.source === 'embedded' && t.isText);
		const missing = await Promise.all(
			tracks.map(
				async (t) =>
					!(await exists(
						subtitleCachePath(this.options.cacheDir, file.id, file.mtimeMs, t.ordinal)
					))
			)
		);
		if (!missing.some(Boolean)) return;
		const outputs = tracks.map((t) => ({
			ordinal: t.ordinal,
			streamOrdinal: t.ordinal,
			final: subtitleCachePath(this.options.cacheDir, file.id, file.mtimeMs, t.ordinal),
			path: `${subtitleCachePath(this.options.cacheDir, file.id, file.mtimeMs, t.ordinal)}.${Date.now()}.tmp.vtt`
		}));
		const pipe = pipeable(file.path);
		const result = await this.runner()(
			this.options.ffmpegPath,
			embeddedSubtitleArgs(pipe ? 'pipe:0' : file.path, outputs),
			{ stdinFile: pipe ? file.path : undefined, signal }
		);
		const complete = result.code === 0 && !signal?.aborted;
		for (const output of outputs) {
			if (complete && (await exists(output.path))) await rename(output.path, output.final);
			else await rm(output.path, { force: true });
		}
	}
}
