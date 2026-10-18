// Attaches an HLS session to the video element: native HLS (Apple) or hls.js light (MSE), which is
// downloaded only on that path. hls.js network failures back off 2/4/8/16/30 s and give up after
// 60 s without a loaded fragment; a fatal media error gets one recoverMediaError() (spec 4.4).
import type HlsDefault from 'hls.js';
import type { ErrorData, FragLoadedData } from 'hls.js';
import type { Delivery } from './types';

type HlsClass = typeof HlsDefault;
type HlsInstance = InstanceType<HlsClass>;

/** hls.js buffer limits (spec 12): one minute ahead, 120 MB at most, 30 s kept behind. */
export const HLS_CONFIG = {
	maxBufferLength: 60,
	maxMaxBufferLength: 120,
	backBufferLength: 30,
	maxBufferSize: 120e6,
	enableWorker: true
} as const;

export const NETWORK_BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];
export const NETWORK_GIVE_UP_MS = 60_000;

export function backoffDelay(attempt: number): number {
	return NETWORK_BACKOFF_MS[Math.min(Math.max(0, attempt), NETWORK_BACKOFF_MS.length - 1)];
}

export interface TransportFailure {
	kind: 'decode' | 'network' | 'expired' | 'http' | 'unsupported' | 'other';
	status: number | null;
	detail: string;
}

export interface TransportStats {
	bitrate: number | null; // bits per second of the stream (bytes x 8 / fragment duration)
	throughput: number | null; // bits per second of the link (bytes x 8 / load time)
	sustained: number | null; // slowest fragment throughput of the last 60 s, once 60 s are covered
}

export interface TransportDeps {
	loadHls: () => Promise<HlsClass>;
	now: () => number;
	onFailure: (failure: TransportFailure) => void;
	onNetwork?: (ok: boolean) => void;
	log?: (type: string, detail: string) => void;
}

export interface Transport {
	readonly delivery: Delivery;
	attach(url: string, start: number): Promise<void>;
	/** A decode error seen on the video element (hls.js path: one recovery first). */
	mediaError(detail: string): void;
	/** Back online: run a pending network retry now. */
	retryNow(): void;
	stats(): TransportStats;
	destroy(): void;
}

const EXPIRED = new Set([404, 410]);
const DEFINITIVE = new Set([401, 403, 503]);

export function createTransport(
	video: HTMLVideoElement,
	delivery: Delivery,
	deps: TransportDeps
): Transport {
	let destroyed = false;
	let hls: HlsInstance | null = null;
	let recovered = false;
	let failingSince = 0;
	let attempt = 0;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let giveUpTimer: ReturnType<typeof setTimeout> | null = null;
	let lastNetwork: { status: number; detail: string } = { status: 0, detail: '' };
	let onMetadata: (() => void) | null = null;
	const samples: Array<{ t: number; bits: number; duration: number; loadSec: number }> = [];

	const fail = (failure: TransportFailure) => {
		if (!destroyed) deps.onFailure(failure);
	};

	const clearTimers = () => {
		if (retryTimer) clearTimeout(retryTimer);
		if (giveUpTimer) clearTimeout(giveUpTimer);
		retryTimer = giveUpTimer = null;
	};

	const restartLoad = () => {
		retryTimer = null;
		hls?.startLoad(video.currentTime);
	};

	function networkError(status: number, detail: string) {
		if (EXPIRED.has(status)) return fail({ kind: 'expired', status, detail });
		if (DEFINITIVE.has(status)) return fail({ kind: 'http', status, detail });
		lastNetwork = { status, detail };
		if (!failingSince) {
			failingSince = deps.now();
			deps.onNetwork?.(false);
			giveUpTimer = setTimeout(() => {
				clearTimers();
				fail({ kind: 'network', status: lastNetwork.status, detail: lastNetwork.detail });
			}, NETWORK_GIVE_UP_MS);
		}
		if (retryTimer) clearTimeout(retryTimer);
		// A segment superseded by a seek (409) is simply asked again.
		const delay = status === 409 && attempt === 0 ? 0 : backoffDelay(attempt);
		attempt++;
		retryTimer = setTimeout(restartLoad, delay);
	}

	function mediaError(detail: string) {
		if (destroyed) return;
		if (hls && !recovered) {
			recovered = true;
			deps.log?.('recover', detail);
			hls.recoverMediaError();
			return;
		}
		fail({ kind: 'decode', status: null, detail });
	}

	function onError(errorTypes: HlsClass['ErrorTypes'], data: ErrorData) {
		deps.log?.('hls', `${data.type}:${data.details}${data.fatal ? ':fatal' : ''}`);
		if (!data.fatal) return;
		if (data.type === errorTypes.MEDIA_ERROR) return mediaError(data.details);
		if (data.type === errorTypes.NETWORK_ERROR) {
			return networkError(data.response?.code ?? 0, data.details);
		}
		const kind = data.type === errorTypes.MUX_ERROR ? 'decode' : 'other';
		fail({ kind, status: null, detail: data.details });
	}

	function onFrag(data: FragLoadedData) {
		const { stats, duration } = data.frag;
		const loadSec = Math.max(0, stats.loading.end - stats.loading.start) / 1000;
		const t = deps.now();
		samples.push({ t, bits: stats.loaded * 8, duration, loadSec });
		while (samples.length > 1 && samples[1].t <= t - 90_000) samples.shift();
		if (failingSince) {
			failingSince = 0;
			attempt = 0;
			clearTimers();
			deps.onNetwork?.(true);
		}
	}

	return {
		delivery,

		async attach(url, start) {
			if (delivery === 'native') {
				video.src = url;
				if (start > 0) {
					onMetadata = () => {
						onMetadata = null;
						if (!destroyed && Math.abs(video.currentTime - start) > 0.25) video.currentTime = start;
					};
					video.addEventListener('loadedmetadata', onMetadata, { once: true });
				}
				return;
			}
			let Hls: HlsClass;
			try {
				Hls = await deps.loadHls();
			} catch {
				return fail({ kind: 'network', status: null, detail: 'hls.js download failed' });
			}
			if (destroyed) return;
			if (!Hls.isSupported()) return fail({ kind: 'unsupported', status: null, detail: 'MSE' });
			const instance = new Hls({ ...HLS_CONFIG, startPosition: start > 0 ? start : -1 });
			hls = instance;
			instance.on(Hls.Events.ERROR, (_event, data) => onError(Hls.ErrorTypes, data));
			instance.on(Hls.Events.FRAG_LOADED, (_event, data) => onFrag(data));
			instance.attachMedia(video);
			instance.loadSource(url);
		},

		mediaError,

		retryNow() {
			if (!retryTimer) return;
			clearTimeout(retryTimer);
			restartLoad();
		},

		stats() {
			if (delivery !== 'hls.js' || samples.length === 0) {
				return { bitrate: null, throughput: null, sustained: null };
			}
			const recent = samples.slice(-5);
			const bits = recent.reduce((sum, s) => sum + s.bits, 0);
			const duration = recent.reduce((sum, s) => sum + s.duration, 0);
			const loadSec = recent.reduce((sum, s) => sum + s.loadSec, 0);
			const t = deps.now();
			const window = samples.filter((s) => s.t >= t - 60_000 && s.loadSec > 0);
			const covered = samples[0].t <= t - 60_000 && window.length > 0;
			return {
				bitrate: duration > 0 ? bits / duration : null,
				throughput: loadSec > 0 ? bits / loadSec : null,
				sustained: covered ? Math.min(...window.map((s) => s.bits / s.loadSec)) : null
			};
		},

		destroy() {
			destroyed = true;
			clearTimers();
			if (onMetadata) video.removeEventListener('loadedmetadata', onMetadata);
			onMetadata = null;
			hls?.destroy();
			hls = null;
		}
	};
}
