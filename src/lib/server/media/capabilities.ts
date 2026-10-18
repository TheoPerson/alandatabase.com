// What this machine's ffmpeg can do, probed once with tiny synthetic inputs: whether ffmpeg runs
// at all (streaming is unavailable otherwise), NVENC encoding, CUDA, and Vulkan libplacebo.

import { runCommand, type RunResult } from './process';
import type { EncoderSupport } from './stream-plan';

export interface FfmpegSupport extends EncoderSupport {
	available: boolean;
}

type Runner = (command: string, args: string[]) => Promise<RunResult>;

const quick: Runner = (command, args) => runCommand(command, args, { timeoutMs: 20_000 });

const BASE = ['-hide_banner', '-nostdin', '-loglevel', 'error'];

export const PROBES = {
	version: ['-version'],
	nvenc: [
		...BASE,
		'-f',
		'lavfi',
		'-i',
		'color=c=black:s=256x256:d=0.1',
		'-frames:v',
		'1',
		'-c:v',
		'hevc_nvenc',
		'-f',
		'null',
		'-'
	],
	cuda: [
		...BASE,
		'-init_hw_device',
		'cuda=cu',
		'-f',
		'lavfi',
		'-i',
		'nullsrc=s=64x64:d=0.04',
		'-frames:v',
		'1',
		'-f',
		'null',
		'-'
	],
	libplacebo: [
		...BASE,
		'-init_hw_device',
		'vulkan=vk',
		'-filter_hw_device',
		'vk',
		'-f',
		'lavfi',
		'-i',
		'color=c=black:s=64x64:d=0.04',
		'-vf',
		'format=yuv420p10le,hwupload,libplacebo=format=nv12,hwdownload,format=nv12',
		'-frames:v',
		'1',
		'-f',
		'null',
		'-'
	]
} as const;

export async function probeFfmpegSupport(
	ffmpegPath: string,
	run: Runner = quick
): Promise<FfmpegSupport> {
	const version = await run(ffmpegPath, [...PROBES.version]);
	if (version.code !== 0 || !/ffmpeg version/iu.test(version.stdout)) {
		return { available: false, nvenc: false, cuda: false, libplacebo: false };
	}
	const [nvenc, cuda, libplacebo] = await Promise.all(
		(['nvenc', 'cuda', 'libplacebo'] as const).map(async (name) => {
			const result = await run(ffmpegPath, [...PROBES[name]]);
			return result.code === 0;
		})
	);
	return { available: true, nvenc, cuda, libplacebo };
}

const cache = new Map<string, Promise<FfmpegSupport>>();

/** Cached per ffmpeg path; a failed probe ("ffmpeg missing") is retried after a minute. */
export function ffmpegSupport(ffmpegPath: string): Promise<FfmpegSupport> {
	let entry = cache.get(ffmpegPath);
	if (!entry) {
		entry = probeFfmpegSupport(ffmpegPath);
		cache.set(ffmpegPath, entry);
		void entry.then((support) => {
			if (!support.available) setTimeout(() => cache.delete(ffmpegPath), 60_000).unref?.();
		});
	}
	return entry;
}
