// Capability report (spec 4.1): which delivery path to use and which codecs the device decodes,
// so the server can direct-stream the original whenever possible.
import type { ClientCaps } from '$lib/media/types';
import type { CapsProbe, Delivery } from './types';

export const CAPS_CACHE_KEY = 'hqp:caps:v1';
export const CAPS_OVERRIDE_KEY = 'hqp:caps-override:v1';

const HLS_TYPE = 'application/vnd.apple.mpegurl';
const mp4 = (codec: string) => `video/mp4; codecs="${codec}"`;
const AUDIO = { ac3: 'audio/mp4; codecs="ac-3"', eac3: 'audio/mp4; codecs="ec-3"' };
const HEVC10 = 'hvc1.2.4.L153.B0';
const AV1 = 'av01.0.12M.10';
type Codec = 'av1' | 'hevcMain10' | 'hevc';
const OVERRIDABLE: Array<keyof ClientCaps> = ['h264', 'hevc', 'hevcMain10', 'av1', 'ac3', 'eac3'];

export interface CapsReport {
	caps: ClientCaps;
	delivery: Delivery | null;
}

/** Real browser probes for a video element (ManagedMediaSource counts as MSE). */
export function browserCapsProbe(video: HTMLVideoElement): CapsProbe {
	const g = globalThis as unknown as {
		MediaSource?: { isTypeSupported(t: string): boolean };
		ManagedMediaSource?: { isTypeSupported(t: string): boolean };
		matchMedia?: (q: string) => MediaQueryList;
		navigator?: Navigator;
	};
	const source = g.MediaSource ?? g.ManagedMediaSource;
	const mse = source ? (type: string) => source.isTypeSupported(type) : null;
	const info = g.navigator?.mediaCapabilities;
	return {
		vendor: g.navigator?.vendor ?? '',
		canPlayType: (type) => video.canPlayType(type),
		mseIsTypeSupported: mse,
		hlsJsSupported: !!mse && mse('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'),
		matchMedia: (query) => !!g.matchMedia?.(query).matches,
		decodingInfo: info ? (config) => info.decodingInfo(config) : null
	};
}

/** Raw detection (spec 4.1) with an optional decode-failure override merged in. */
export async function detectCaps(
	probe: CapsProbe,
	override?: Partial<ClientCaps>
): Promise<CapsReport> {
	const apple = /apple/i.test(probe.vendor);
	const nativeHls = probe.canPlayType(HLS_TYPE) !== '';
	const mse = probe.mseIsTypeSupported;
	const delivery: Delivery | null =
		nativeHls && (apple || !mse)
			? 'native'
			: mse && !apple && probe.hlsJsSupported
				? 'hls.js'
				: null;
	const can = (type: string): boolean => {
		if (delivery === 'native') return probe.canPlayType(type) !== '';
		return delivery === 'hls.js' && !!mse?.(type);
	};
	const efficient = async (codec: string): Promise<boolean> => {
		if (!probe.decodingInfo) return true;
		try {
			const result = await probe.decodingInfo({
				type: delivery === 'native' ? 'file' : 'media-source',
				video: {
					contentType: mp4(codec),
					width: 3840,
					height: 2160,
					bitrate: 20_000_000,
					framerate: 24
				}
			});
			return result.supported && result.powerEfficient;
		} catch {
			return false;
		}
	};
	const [hevcMain10, av1] = await Promise.all([
		can(mp4(HEVC10)) && efficient(HEVC10),
		can(mp4(AV1)) && efficient(AV1)
	]);
	const caps: ClientCaps = {
		h264: can(mp4('avc1.640033')),
		hevc: can(mp4('hvc1.1.6.L153.B0')),
		hevcMain10,
		av1,
		nativeHls: delivery === 'native',
		maxHeight: null,
		ac3: can(AUDIO.ac3),
		eac3: can(AUDIO.eac3),
		hdrDisplay:
			(probe.matchMedia('(dynamic-range: high)') ||
				probe.matchMedia('(video-dynamic-range: high)')) &&
			(hevcMain10 || av1),
		multichannel: delivery === 'native' && apple
	};
	return { caps: override ? applyCapsOverride(caps, override) : caps, delivery };
}

/** Overrides only switch codecs off; HDR stays on only while a 10-bit codec remains. */
export function applyCapsOverride(caps: ClientCaps, override: Partial<ClientCaps>): ClientCaps {
	const next = { ...caps };
	for (const key of OVERRIDABLE) if (override[key] === false) (next[key] as boolean) = false;
	next.hdrDisplay = !!caps.hdrDisplay && (next.hevcMain10 || next.av1);
	return next;
}

function read(storage: Storage | null | undefined, key: string): unknown {
	try {
		const raw = storage?.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function write(storage: Storage | null | undefined, key: string, value: unknown): void {
	try {
		storage?.setItem(key, JSON.stringify(value));
	} catch {
		// Blocked storage: detection simply runs again next time.
	}
}

export function readCapsOverride(storage: Storage | null | undefined): Partial<ClientCaps> {
	const raw = read(storage, CAPS_OVERRIDE_KEY) as Record<string, unknown> | null;
	const override: Partial<ClientCaps> = {};
	for (const key of OVERRIDABLE) if (raw?.[key] === false) (override[key] as boolean) = false;
	return override;
}

/** Records a codec that failed to decode for the rest of this browser session. */
export function disableCodec(
	storage: Storage | null | undefined,
	codec: Codec
): Partial<ClientCaps> {
	const override = { ...readCapsOverride(storage), [codec]: false };
	write(storage, CAPS_OVERRIDE_KEY, override);
	return override;
}

function validReport(value: unknown): CapsReport | null {
	const v = value as CapsReport | null;
	if (!v || typeof v.caps !== 'object' || !v.caps) return null;
	if (v.delivery !== 'native' && v.delivery !== 'hls.js' && v.delivery !== null) return null;
	const c = v.caps as unknown as Record<string, unknown>;
	const keys = [...OVERRIDABLE, 'nativeHls', 'hdrDisplay', 'multichannel'];
	if (!keys.every((k) => typeof c[k] === 'boolean')) return null;
	return { caps: { ...v.caps, maxHeight: null }, delivery: v.delivery };
}

/** Cached detection (sessionStorage) with the current override applied. */
export async function resolveCaps(
	probe: CapsProbe,
	storage: Storage | null | undefined
): Promise<CapsReport> {
	let report = validReport(read(storage, CAPS_CACHE_KEY));
	if (!report) {
		report = await detectCaps(probe);
		write(storage, CAPS_CACHE_KEY, report);
	}
	return {
		caps: applyCapsOverride(report.caps, readCapsOverride(storage)),
		delivery: report.delivery
	};
}

/** The codec to switch off after a decode failure of a stream in `codec` (spec 4.4). */
export function decodeFallbackCodec(
	codec: string,
	caps: Pick<ClientCaps, 'hevcMain10'>
): Codec | null {
	if (codec === 'av1') return 'av1';
	if (codec === 'hevc') return caps.hevcMain10 ? 'hevcMain10' : 'hevc';
	return null;
}
