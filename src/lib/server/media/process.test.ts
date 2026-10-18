import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCommand, trackedChildCount } from './process';

// A child that counts the bytes it receives on stdin.
const COUNT_STDIN = [
	'-e',
	"let n = 0; process.stdin.on('data', (c) => (n += c.length)); process.stdin.on('end', () => process.stdout.write(String(n)));"
];

let dir: string;
let input: string;
const SIZE = 5 * 1024 * 1024 + 123;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'media-process-'));
	input = join(dir, 'input.bin');
	await writeFile(input, Buffer.alloc(SIZE, 7));
});
afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('runCommand with a paced stdin file', () => {
	it('feeds the whole file, reading only while the gate is open', async () => {
		let checks = 0;
		let closedChecks = 0;
		const gate = () => {
			checks++;
			// Closed for a while in the middle of the file (a playback session needs the disk).
			const closed = checks > 2 && closedChecks < 4;
			if (closed) closedChecks++;
			return !closed;
		};
		const result = await runCommand(process.execPath, COUNT_STDIN, {
			stdinFile: { path: input, gate, pollMs: 5 },
			timeoutMs: 20_000
		});
		expect(result.code).toBe(0);
		expect(Number(result.stdout)).toBe(SIZE);
		expect(closedChecks).toBe(4);
		expect(trackedChildCount()).toBe(0);
	});

	it('stops reading and kills the child when aborted', async () => {
		const controller = new AbortController();
		const started = Date.now();
		const run = runCommand(process.execPath, COUNT_STDIN, {
			// The gate never opens: the job waits until it is cancelled.
			stdinFile: { path: input, gate: () => false, pollMs: 5 },
			signal: controller.signal,
			timeoutMs: 20_000
		});
		setTimeout(() => controller.abort('cancelled'), 50);
		const result = await run;
		expect(result.code).not.toBe(0);
		expect(Date.now() - started).toBeLessThan(5000);
		expect(trackedChildCount()).toBe(0);
	});

	it('reports a missing input file as a failure without hanging', async () => {
		const result = await runCommand(process.execPath, COUNT_STDIN, {
			stdinFile: { path: join(dir, 'gone.bin'), gate: () => true },
			timeoutMs: 20_000
		});
		expect(result.code).not.toBe(0);
	});
});
