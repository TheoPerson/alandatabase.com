import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeMedia } from './testing/fake-media';
import { FakeHls } from './testing/fake-hls';
import { backoffDelay, createTransport, HLS_CONFIG, type TransportFailure } from './transport';

const loadHls = vi.fn(async () => FakeHls as never);

function setup(delivery: 'native' | 'hls.js') {
	const media = createFakeMedia();
	const failures: TransportFailure[] = [];
	const network: boolean[] = [];
	const transport = createTransport(media, delivery, {
		loadHls,
		now: () => Date.now(),
		onFailure: (f) => failures.push(f),
		onNetwork: (ok) => network.push(ok)
	});
	return { media, transport, failures, network };
}

beforeEach(() => {
	vi.useFakeTimers();
	FakeHls.reset();
	loadHls.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('native transport', () => {
	it('sets src and seeks at loadedmetadata, without loading hls.js', async () => {
		const { media, transport } = setup('native');
		await transport.attach('/m.m3u8', 600);
		expect(media.src).toBe('/m.m3u8');
		expect(media.currentTime).toBe(0);
		media.fake.loadMetadata(3600);
		expect(media.currentTime).toBe(600);
		expect(loadHls).not.toHaveBeenCalled();
		expect(transport.stats()).toEqual({ bitrate: null, throughput: null, sustained: null });
	});

	it('does not seek after destroy', async () => {
		const { media, transport } = setup('native');
		await transport.attach('/m.m3u8', 600);
		transport.destroy();
		media.fake.loadMetadata(3600);
		expect(media.currentTime).toBe(0);
	});
});

describe('hls.js transport', () => {
	it('imports hls.js light on this path only, with the buffer config and start position', async () => {
		const { media, transport } = setup('hls.js');
		await transport.attach('/i.m3u8', 600);
		expect(loadHls).toHaveBeenCalledOnce();
		const hls = FakeHls.instances[0];
		expect(hls.config).toEqual({ ...HLS_CONFIG, startPosition: 600 });
		expect(HLS_CONFIG).toEqual({
			maxBufferLength: 60,
			maxMaxBufferLength: 120,
			backBufferLength: 30,
			maxBufferSize: 120e6,
			enableWorker: true
		});
		expect(hls.source).toBe('/i.m3u8');
		expect(hls.media).toBe(media);
		transport.destroy();
		expect(hls.destroyed).toBe(true);
	});

	it('starts at the beginning with startPosition -1 and reports unsupported MSE', async () => {
		const { transport, failures } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		expect(FakeHls.instances[0].config.startPosition).toBe(-1);
		FakeHls.supported = false;
		const other = setup('hls.js');
		await other.transport.attach('/i.m3u8', 0);
		expect(other.failures).toEqual([{ kind: 'unsupported', status: null, detail: 'MSE' }]);
		expect(failures).toEqual([]);
	});

	it('retries fatal network errors with 2/4/8/16/30 s backoff, then gives up after 60 s', async () => {
		const { media, transport, failures, network } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		media.currentTime = 42;
		const delays = [2000, 4000, 8000, 16000];
		for (const [i, delay] of delays.entries()) {
			hls.error('networkError', 'fragLoadError', 0);
			vi.advanceTimersByTime(delay - 1);
			expect(hls.startLoads).toHaveLength(i);
			vi.advanceTimersByTime(1);
			expect(hls.startLoads).toHaveLength(i + 1);
		}
		expect(hls.startLoads.every((p) => p === 42)).toBe(true);
		expect(network).toEqual([false]);
		expect(failures).toEqual([]);
		// The next wait is 30 s; 60 s after the first failure without a loaded fragment: fatal.
		hls.error('networkError', 'fragLoadError', 0);
		vi.advanceTimersByTime(29_999);
		expect(failures).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(failures).toEqual([{ kind: 'network', status: 0, detail: 'fragLoadError' }]);
		expect(hls.startLoads).toHaveLength(4);
		expect(backoffDelay(9)).toBe(30000);
	});

	it('a loaded fragment resets the backoff and reports the network back', async () => {
		const { transport, failures, network } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		hls.error('networkError', 'fragLoadError', 0);
		vi.advanceTimersByTime(2000);
		hls.frag(2_000_000, 4, 100);
		expect(network).toEqual([false, true]);
		hls.error('networkError', 'fragLoadError', 0);
		vi.advanceTimersByTime(2000);
		expect(hls.startLoads).toHaveLength(2);
		vi.advanceTimersByTime(120_000);
		expect(failures.filter((f) => f.kind === 'network')).toHaveLength(1);
	});

	it('retries a superseded segment (409) at once, and retryNow skips the wait', async () => {
		const { transport } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		hls.error('networkError', 'fragLoadError', 409);
		vi.advanceTimersByTime(0);
		expect(hls.startLoads).toHaveLength(1);
		hls.error('networkError', 'fragLoadError', 0);
		transport.retryNow();
		expect(hls.startLoads).toHaveLength(2);
	});

	it('maps expired sessions and definitive HTTP statuses without retrying', async () => {
		const { transport, failures } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		hls.error('networkError', 'fragLoadError', 404);
		hls.error('networkError', 'levelLoadError', 410);
		hls.error('networkError', 'fragLoadError', 401);
		hls.error('networkError', 'fragLoadError', 503);
		expect(failures.map((f) => [f.kind, f.status])).toEqual([
			['expired', 404],
			['expired', 410],
			['http', 401],
			['http', 503]
		]);
		expect(hls.startLoads).toEqual([]);
	});

	it('recovers one fatal media error, then reports decode', async () => {
		const { transport, failures } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		hls.error('mediaError', 'bufferAppendError');
		expect(hls.recovers).toBe(1);
		expect(failures).toEqual([]);
		transport.mediaError('video-error-3');
		expect(failures).toEqual([{ kind: 'decode', status: null, detail: 'video-error-3' }]);
		hls.fire('hlsError', { type: 'otherError', details: 'internalException', fatal: true });
		expect(failures.at(-1)).toEqual({ kind: 'other', status: null, detail: 'internalException' });
	});

	it('ignores non-fatal errors', async () => {
		const { transport, failures } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		FakeHls.instances[0].fire('hlsError', { type: 'networkError', details: 'x', fatal: false });
		expect(failures).toEqual([]);
	});

	it('measures bitrate and throughput from loaded fragments, sustained over 60 s', async () => {
		const { transport } = setup('hls.js');
		await transport.attach('/i.m3u8', 0);
		const hls = FakeHls.instances[0];
		// 5 MB over a 4 s fragment = 10 Mb/s; loaded in 0.5 s = 80 Mb/s.
		hls.frag(5_000_000, 4, 500);
		expect(transport.stats()).toEqual({ bitrate: 10e6, throughput: 80e6, sustained: null });
		for (let i = 0; i < 16; i++) {
			vi.advanceTimersByTime(4000);
			hls.frag(5_000_000, 4, i === 3 ? 1000 : 500);
		}
		const stats = transport.stats();
		expect(stats.bitrate).toBe(10e6);
		// The slowest fragment of the last 60 s (1 s load = 40 Mb/s) is the sustained rate.
		expect(stats.sustained).toBe(40e6);
	});

	it('reports a failed hls.js download as a network failure', async () => {
		const media = createFakeMedia();
		const failures: TransportFailure[] = [];
		const transport = createTransport(media, 'hls.js', {
			loadHls: async () => {
				throw new Error('chunk');
			},
			now: () => Date.now(),
			onFailure: (f) => failures.push(f)
		});
		await transport.attach('/i.m3u8', 0);
		expect(failures).toEqual([{ kind: 'network', status: null, detail: 'hls.js download failed' }]);
	});
});
