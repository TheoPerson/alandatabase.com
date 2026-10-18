// Stores the UI subscribes to from the first render (SSR included), forwarded from the engine once
// the client creates it, plus a no-op engine stand-in for the frames before that.
import { writable, type Writable } from 'svelte/store';
import { DEFAULT_HQP_PREFS } from '$lib/player/hqp/prefs';
import type {
	HqpClock,
	HqpCue,
	HqpEngine,
	HqpLaunchPayload,
	HqpMetrics,
	HqpPrefs,
	HqpState
} from '$lib/player/hqp/types';
import { initialClock, openingSnapshot } from './logic/initial';

export interface HqpBridge {
	snapshot: Writable<HqpState>;
	clock: Writable<HqpClock>;
	cues: Writable<HqpCue[]>;
	prefs: Writable<HqpPrefs>;
	/** Forwards every engine store into the bridge; returns the unsubscriber. */
	connect(engine: HqpEngine): () => void;
	standIn: HqpEngine;
}

const EMPTY_METRICS: HqpMetrics = {
	sessionId: null,
	delivery: null,
	videoMode: null,
	reason: null,
	codec: null,
	profile: null,
	width: null,
	height: null,
	frameRate: null,
	bitDepth: null,
	hdr: 'sdr',
	hdrShown: false,
	audio: { label: null, codec: null, channels: null, mode: null },
	subtitles: null,
	segmentSeconds: null,
	bitrate: { measured: null, file: null },
	throughput: null,
	bufferAhead: 0,
	frames: null,
	screen: { width: 0, height: 0, dpr: 1, refreshHz: null, hdr: false },
	quality: { choice: 'auto', active: null }
};

export function createBridge(launch: HqpLaunchPayload): HqpBridge {
	const snapshot = writable(openingSnapshot(launch));
	const clock = writable(initialClock(launch));
	const cues = writable<HqpCue[]>([]);
	const prefs = writable<HqpPrefs>(structuredClone(DEFAULT_HQP_PREFS));
	const noop = () => {};
	const resolved = async () => {};
	const standIn: HqpEngine = {
		snapshot,
		clock,
		cues,
		prefs,
		attach: noop,
		load: resolved,
		play: resolved,
		pause: noop,
		toggle: noop,
		seek: noop,
		skip: noop,
		seekChapter: noop,
		stepFrame: noop,
		startOver: noop,
		setRate: noop,
		holdRate: noop,
		setVolume: noop,
		setMuted: noop,
		setQuality: resolved,
		setAudio: resolved,
		cycleAudio: resolved,
		setSubtitles: noop,
		toggleSubtitles: noop,
		setSubtitleOffset: noop,
		setFrameMode: noop,
		playIndex: resolved,
		next: resolved,
		cancelUpNext: noop,
		confirmStillWatching: noop,
		setSleep: noop,
		togglePip: resolved,
		showAirPlayPicker: noop,
		toggleFullscreen: resolved,
		setClockRate: noop,
		noteInteraction: noop,
		retry: resolved,
		dismissToast: noop,
		ensureTrickplay: async () => null,
		updatePrefs: noop,
		metrics: () => EMPTY_METRICS,
		diagnostics: () => '{}',
		destroy: resolved
	};
	return {
		snapshot,
		clock,
		cues,
		prefs,
		standIn,
		connect(engine) {
			const offs = [
				engine.snapshot.subscribe((v) => snapshot.set(v)),
				engine.clock.subscribe((v) => clock.set(v)),
				engine.cues.subscribe((v) => cues.set(v)),
				engine.prefs.subscribe((v) => prefs.set(v))
			];
			return () => offs.forEach((off) => off());
		}
	};
}
