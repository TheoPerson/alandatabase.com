// Child processes for media work (ffmpeg / ffprobe). Arguments are always passed as arrays (no
// shell), every child is tracked so it is killed when the server exits, and background jobs run
// at low CPU priority.

import { spawn, type ChildProcess } from 'node:child_process';
import { open } from 'node:fs/promises';
import { constants, setPriority } from 'node:os';

const children = new Set<ChildProcess>();
let exitHookInstalled = false;

function installExitHook(): void {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	process.once('exit', () => {
		for (const child of children) {
			try {
				child.kill();
			} catch {
				// already gone
			}
		}
	});
}

export interface SpawnOptions {
	lowPriority?: boolean;
	/** Give the child a writable stdin (for a paced input file). */
	stdin?: boolean;
}

/**
 * A library file fed to the child's stdin ("-i pipe:0") instead of being opened by it, so its
 * reads can be paced: a chunk is read only while `gate()` is true. Windows offers no I/O priority
 * for child processes; this is how a whole-file background job yields the disk to playback.
 */
export interface StdinFile {
	path: string;
	gate: () => boolean;
	pollMs?: number;
	chunkBytes?: number;
}

/** Spawns a tracked child with piped stdout/stderr. */
export function spawnTracked(
	command: string,
	args: string[],
	options: SpawnOptions = {}
): ChildProcess {
	installExitHook();
	const child = spawn(command, args, {
		stdio: [options.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
		windowsHide: true,
		shell: false
	});
	children.add(child);
	child.once('close', () => children.delete(child));
	child.once('error', () => children.delete(child));
	if (options.lowPriority && child.pid) {
		try {
			setPriority(child.pid, constants.priority.PRIORITY_LOW);
		} catch {
			// not permitted: keep the default priority
		}
	}
	return child;
}

export function trackedChildCount(): number {
	return children.size;
}

export interface RunResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Writes `source` to the child's stdin in chunks, waiting while the gate is closed. */
async function feedFile(child: ChildProcess, source: StdinFile): Promise<void> {
	const stdin = child.stdin;
	if (!stdin) return;
	let closed = false;
	const stop = () => (closed = true);
	stdin.once('error', stop); // EPIPE once the child has read what it needs or died
	stdin.once('close', stop);
	child.once('close', stop);
	const handle = await open(source.path, 'r');
	try {
		const size = source.chunkBytes ?? 1024 * 1024;
		for (;;) {
			while (!closed && !source.gate()) await sleep(source.pollMs ?? 100);
			if (closed) return;
			const chunk = Buffer.allocUnsafe(size);
			const { bytesRead } = await handle.read(chunk, 0, size, null);
			if (closed) return;
			if (bytesRead === 0) break;
			if (!stdin.write(bytesRead === size ? chunk : chunk.subarray(0, bytesRead))) {
				await new Promise<void>((resolve) => {
					const done = () => {
						stdin.off('drain', done);
						stdin.off('close', done);
						stdin.off('error', done);
						resolve();
					};
					stdin.on('drain', done);
					stdin.on('close', done);
					stdin.on('error', done);
				});
			}
		}
		stdin.end();
	} finally {
		await handle.close();
	}
}

/** Runs a command to completion, collecting output (bounded) with a timeout. */
export function runCommand(
	command: string,
	args: string[],
	options: SpawnOptions & {
		timeoutMs?: number;
		maxOutputBytes?: number;
		signal?: AbortSignal;
		stdinFile?: StdinFile;
	} = {}
): Promise<RunResult> {
	const limit = options.maxOutputBytes ?? 64 * 1024 * 1024;
	return new Promise((resolve) => {
		let child: ChildProcess;
		if (options.signal?.aborted) {
			resolve({ code: -1, stdout: '', stderr: 'aborted', timedOut: false });
			return;
		}
		try {
			child = spawnTracked(command, args, { ...options, stdin: !!options.stdinFile });
		} catch (error) {
			resolve({ code: -1, stdout: '', stderr: String(error), timedOut: false });
			return;
		}
		const out: Buffer[] = [];
		let outBytes = 0;
		let err = '';
		let timedOut = false;
		let settled = false;
		const finish = (code: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener('abort', onAbort);
			resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: err, timedOut });
		};
		const onAbort = () => child.kill();
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, options.timeoutMs ?? 120_000);
		options.signal?.addEventListener('abort', onAbort, { once: true });
		child.stdout?.on('data', (chunk: Buffer) => {
			outBytes += chunk.length;
			if (outBytes <= limit) out.push(chunk);
			else child.kill();
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			err = (err + chunk.toString('utf8')).slice(-8000);
		});
		child.once('error', (error) => {
			err += `\n${error.message}`;
			finish(-1);
		});
		child.once('close', (code) => finish(code));
		if (options.stdinFile) {
			feedFile(child, options.stdinFile).catch((error: unknown) => {
				err += `\ninput: ${String(error)}`;
				child.kill();
			});
		}
	});
}
