// A scripted HqpEngine for the dev harness: no network, no media. It follows the engine contract
// closely enough to drive every UI state (spec 13.5) and to react to the controls.
import { writable } from 'svelte/store';
import { DEFAULT_HQP_PREFS, mergeHqpPrefs } from '$lib/player/hqp/prefs';
import type {
	FrameMode,
	HqpClock,
	HqpCue,
	HqpEngine,
	HqpError,
	HqpLaunchPayload,
	HqpPrefs,
	HqpState,
	HqpToast,
	QualityChoice,
	SleepMode
} from '$lib/player/hqp/types';
import { openingSnapshot } from '../logic/initial';
import { chapterIndexAt } from '../logic/timeline';
import {
	DEMO_CHAPTERS,
	DEMO_CUE,
	DEMO_DURATION,
	DEMO_POSITION,
	demoAudioOptions,
	demoMetrics,
	demoSession,
	demoSubtitleOptions,
	demoTrickplay
} from './fixtures';

export const DEMO_STATES = [
	'controls',
	'hidden',
	'sheet',
	'style',
	'picture',
	'playback',
	'info',
	'scrub',
	'seek',
	'hold',
	'upnext',
	'still',
	'end',
	'episodes',
	'resume',
	'skip',
	'opening',
	'blocked',
	'buffering',
	'switching',
	'offline',
	'locked',
	'help',
	'error-503',
	'error-409',
	'error-decode'
] as const;
export type DemoState = (typeof DEMO_STATES)[number];

export interface FakeEngineOptions {
	state: DemoState;
	aspect: number;
	mode: FrameMode;
	signal: 'direct' | 'converted';
	/** Advance the clock while playing (off for still screenshots). */
	tick: boolean;
	/** Leave the one-time Home Screen hint unseen (iOS Safari tab mode shows it once). */
	homeHint?: boolean;
	onItemChange?: (item: NonNullable<HqpState['item']>, index: number) => void;
}

const FAR = 8.64e15; // "until" far in the future: demo notices stay for screenshots

function cueFor(): HqpCue[] {
	const [a, b] = DEMO_CUE.split(', ');
	return [
		{
			id: 'demo-cue',
			lines: [
				[{ text: `${a},`, italic: false, bold: false }],
				[{ text: b, italic: false, bold: false }]
			]
		}
	];
}

function errorFor(state: DemoState): HqpError | null {
	if (state === 'error-503')
		return {
			code: 'library-offline',
			status: 503,
			message: 'Media streaming is not configured',
			fallback: null
		};
	if (state === 'error-409')
		return { code: 'gone', status: 409, message: 'The file is gone', fallback: null };
	if (state === 'error-decode')
		return {
			code: 'decode',
			status: null,
			message: 'The direct stream could not be decoded (AV1).',
			fallback: '1080p'
		};
	return null;
}

export function createFakeEngine(launch: HqpLaunchPayload, options: FakeEngineOptions): HqpEngine {
	const opts = options;
	let toastId = 0;
	let announceId = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	let clockHz: 1 | 4 = 4;
	const timeouts = new Set<ReturnType<typeof setTimeout>>();

	let prefs: HqpPrefs = {
		...structuredClone(DEFAULT_HQP_PREFS),
		hints: { fineScrub: false, homeScreen: !opts.homeHint }
	};
	const prefsStore = writable<HqpPrefs>(prefs);
	const snapshot = writable<HqpState>(openingSnapshot(launch));
	let current = openingSnapshot(launch);
	const clock = writable<HqpClock>({
		position: 0,
		duration: DEMO_DURATION,
		bufferedEnd: 0,
		ranges: []
	});
	let clockValue: HqpClock = { position: 0, duration: DEMO_DURATION, bufferedEnd: 0, ranges: [] };
	const cues = writable<HqpCue[]>([]);

	const later = (fn: () => void, ms: number) => {
		const id = setTimeout(() => {
			timeouts.delete(id);
			fn();
		}, ms);
		timeouts.add(id);
	};

	function patch(next: Partial<HqpState>) {
		current = { ...current, ...next };
		snapshot.set(current);
	}

	function setClock(position: number) {
		const duration = clockValue.duration;
		const p = Math.min(Math.max(0, position), duration);
		const bufferedEnd = Math.min(duration, p + 48);
		clockValue = {
			position: p,
			duration,
			bufferedEnd,
			ranges: [[Math.max(0, p - 120), bufferedEnd]]
		};
		clock.set(clockValue);
		const chapterIndex = chapterIndexAt(current.chapters, p);
		if (chapterIndex !== current.chapterIndex) patch({ chapterIndex });
	}

	function toast(
		text: string,
		kind: HqpToast['kind'] = 'info',
		action: HqpToast['action'] = null,
		ms = action ? 4000 : 1600
	) {
		const id = ++toastId;
		const until = Date.now() + ms;
		patch({ toasts: [...current.toasts, { id, kind, text, action, until }] });
		later(() => engine.dismissToast(id), until - Date.now());
	}

	function announce(text: string) {
		patch({ announcement: { id: ++announceId, text } });
	}

	function restartTicker() {
		if (timer) clearInterval(timer);
		timer = null;
		if (!opts.tick || typeof window === 'undefined') return;
		const ms = clockHz === 4 ? 250 : 1000;
		timer = setInterval(() => {
			if (current.status !== 'playing') return;
			setClock(clockValue.position + (ms / 1000) * current.rate);
		}, ms);
	}

	function playingState(): Partial<HqpState> {
		const item = current.item;
		const episode = item?.kind === 'episode';
		const subtitles = demoSubtitleOptions();
		return {
			status: 'playing',
			session: demoSession(opts.signal),
			delivery: 'hls.js',
			caps: {
				h264: true,
				hevc: true,
				hevcMain10: true,
				av1: true,
				nativeHls: false,
				maxHeight: null
			},
			quality: {
				choice: 'auto',
				active: 'original',
				available: ['original', '1080p', '720p', '480p']
			},
			audio: {
				options: demoAudioOptions(0),
				mode: opts.signal === 'direct' ? 'copy' : 'transcode'
			},
			subtitles: { options: subtitles, selected: null, forced: 0, offsetSeconds: 0 },
			chapters: episode ? DEMO_CHAPTERS : DEMO_CHAPTERS.filter((c) => c.title !== 'Générique'),
			aspect: opts.aspect,
			frameMode: opts.mode,
			hdrShown: opts.signal === 'direct',
			airplay: { available: true, active: false }
		};
	}

	// The scenario is applied at creation, so the very first snapshot the UI sees is the state.
	function scenario() {
		const s = opts.state;
		if (s === 'opening') {
			clockValue = { ...clockValue, duration: DEMO_DURATION };
			clock.set(clockValue);
			return;
		}
		patch(playingState());
		let position = DEMO_POSITION;
		const item = current.item;
		const lastItem = current.index >= current.queue.length - 1;
		cues.set(cueFor());
		switch (s) {
			case 'blocked':
				patch({ status: 'paused', autoplayBlocked: true });
				cues.set([]);
				break;
			case 'buffering':
				patch({ status: 'buffering' });
				break;
			case 'switching':
				patch({ status: 'switching' });
				toast('Switching to English…', 'info', null, 60_000);
				break;
			case 'offline':
				patch({ online: false });
				break;
			case 'hold':
				patch({ held: true, rate: 2 });
				break;
			case 'resume':
				patch({ resume: { from: DEMO_POSITION, until: FAR } });
				break;
			case 'skip':
				position = 104;
				patch({ skipIntro: { end: 160 } });
				cues.set([]);
				break;
			case 'upnext':
			case 'still': {
				position = 4128;
				const next = current.queue[current.index + 1];
				if (next && s === 'upnext')
					patch({
						upNext: {
							index: current.index + 1,
							item: next,
							reason: 'credits',
							countdownEndsAt: Date.now() + 10_000
						}
					});
				if (s === 'still') patch({ stillWatching: true, status: 'paused' });
				cues.set([]);
				break;
			}
			case 'end':
				position = DEMO_DURATION;
				patch({ status: 'ended' });
				cues.set([]);
				if (!lastItem && item?.kind === 'episode')
					patch({ index: current.queue.length - 1, item: current.queue[current.queue.length - 1] });
				break;
			case 'error-503':
			case 'error-409':
			case 'error-decode':
				patch({ status: 'error', error: errorFor(s), session: null });
				cues.set([]);
				break;
		}
		setClock(position);
		if (s === 'scrub' || s === 'info') patch({ trickplay: demoTrickplay() });
	}

	const engine: HqpEngine = {
		snapshot,
		clock,
		cues,
		prefs: prefsStore,
		attach() {},
		async load() {
			restartTicker();
		},
		async play() {
			patch({ status: 'playing', autoplayBlocked: false });
		},
		pause() {
			patch({ status: 'paused' });
		},
		toggle() {
			if (current.status === 'playing') engine.pause();
			else void engine.play();
		},
		seek(seconds) {
			setClock(seconds);
		},
		skip(delta) {
			setClock(clockValue.position + delta);
		},
		seekChapter(direction) {
			const i = chapterIndexAt(current.chapters, clockValue.position);
			const target = current.chapters[Math.max(0, i + direction)];
			if (target) setClock(target.start);
		},
		stepFrame(direction) {
			setClock(clockValue.position + direction / 24);
		},
		startOver() {
			setClock(0);
			patch({ resume: null, status: 'playing' });
		},
		setRate(rate) {
			patch({ rate });
			announce(`Speed ${rate}×`);
		},
		holdRate(on) {
			patch({ held: on });
		},
		setVolume(level) {
			patch({ volume: Math.min(1, Math.max(0, level)), muted: false });
		},
		setMuted(muted) {
			patch({ muted });
		},
		async setQuality(choice: QualityChoice) {
			const active = choice === 'auto' ? 'original' : choice;
			// Like the real engine: from the error state a quality choice restarts the item.
			patch({ quality: { ...current.quality, choice, active }, status: 'switching', error: null });
			later(() => patch({ status: 'playing' }), 700);
			announce(`Quality ${choice === 'auto' ? 'Auto' : choice}`);
		},
		async setAudio(ordinal) {
			const options = current.audio.options.map((o) => ({ ...o, selected: o.ordinal === ordinal }));
			const label = options.find((o) => o.selected)?.language === 'eng' ? 'English' : 'French';
			patch({ audio: { ...current.audio, options }, status: 'switching' });
			toast(`Switching to ${label}…`);
			later(() => patch({ status: 'playing' }), 900);
		},
		async cycleAudio() {
			const opts2 = current.audio.options;
			const i = opts2.findIndex((o) => o.selected);
			const next = opts2[(i + 1) % Math.max(1, opts2.length)];
			if (next) await engine.setAudio(next.ordinal);
		},
		setSubtitles(ordinal) {
			patch({ subtitles: { ...current.subtitles, selected: ordinal } });
			cues.set(ordinal === null && current.subtitles.forced === null ? [] : cueFor());
		},
		toggleSubtitles() {
			engine.setSubtitles(current.subtitles.selected === null ? 1 : null);
		},
		setSubtitleOffset(seconds) {
			patch({ subtitles: { ...current.subtitles, offsetSeconds: Math.round(seconds * 10) / 10 } });
		},
		setFrameMode(mode) {
			patch({ frameMode: mode });
		},
		async playIndex(index) {
			const item = current.queue[index];
			if (!item) return;
			patch({ index, item, upNext: null, stillWatching: false, resume: null, status: 'playing' });
			setClock(0);
			opts.onItemChange?.(item, index);
		},
		async next() {
			await engine.playIndex(current.index + 1);
		},
		cancelUpNext() {
			patch({ upNext: null });
		},
		confirmStillWatching() {
			patch({ stillWatching: false, status: 'playing' });
		},
		setSleep(mode: SleepMode) {
			const endsAt = typeof mode === 'number' ? Date.now() + mode * 60_000 : null;
			patch({ sleep: { mode, endsAt } });
		},
		async togglePip() {
			patch({ pip: !current.pip });
		},
		showAirPlayPicker() {
			toast('AirPlay picker (demo)');
		},
		async toggleFullscreen(target) {
			if (typeof document === 'undefined') return;
			if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
			else await target.requestFullscreen?.().catch(() => {});
			patch({ fullscreen: Boolean(document.fullscreenElement) });
		},
		setClockRate(hz) {
			if (hz === clockHz) return;
			clockHz = hz;
			restartTicker();
		},
		noteInteraction() {},
		async retry() {
			patch({ error: null, status: 'playing' });
		},
		dismissToast(id) {
			patch({ toasts: current.toasts.filter((t) => t.id !== id) });
		},
		async ensureTrickplay() {
			if (!current.trickplay) patch({ trickplay: demoTrickplay() });
			return current.trickplay;
		},
		updatePrefs(next) {
			prefs = mergeHqpPrefs(prefs, next);
			prefsStore.set(prefs);
		},
		metrics() {
			return demoMetrics(opts.signal, Math.max(0, clockValue.bufferedEnd - clockValue.position));
		},
		diagnostics() {
			return JSON.stringify(
				{ demo: true, metrics: engine.metrics(), status: current.status },
				null,
				2
			);
		},
		async destroy() {
			if (timer) clearInterval(timer);
			timer = null;
			for (const id of timeouts) clearTimeout(id);
			timeouts.clear();
		}
	};
	scenario();
	return engine;
}
