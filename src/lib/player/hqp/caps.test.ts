import { describe, expect, it, vi } from 'vitest';
import {
	applyCapsOverride,
	CAPS_CACHE_KEY,
	CAPS_OVERRIDE_KEY,
	decodeFallbackCodec,
	detectCaps,
	disableCodec,
	readCapsOverride,
	resolveCaps
} from './caps';
import type { CapsProbe } from './types';

function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k) => data.get(k) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (k) => void data.delete(k),
		setItem: (k, v) => void data.set(k, String(v))
	};
}

const efficient = vi.fn(async () => ({ supported: true, powerEfficient: true }));

function appleProbe(over: Partial<CapsProbe> = {}): CapsProbe {
	return {
		vendor: 'Apple Computer, Inc.',
		canPlayType: () => 'maybe',
		// iOS 17.1+ exposes ManagedMediaSource: still native HLS on Apple.
		mseIsTypeSupported: () => true,
		hlsJsSupported: true,
		matchMedia: (q) => q === '(dynamic-range: high)',
		decodingInfo: efficient,
		...over
	};
}

function chromeProbe(over: Partial<CapsProbe> = {}): CapsProbe {
	return {
		vendor: 'Google Inc.',
		canPlayType: (t) => (t.includes('mpegurl') ? '' : 'probably'),
		mseIsTypeSupported: (t) => !t.includes('ac-3') && !t.includes('ec-3'),
		hlsJsSupported: true,
		matchMedia: () => false,
		decodingInfo: efficient,
		...over
	};
}

describe('detectCaps', () => {
	it('Apple WebKit gets native HLS with Dolby audio and multichannel', async () => {
		const { caps, delivery } = await detectCaps(appleProbe());
		expect(delivery).toBe('native');
		expect(caps).toEqual({
			h264: true,
			hevc: true,
			hevcMain10: true,
			av1: true,
			nativeHls: true,
			maxHeight: null,
			ac3: true,
			eac3: true,
			hdrDisplay: true,
			multichannel: true
		});
	});

	it('Chrome with MSE gets hls.js, no Dolby audio, stereo', async () => {
		const probe = chromeProbe();
		const { caps, delivery } = await detectCaps(probe);
		expect(delivery).toBe('hls.js');
		expect(caps).toMatchObject({
			h264: true,
			hevc: true,
			hevcMain10: true,
			av1: true,
			nativeHls: false,
			ac3: false,
			eac3: false,
			hdrDisplay: false,
			multichannel: false,
			maxHeight: null
		});
	});

	it('probes with the exact codec strings on the right API per path', async () => {
		const mse = vi.fn(() => true);
		const canPlay = vi.fn((t: string) => (t.includes('mpegurl') ? '' : 'maybe'));
		await detectCaps(chromeProbe({ mseIsTypeSupported: mse, canPlayType: canPlay }));
		const asked = mse.mock.calls.map((c) => (c as unknown as [string])[0]);
		expect(asked).toEqual(
			expect.arrayContaining([
				'video/mp4; codecs="avc1.640033"',
				'video/mp4; codecs="hvc1.1.6.L153.B0"',
				'video/mp4; codecs="hvc1.2.4.L153.B0"',
				'video/mp4; codecs="av01.0.12M.10"',
				'audio/mp4; codecs="ac-3"',
				'audio/mp4; codecs="ec-3"'
			])
		);
		expect(canPlay.mock.calls.every((c) => (c as unknown as [string])[0].includes('mpegurl'))).toBe(
			true
		);
		const native = vi.fn(() => 'probably');
		await detectCaps(appleProbe({ canPlayType: native, mseIsTypeSupported: mse }));
		expect(native).toHaveBeenCalledWith('audio/mp4; codecs="ec-3"');
	});

	it('uses native HLS without MSE, and reports unsupported without either', async () => {
		const noMse = { mseIsTypeSupported: null, hlsJsSupported: false };
		expect((await detectCaps(chromeProbe({ ...noMse, canPlayType: () => 'maybe' }))).delivery).toBe(
			'native'
		);
		const none = await detectCaps(chromeProbe({ ...noMse, canPlayType: () => '' }));
		expect(none.delivery).toBeNull();
		expect(none.caps.h264).toBe(false);
	});

	it('never uses hls.js on Apple, even without native HLS', async () => {
		const { delivery } = await detectCaps(appleProbe({ canPlayType: () => '' }));
		expect(delivery).toBeNull();
	});

	it('requires a power-efficient decoder for AV1 and HEVC Main 10', async () => {
		const decodingInfo = vi.fn(async (config: MediaDecodingConfiguration) => ({
			supported: true,
			powerEfficient: !config.video?.contentType.includes('av01')
		}));
		const { caps } = await detectCaps(chromeProbe({ decodingInfo }));
		expect(caps.av1).toBe(false);
		expect(caps.hevcMain10).toBe(true);
		expect(caps.hevc).toBe(true);
		expect(decodingInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'media-source',
				video: expect.objectContaining({
					width: 3840,
					height: 2160,
					bitrate: 20_000_000,
					framerate: 24
				})
			})
		);
		const failing = await detectCaps(
			chromeProbe({ decodingInfo: async () => Promise.reject(new Error('no')) })
		);
		expect(failing.caps.av1).toBe(false);
		const absent = await detectCaps(chromeProbe({ decodingInfo: null }));
		expect(absent.caps.av1).toBe(true);
	});

	it('hdrDisplay needs the media query and a 10-bit codec', async () => {
		const hdr = (q: string) => q === '(video-dynamic-range: high)';
		expect((await detectCaps(chromeProbe({ matchMedia: hdr }))).caps.hdrDisplay).toBe(true);
		const no10 = (t: string) => !t.includes('hvc1.2') && !t.includes('av01');
		expect(
			(await detectCaps(chromeProbe({ matchMedia: hdr, mseIsTypeSupported: no10 }))).caps.hdrDisplay
		).toBe(false);
	});

	it('merges overrides and recomputes hdrDisplay', async () => {
		const { caps } = await detectCaps(appleProbe(), { av1: false });
		expect(caps.av1).toBe(false);
		expect(caps.hdrDisplay).toBe(true);
		const both = applyCapsOverride(caps, { hevcMain10: false });
		expect(both.hdrDisplay).toBe(false);
	});
});

describe('caps cache and overrides', () => {
	it('caches detection in sessionStorage and applies the override on every read', async () => {
		const storage = memoryStorage();
		const probe = chromeProbe();
		const first = await resolveCaps(probe, storage);
		expect(JSON.parse(storage.getItem(CAPS_CACHE_KEY) as string).delivery).toBe('hls.js');
		const mse = vi.fn(() => false);
		const cached = await resolveCaps(chromeProbe({ mseIsTypeSupported: mse }), storage);
		expect(mse).not.toHaveBeenCalled();
		expect(cached).toEqual(first);

		expect(disableCodec(storage, 'av1')).toEqual({ av1: false });
		expect(JSON.parse(storage.getItem(CAPS_OVERRIDE_KEY) as string)).toEqual({ av1: false });
		expect(readCapsOverride(storage)).toEqual({ av1: false });
		expect((await resolveCaps(probe, storage)).caps.av1).toBe(false);
	});

	it('survives corrupt values and blocked storage', async () => {
		const storage = memoryStorage();
		storage.setItem(CAPS_CACHE_KEY, '{nope');
		storage.setItem(CAPS_OVERRIDE_KEY, '{"av1":"no","hevc":false,"evil":true}');
		const result = await resolveCaps(chromeProbe(), storage);
		expect(result.delivery).toBe('hls.js');
		expect(readCapsOverride(storage)).toEqual({ hevc: false });
		const blocked = {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		} as unknown as Storage;
		expect((await resolveCaps(chromeProbe(), blocked)).delivery).toBe('hls.js');
		expect(disableCodec(blocked, 'hevc')).toEqual({ hevc: false });
		expect((await resolveCaps(chromeProbe(), null)).delivery).toBe('hls.js');
	});

	it('picks the codec to disable after a decode failure', () => {
		const caps = { hevcMain10: true } as never;
		expect(decodeFallbackCodec('av1', caps)).toBe('av1');
		expect(decodeFallbackCodec('hevc', caps)).toBe('hevcMain10');
		expect(decodeFallbackCodec('hevc', { hevcMain10: false } as never)).toBe('hevc');
		expect(decodeFallbackCodec('h264', caps)).toBeNull();
	});
});
