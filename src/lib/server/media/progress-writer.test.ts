import { describe, expect, it } from 'vitest';
import type { ProgressEntry } from '$lib/media/types';
import { ProgressWriter, type ProgressInput } from './progress-writer';

function setup() {
	let clock = 1_000_000;
	const writes: Array<[string, ProgressInput]> = [];
	const known = new Set(['f1', 'f2']);
	const writer = new ProgressWriter(
		async (userId, entry) => {
			writes.push([userId, entry]);
			if (!known.has(entry.fileId)) return null;
			return { ...entry, completed: false, updatedAt: '' } as ProgressEntry;
		},
		{ intervalMs: 5000, now: () => clock }
	);
	return { writer, writes, advance: (ms: number) => (clock += ms) };
}

const at = (fileId: string, positionSeconds: number): ProgressInput => ({
	fileId,
	positionSeconds,
	durationSeconds: 6000
});

describe('ProgressWriter', () => {
	it('writes at most once per file every 5 s and keeps the newest position', async () => {
		const { writer, writes, advance } = setup();
		expect(await writer.submit('u', at('f1', 10))).toBe('written');
		advance(1000);
		expect(await writer.submit('u', at('f1', 11))).toBe('deferred');
		advance(1000);
		expect(await writer.submit('u', at('f1', 12))).toBe('deferred');
		expect(writes).toHaveLength(1);
		await writer.flushAll();
		expect(writes.map(([, e]) => e.positionSeconds)).toEqual([10, 12]);
	});

	it('writes the trailing position when the window ends', async () => {
		const { writer, writes } = setup();
		const fast = new ProgressWriter(
			async (userId, entry) => {
				writes.push([userId, entry]);
				return { ...entry, completed: false, updatedAt: '' } as ProgressEntry;
			},
			{ intervalMs: 30 }
		);
		await fast.submit('u', at('f1', 1));
		await fast.submit('u', at('f1', 2));
		await new Promise((r) => setTimeout(r, 80));
		expect(writes.map(([, e]) => e.positionSeconds)).toEqual([1, 2]);
		void writer;
	});

	it('throttles per user and per file independently', async () => {
		const { writer, writes } = setup();
		await writer.submit('u', at('f1', 1));
		await writer.submit('u', at('f2', 1));
		await writer.submit('v', at('f1', 1));
		expect(writes).toHaveLength(3);
	});

	it('reports an unknown file and does not throttle it', async () => {
		const { writer, writes } = setup();
		expect(await writer.submit('u', at('nope', 1))).toBe('unknown-file');
		expect(await writer.submit('u', at('nope', 2))).toBe('unknown-file');
		expect(writes).toHaveLength(2);
	});

	it('allows a new immediate write after the window', async () => {
		const { writer, writes, advance } = setup();
		await writer.submit('u', at('f1', 1));
		advance(5001);
		expect(await writer.submit('u', at('f1', 9))).toBe('written');
		expect(writes).toHaveLength(2);
	});
});
