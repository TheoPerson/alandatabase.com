// Scrub-preview thumbnails: one frame every 10 s, 480 px wide at the picture's own shape (sharp in
// a 216-272 CSS px preview at DPR 3), tiled 6x6 per WebP sprite sheet (2880 px wide, so three
// decoded sheets stay near 45 MB). Generated through the library queue from keyframes only (CUDA
// decode when available, Matroska fed through the paced reader), HDR tone-mapped to SDR, cached per
// file. Sheets of an older version are regenerated.

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TrickplayManifest, VideoInfo } from '$lib/media/types';
import type { BackgroundQueue } from './background';
import { keyframeCacheKey, type FileIdentity } from './keyframes';
import { runCommand, type RunResult } from './process';
import { sourceTransfer } from './stream-plan';
import { pipeable } from './subtitles';

export const TRICKPLAY = {
	version: 2,
	intervalSeconds: 10,
	tileWidth: 480,
	columns: 6,
	rows: 6,
	quality: 72
} as const;

type Runner = (
	command: string,
	args: string[],
	options: { stdinFile?: string; signal?: AbortSignal }
) => Promise<RunResult>;

export interface TrickplayTarget extends FileIdentity {
	id: string;
	durationSeconds: number | null;
	video: VideoInfo | null;
}

export function tileHeight(video: VideoInfo): number {
	const height =
		Math.round((TRICKPLAY.tileWidth * video.height) / Math.max(1, video.width) / 2) * 2;
	return Math.max(2, height);
}

const TONEMAP =
	'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

/** `input` is the file path, or 'pipe:0' when the file is fed through the paced reader. */
export function trickplayArgs(
	input: string,
	outputPattern: string,
	video: VideoInfo,
	gpu: boolean
): string[] {
	const hdr = sourceTransfer(video) !== 'sdr';
	const filters = [
		`fps=fps=1/${TRICKPLAY.intervalSeconds}:start_time=0`,
		`scale=w=${TRICKPLAY.tileWidth}:h=${tileHeight(video)}:flags=lanczos`,
		...(hdr ? ['format=yuv420p10le', TONEMAP] : ['format=yuv420p']),
		`tile=${TRICKPLAY.columns}x${TRICKPLAY.rows}`
	];
	return [
		'-hide_banner',
		'-nostdin',
		'-loglevel',
		'error',
		'-y',
		...(gpu ? ['-hwaccel', 'cuda'] : []),
		'-skip_frame',
		'nokey',
		'-i',
		input,
		'-map',
		'0:v:0',
		'-an',
		'-sn',
		'-dn',
		'-vf',
		filters.join(','),
		'-c:v',
		'libwebp',
		'-quality',
		String(TRICKPLAY.quality),
		'-compression_level',
		'4',
		'-f',
		'image2',
		'-start_number',
		'0',
		outputPattern
	];
}

interface StoredManifest {
	version?: number;
	tileWidth: number;
	tileHeight: number;
	sheets: number;
}

export class TrickplayService {
	private readonly failed = new Set<string>();

	constructor(
		private readonly options: {
			cacheDir: string;
			ffmpegPath: string;
			queue: BackgroundQueue;
			gpu: boolean;
			/** Whether background reads may proceed (no session needs the disk). */
			gate?: () => boolean;
			run?: Runner;
		}
	) {}

	private dir(file: FileIdentity): string {
		return join(this.options.cacheDir, 'trickplay', keyframeCacheKey(file));
	}

	sheetPath(file: FileIdentity, sheet: number): string {
		return join(this.dir(file), `sheet-${sheet}.webp`);
	}

	/** The cached manifest of the current version, or null. */
	private async stored(file: FileIdentity): Promise<StoredManifest | null> {
		try {
			const value = JSON.parse(
				await readFile(join(this.dir(file), 'manifest.json'), 'utf8')
			) as StoredManifest;
			return value.version === TRICKPLAY.version ? value : null;
		} catch {
			return null;
		}
	}

	/** Manifest for the player; starts background generation the first time. */
	async manifest(
		file: TrickplayTarget,
		sheetUrl: (sheet: number) => string
	): Promise<TrickplayManifest> {
		const base = {
			intervalSeconds: TRICKPLAY.intervalSeconds,
			tileWidth: TRICKPLAY.tileWidth,
			tileHeight: file.video ? tileHeight(file.video) : 0,
			columns: TRICKPLAY.columns,
			rows: TRICKPLAY.rows
		};
		if (!file.video) return { status: 'unavailable', ...base, sheets: [] };
		const stored = await this.stored(file);
		if (stored) {
			return {
				status: 'ready',
				...base,
				tileHeight: stored.tileHeight,
				sheets: Array.from({ length: stored.sheets }, (_, n) => sheetUrl(n))
			};
		}
		const key = keyframeCacheKey(file);
		if (this.failed.has(key)) return { status: 'unavailable', ...base, sheets: [] };
		this.options.queue.enqueue({
			key: `trickplay:${key}`,
			priority: 5,
			fileId: file.id,
			preemptible: true,
			run: (signal) => this.generate(file, signal)
		});
		return { status: 'pending', ...base, sheets: [] };
	}

	async generate(file: TrickplayTarget, signal?: AbortSignal): Promise<void> {
		if (!file.video || (await this.stored(file))) return;
		const dir = this.dir(file);
		const work = `${dir}.${Date.now()}.tmp`;
		await mkdir(work, { recursive: true });
		if (signal?.aborted) return void (await rm(work, { recursive: true, force: true }));
		const gate = this.options.gate ?? (() => true);
		const run: Runner =
			this.options.run ??
			((command, args, { stdinFile, signal: abort }) =>
				runCommand(command, args, {
					lowPriority: true,
					timeoutMs: 2 * 3600_000,
					signal: abort,
					stdinFile: stdinFile ? { path: stdinFile, gate } : undefined
				}));
		const pipe = pipeable(file.path);
		try {
			const result = await run(
				this.options.ffmpegPath,
				trickplayArgs(
					pipe ? 'pipe:0' : file.path,
					join(work, 'sheet-%d.webp'),
					file.video,
					this.options.gpu
				),
				{ stdinFile: pipe ? file.path : undefined, signal }
			);
			// Cancelled or preempted: not a failure, it runs again when asked.
			if (signal?.aborted) return;
			const sheets = (await readdir(work)).filter((name) => /^sheet-\d+\.webp$/u.test(name)).length;
			if (result.code !== 0 || sheets === 0) {
				this.failed.add(keyframeCacheKey(file));
				return;
			}
			const manifest: StoredManifest = {
				version: TRICKPLAY.version,
				tileWidth: TRICKPLAY.tileWidth,
				tileHeight: tileHeight(file.video),
				sheets
			};
			await writeFile(join(work, 'manifest.json'), JSON.stringify(manifest));
			await rm(dir, { recursive: true, force: true });
			await rename(work, dir);
		} finally {
			await rm(work, { recursive: true, force: true }).catch(() => undefined);
		}
	}
}
