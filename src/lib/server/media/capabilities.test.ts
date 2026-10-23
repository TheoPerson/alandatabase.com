import { describe, expect, it } from 'vitest';
import { PROBES, probeFfmpegSupport } from './capabilities';
import type { RunResult } from './process';

function result(code: number, stdout = ''): RunResult {
	return { code, stdout, stderr: '', timedOut: false };
}

describe('probeFfmpegSupport', () => {
	it('reports ffmpeg as unavailable when it does not run', async () => {
		const calls: string[][] = [];
		const support = await probeFfmpegSupport('ffmpeg', async (_cmd, args) => {
			calls.push(args);
			return result(-1);
		});
		expect(support).toEqual({ available: false, nvenc: false, cuda: false, libplacebo: false });
		expect(calls).toHaveLength(1);
	});

	it('probes NVENC, CUDA and libplacebo separately', async () => {
		const support = await probeFfmpegSupport('C:/ff/ffmpeg.exe', async (cmd, args) => {
			expect(cmd).toBe('C:/ff/ffmpeg.exe');
			if (args[0] === '-version') return result(0, 'ffmpeg version 9.0.2-full_build');
			if (args.includes('hevc_nvenc')) return result(0);
			if (args.includes('cuda=cu')) return result(0);
			return result(1); // no Vulkan
		});
		expect(support).toEqual({ available: true, nvenc: true, cuda: true, libplacebo: false });
	});

	it('uses only synthetic inputs (never touches the library)', () => {
		for (const args of Object.values(PROBES) as ReadonlyArray<readonly string[]>) {
			const input = args.indexOf('-i');
			if (input >= 0) expect(args[input - 1]).toBe('lavfi');
		}
	});
});
