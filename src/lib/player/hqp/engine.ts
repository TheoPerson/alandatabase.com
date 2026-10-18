// Alan's HQP engine (spec 13.3): one playback session at a time on one <video>, framework-agnostic.
// It owns sessions, delivery, tracks, progress, up next and system integration; the UI only reads
// the stores and calls the methods. No file path ever reaches it, and nothing polls.
import type {
	Chapter,
	ClientCaps,
	PlaybackSession,
	QualityLevel,
	StartSessionRequest,
	TrickplayManifest
} from '$lib/media/types';
import { formatTime } from '$lib/player/format-time';
import { decideQuality } from './abr';
import { createApi, errorFromStatus, HqpRequestError } from './api';
import {
	applyCapsOverride,
	browserCapsProbe,
	decodeFallbackCodec,
	disableCodec,
	readCapsOverride,
	resolveCaps
} from './caps';
import { createMediaSessionBridge } from './media-session';
import {
	bufferAhead,
	bufferedEndAt,
	bufferedRanges,
	buildMetrics,
	estimateRefreshRate
} from './metrics';
import { aspectClassOf, loadHqpPrefs, mergeHqpPrefs, saveHqpPrefs } from './prefs';
import {
	createProgressTracker,
	isCompletedPosition,
	resumePoint,
	type ProgressReason
} from './progress';
import { createSleepTimer, sleepEndsAt } from './sleep';
import { writable } from './store';
import { chooseSubtitles, cueToSpans, isSdh, languageKey, toBcp47 } from './subtitles';
import {
	showAirPlayPicker,
	toggleElementFullscreen,
	togglePictureInPicture,
	watchSystem,
	type SystemState
} from './system';
import {
	backoffDelay,
	createTransport,
	NETWORK_GIVE_UP_MS,
	type Transport,
	type TransportFailure
} from './transport';
import type {
	Delivery,
	HqpAudioOption,
	HqpClock,
	HqpCue,
	HqpEngine,
	HqpEngineOptions,
	HqpError,
	HqpItem,
	HqpPrefs,
	HqpPrefsPatch,
	HqpState,
	HqpSubtitleOption,
	HqpSubtitleState,
	HqpToast,
	HqpUpNext,
	QualityChoice,
	SleepMode
} from './types';
import { createWakeLock } from './wake-lock';
import { creditsStart, openingChapter } from './upnext';

const RESUME_NOTICE_MS = 6000;
const COUNTDOWN_MS = 10_000;
const COUNTDOWN_PAUSE_MS = 2000;
const MAX_AUTOPLAYS = 3;
const TOAST_MS = 1600;
const TOAST_ACTION_MS = 4000;
const NATIVE_STALL_MS = 10_000;

type Timer = ReturnType<typeof setTimeout>;
type Stall = { start: number; end: number | null; seek: boolean };
type SwitchReason = 'quality' | 'audio' | 'reload' | 'decode';

const levelLabel = (q: QualityLevel) => (q === 'original' ? 'Original' : q);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isSession = (v: PlaybackSession | HqpError): v is PlaybackSession => 'sessionId' in v;
const CODEC_NAMES: Record<string, string> = {
	av1: 'AV1',
	hevcMain10: 'HEVC Main 10',
	hevc: 'HEVC',
	h264: 'H.264'
};

function guardedStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
	try {
		return (globalThis as unknown as Record<string, Storage | undefined>)[kind] ?? null;
	} catch {
		return null;
	}
}

/** Index of the chapter holding `position` (binary search), -1 before the first or without. */
function chapterAt(chapters: Chapter[], position: number): number {
	let lo = 0;
	let hi = chapters.length - 1;
	let hit = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (chapters[mid].start <= position) {
			hit = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return hit;
}

const EMPTY_SUBTITLES: HqpSubtitleState = {
	options: [],
	selected: null,
	forced: null,
	offsetSeconds: 0
};

function initialState(prefs: HqpPrefs): HqpState {
	return {
		status: 'idle',
		autoplayBlocked: false,
		queue: [],
		index: 0,
		item: null,
		session: null,
		delivery: null,
		caps: null,
		quality: { choice: prefs.quality, active: null, available: [] },
		audio: { options: [], mode: null },
		subtitles: EMPTY_SUBTITLES,
		chapters: [],
		chapterIndex: -1,
		skipIntro: null,
		trickplay: null,
		rate: 1,
		held: false,
		volume: prefs.volume,
		muted: prefs.muted,
		frameMode: prefs.frameModes.standard,
		aspect: null,
		hdrShown: false,
		resume: null,
		upNext: null,
		stillWatching: false,
		sleep: { mode: 'off', endsAt: null },
		pip: false,
		airplay: { available: false, active: false },
		fullscreen: false,
		online: true,
		toasts: [],
		error: null,
		announcement: null
	};
}

export function createHqpEngine(options: HqpEngineOptions = {}): HqpEngine {
	const now = options.now ?? (() => Date.now());
	const fetchFn: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
	const storage = options.storage !== undefined ? options.storage : guardedStorage('localStorage');
	const sessionStore =
		options.sessionStorage !== undefined
			? options.sessionStorage
			: guardedStorage('sessionStorage');
	const loadHls = options.loadHls ?? (() => import('hls.js/light').then((m) => m.default));
	const probeOf = options.probe ?? browserCapsProbe;
	const api = createApi(fetchFn);

	const prefs = writable(loadHqpPrefs(storage));
	const snapshot = writable(initialState(prefs.get()));
	const clock = writable<HqpClock>({ position: 0, duration: 0, bufferedEnd: 0, ranges: [] });
	const cues = writable<HqpCue[]>([]);
	const state = () => snapshot.get();
	const patch = (changes: Partial<HqpState>) => snapshot.set({ ...snapshot.get(), ...changes });

	// Timers: every one is tracked so destroy() leaves none behind.
	const timers = new Set<Timer>();
	const later = (fn: () => void, ms: number): Timer => {
		const id = setTimeout(() => {
			timers.delete(id);
			fn();
		}, ms);
		timers.add(id);
		return id;
	};
	const cancel = (id: Timer | null) => {
		if (id === null) return null;
		clearTimeout(id);
		timers.delete(id);
		return null;
	};

	// The last 20 notable events, for diagnostics (no URL, no path).
	const events: Array<{ t: number; type: string; detail: string }> = [];
	const log = (type: string, detail = '') => {
		events.push({ t: now(), type, detail });
		if (events.length > 20) events.shift();
	};

	let video: HTMLVideoElement | null = null;
	let doc: Document | null = null;
	let win: (Window & typeof globalThis) | null = null;
	let detachVideo: (() => void) | null = null;
	let wakeLock = createWakeLock(null);
	let mediaSession = createMediaSessionBridge(null);
	let volumeWritable = true;
	let destroyed = false;

	// Session and delivery.
	let gen = 0;
	let caps: ClientCaps | null = null;
	let delivery: Delivery | null = null;
	let transport: Transport | null = null;
	let session: PlaybackSession | null = null;
	let pendingPosition = 0;
	let awaitingStart = false;
	let pendingSeek: number | null = null;
	// A switch is waiting for its new session: events still come from the previous source.
	let preparing = false;
	let wantPlay = false;
	let started = false;
	let itemStarted = false;
	let resumeFrom: number | null = null;
	let errorPosition = 0;
	let netSince = 0;
	let netAttempt = 0;
	let netTimer: Timer | null = null;
	let wakeRetry: (() => void) | null = null;
	let expiries: number[] = [];

	// Auto quality.
	let lastSwitchAt = 0;
	let stalls: Stall[] = [];
	let openStall: Stall | null = null;
	let lastSeekAt = Number.NEGATIVE_INFINITY;
	let lastInteractionAt = Number.NEGATIVE_INFINITY;
	let suggested = false;
	let originalBitrate: number | null = null;
	let decodeRetried = false;
	let bufferingTimer: Timer | null = null;
	let stallTimer: Timer | null = null;

	// Item: chapters, up next, subtitles.
	let chaptersFor: string | null = null;
	let creditsAt = Number.POSITIVE_INFINITY;
	let creditsReason: HqpUpNext['reason'] = 'end';
	let opening: Chapter | null = null;
	let upNextDismissed = false;
	let autoplays = 0;
	let countdownLeft = 0;
	let countdownTimer: Timer | null = null;
	let countdownResume: Timer | null = null;
	let resumeTimer: Timer | null = null;
	let seekSaveTimer: Timer | null = null;
	let trickplayAt = 0;
	let trickplayLoad: Promise<TrickplayManifest | null> | null = null;
	let lastSubtitle: number | null = null;
	const tracks = new Map<number, { el: HTMLTrackElement; url: string }>();
	const appliedOffset = new Map<HTMLTrackElement, number>();
	let cueTrack: TextTrack | null = null;
	// WebVTT files load only once the first frame plays, so the first segment never waits for the
	// server's subtitle extraction (a full read of the file on a hard disk).
	let tracksLive = false;
	let system: Pick<SystemState, 'pip' | 'airplayActive' | 'nativeFullscreen'> = {
		pip: false,
		airplayActive: false,
		nativeFullscreen: false
	};

	// Clock.
	let clockHz: 1 | 4 = 4;
	let lastClockAt = Number.NEGATIVE_INFINITY;
	let heldBase = 1;
	let fading = false;
	let refreshHz: number | null | undefined;

	const progress = createProgressTracker({
		now,
		send: (entry, keepalive) => api.putProgress(entry, keepalive)
	});
	const sleepTimer = createSleepTimer({
		now,
		fade: (factor) => {
			if (!video || !volumeWritable) return;
			fading = true;
			video.volume = prefs.get().volume * factor;
		},
		expire: () => {
			video?.pause();
			restoreFade();
			patch({ sleep: { mode: 'off', endsAt: null } });
			toast('info', 'Sleep timer paused playback');
			announce('Sleep timer paused playback');
		}
	});

	const position = () =>
		!video || video.readyState < 1 || awaitingStart ? pendingPosition : video.currentTime;
	const duration = () => {
		const d = video?.duration;
		if (d && Number.isFinite(d) && d > 0) return d;
		return session?.durationSeconds ?? state().item?.file.durationSeconds ?? 0;
	};
	const navigatorOnline = () => win?.navigator?.onLine ?? true;
	const hasNext = () => state().index + 1 < state().queue.length;

	function commitPrefs(changes: HqpPrefsPatch) {
		const next = mergeHqpPrefs(prefs.get(), changes);
		prefs.set(next);
		saveHqpPrefs(storage, next);
	}

	let toastSeq = 0;
	let announceSeq = 0;
	function toast(kind: HqpToast['kind'], text: string, action: HqpToast['action'] = null) {
		const t = now();
		const list = state().toasts;
		// One at a time: a queued toast starts when the previous one ends.
		const from = Math.max(t, list.at(-1)?.until ?? t);
		const entry: HqpToast = {
			id: ++toastSeq,
			kind,
			text,
			action,
			until: from + (action ? TOAST_ACTION_MS : TOAST_MS)
		};
		patch({ toasts: [...list, entry].slice(-3) });
		later(() => dismissToast(entry.id), entry.until - t);
	}
	function dismissToast(id: number) {
		const list = state().toasts;
		if (list.some((t) => t.id === id)) patch({ toasts: list.filter((t) => t.id !== id) });
	}
	const announce = (text: string) => patch({ announcement: { id: ++announceSeq, text } });

	function saveProgress(reason: ProgressReason, keepalive = false) {
		const item = state().item;
		if (!item || !itemStarted) return;
		void progress.save(reason, item.fileId, position(), duration() || null, keepalive);
	}

	const updatePosition = () => {
		if (video) mediaSession.setPosition(duration(), position(), video.playbackRate);
	};

	// ---- Clock and per-tick decisions -------------------------------------------------------

	function emitClock(force: boolean) {
		if (!video) return;
		const t = now();
		if (!force) {
			if (t - lastClockAt < 1000 / clockHz - 25) return;
			lastClockAt = t;
		}
		const ranges = bufferedRanges(video);
		const pos = position();
		const dur = duration();
		clock.set({ position: pos, duration: dur, bufferedEnd: bufferedEndAt(ranges, pos), ranges });
		onTick(pos, dur, ranges);
	}

	function onTick(pos: number, dur: number, ranges: Array<[number, number]>) {
		const s = state();
		const changes: Partial<HqpState> = {};
		const index = chapterAt(s.chapters, pos);
		if (index !== s.chapterIndex) changes.chapterIndex = index;
		const skipEnd = opening && pos >= opening.start && pos < opening.end - 1 ? opening.end : null;
		if ((s.skipIntro?.end ?? null) !== skipEnd) {
			changes.skipIntro = skipEnd === null ? null : { end: skipEnd };
		}
		if (Object.keys(changes).length) patch(changes);
		checkUpNext(pos);
		if (s.status === 'playing') saveProgress('tick');
		checkQuality(pos, dur, ranges);
	}

	function updateCredits() {
		const d = duration();
		const chapters = state().chapters;
		const fromSession = (session as { creditsStart?: number | null } | null)?.creditsStart ?? null;
		creditsAt = creditsStart(chapters, d, fromSession);
		const fallback = d - Math.max(45, d * 0.02);
		creditsReason = Math.abs(creditsAt - fallback) > 0.01 ? 'credits' : 'end';
		opening = d > 0 ? openingChapter(chapters, d) : null;
	}

	// ---- Up next ------------------------------------------------------------------------------

	function clearCountdown() {
		countdownTimer = cancel(countdownTimer);
		countdownResume = cancel(countdownResume);
	}

	function clearUpNext() {
		clearCountdown();
		if (state().upNext || state().stillWatching) patch({ upNext: null, stillWatching: false });
	}

	function runCountdown(ms: number) {
		countdownTimer = cancel(countdownTimer);
		countdownLeft = ms;
		countdownTimer = later(() => {
			countdownTimer = null;
			const up = state().upNext;
			if (up) void goTo(up.index, 'countdown');
		}, ms);
	}

	function showUpNext(reason: HqpUpNext['reason']) {
		const s = state();
		const index = s.index + 1;
		const item = s.queue[index];
		if (!item) return;
		const stillWatching = autoplays >= MAX_AUTOPLAYS;
		const countdown = prefs.get().autoplayNext && !stillWatching && s.sleep.mode !== 'end-of-item';
		patch({
			upNext: { index, item, reason, countdownEndsAt: countdown ? now() + COUNTDOWN_MS : null },
			stillWatching
		});
		if (countdown) runCountdown(COUNTDOWN_MS);
		announce(
			stillWatching
				? 'Still watching?'
				: `Up next: ${item.title}${countdown ? ', starting in 10 seconds' : ''}`
		);
	}

	function checkUpNext(pos: number) {
		const s = state();
		if (pos < creditsAt - 1 && s.status !== 'ended') {
			upNextDismissed = false;
			if (s.upNext) clearUpNext();
			return;
		}
		if (s.upNext || upNextDismissed || !hasNext() || !Number.isFinite(creditsAt)) return;
		if (s.status !== 'playing' && s.status !== 'paused' && s.status !== 'buffering') return;
		if (pos >= creditsAt) showUpNext(creditsReason);
	}

	// ---- Auto quality ---------------------------------------------------------------------------

	function checkQuality(pos: number, dur: number, ranges: Array<[number, number]>) {
		if (!video || !session || !started) return;
		const s = state();
		if (s.status !== 'playing' && s.status !== 'buffering') return;
		const active = s.quality.active;
		if (!active) return;
		const stats = transport?.stats() ?? null;
		if (active === 'original' && stats?.bitrate) originalBitrate = stats.bitrate;
		const decision = decideQuality({
			now: now(),
			choice: s.quality.choice,
			active,
			available: s.quality.available,
			lastSwitchAt,
			stalls,
			bufferAhead: bufferAhead(ranges, pos),
			throughput: stats?.throughput ?? null,
			bitrate: stats?.bitrate ?? null,
			remaining: dur - pos,
			paused: video.paused,
			// The engine cannot see a UI scrub: recent input counts as one.
			seeking: video.seeking || now() - lastInteractionAt < 2000,
			delivery: delivery ?? undefined,
			sustainedThroughput: stats?.sustained ?? null,
			originalBitrate
		});
		if (decision.action === 'suggest') {
			if (suggested) return;
			suggested = true;
			const to = decision.to;
			toast('warning', `Slow connection · Try ${levelLabel(to)}`, {
				label: `Try ${levelLabel(to)}`,
				run: () => void engine.setQuality(to)
			});
			return;
		}
		if (decision.action === 'down' || decision.action === 'up') {
			void autoStep(decision.action, decision.to);
		}
	}

	async function autoStep(direction: 'down' | 'up', to: QualityLevel) {
		lastSwitchAt = now();
		log('abr', `${direction} ${to}`);
		const error = await restart('quality', { quality: to });
		if (error) return;
		if (direction === 'down') {
			toast('warning', `Lower quality (${levelLabel(to)}) for smooth playback`, {
				label: 'Keep Original',
				run: () => void engine.setQuality('original')
			});
		} else toast('info', `Back to ${levelLabel(to)}`);
		announce(`Quality ${levelLabel(to)}`);
	}

	// ---- Sessions -------------------------------------------------------------------------------

	function wait(ms: number): Promise<void> {
		return new Promise((resolve) => {
			const id = later(() => {
				wakeRetry = null;
				resolve();
			}, ms);
			wakeRetry = () => {
				cancel(id);
				wakeRetry = null;
				resolve();
			};
		});
	}

	/** POSTs a session; network failures back off 2/4/8/16/30 s for up to 60 s. */
	async function openSession(
		body: StartSessionRequest,
		my: number
	): Promise<PlaybackSession | HqpError | null> {
		for (;;) {
			try {
				const s = await api.startSession(body);
				if (my !== gen) {
					void api.deleteSession(s.sessionId);
					return null;
				}
				netSince = 0;
				netAttempt = 0;
				if (!state().online && navigatorOnline()) patch({ online: true });
				return s;
			} catch (e) {
				if (my !== gen) return null;
				const error = e instanceof HqpRequestError ? e.error : errorFromStatus(null, null);
				if (error.code !== 'network') return error;
				netSince ||= now();
				if (now() - netSince >= NETWORK_GIVE_UP_MS) return error;
				patch({ online: false });
				log('network', 'session start failed');
				await wait(backoffDelay(netAttempt++));
				if (my !== gen) return null;
			}
		}
	}

	function closeSession() {
		transport?.destroy();
		transport = null;
		if (session) void api.deleteSession(session.sessionId);
		session = null;
	}

	function resetSource() {
		if (!video) return;
		video.removeAttribute('src');
		video.load();
	}

	function fail(error: HqpError) {
		log('error', `${error.code}${error.status ? ` ${error.status}` : ''}`);
		errorPosition = position();
		++gen;
		preparing = false;
		closeSession();
		resetSource();
		clearCountdown();
		bufferingTimer = cancel(bufferingTimer);
		netTimer = cancel(netTimer);
		patch({ status: 'error', error, session: null, upNext: null, stillWatching: false });
		announce(error.message);
		wakeLock.release();
		mediaSession.setState('none');
	}

	function preferredAudio(item: HqpItem): number | null {
		const lang = languageKey(prefs.get().audioLanguage);
		if (!lang) return null;
		return item.file.audio.find((a) => languageKey(a.language) === lang)?.ordinal ?? null;
	}

	function buildAudio(item: HqpItem, s: PlaybackSession): HqpAudioOption[] {
		const original = languageKey(item.originalLanguage);
		const list: PlaybackSession['audioTracks'] = s.audioTracks.length
			? s.audioTracks
			: item.file.audio.map((a) => ({
					ordinal: a.ordinal,
					label: a.title ?? a.language ?? `Track ${a.ordinal + 1}`,
					language: a.language
				}));
		return list.map((t) => {
			const f = item.file.audio.find((a) => a.ordinal === t.ordinal);
			const loose = t as typeof t & { codec?: string; channels?: number };
			const language = t.language ?? f?.language ?? null;
			return {
				ordinal: t.ordinal,
				label: t.label,
				language,
				title: f?.title ?? null,
				channels: f?.channels ?? loose.channels ?? null,
				codec: loose.codec ?? null,
				isOriginal: !!original && languageKey(language) === original,
				selected: t.ordinal === s.audio
			};
		});
	}

	function buildSubtitleOptions(item: HqpItem, s: PlaybackSession): HqpSubtitleOption[] {
		const byOrdinal = new Map<number, HqpSubtitleOption>();
		for (const f of item.file.subtitles) {
			byOrdinal.set(f.ordinal, {
				ordinal: f.ordinal,
				label: f.title ?? (f.language ? f.language.toUpperCase() : 'Unknown'),
				language: f.language,
				title: f.title,
				forced: f.forced,
				sdh: isSdh(f.title),
				isText: f.isText,
				url: null
			});
		}
		for (const t of s.subtitleTracks) {
			const known = byOrdinal.get(t.ordinal);
			byOrdinal.set(t.ordinal, {
				ordinal: t.ordinal,
				label: t.label,
				language: t.language ?? known?.language ?? null,
				title: known?.title ?? null,
				forced: t.forced ?? known?.forced ?? false,
				sdh: isSdh(known?.title) || isSdh(t.label),
				isText: true,
				url: t.url
			});
		}
		return [...byOrdinal.values()].sort((a, b) => a.ordinal - b.ordinal);
	}

	function attach(
		s: PlaybackSession,
		at: number,
		play: boolean,
		requested: QualityLevel,
		keepSelection: boolean
	) {
		const item = state().item;
		if (!video || !delivery || !item) return;
		session = s;
		pendingPosition = at;
		awaitingStart = true;
		pendingSeek = null;
		preparing = false;
		wantPlay = play;
		started = false;
		openStall = null;
		const audio = buildAudio(item, s);
		const options = buildSubtitleOptions(item, s);
		const prev = state().subtitles;
		const valid = (o: number | null) =>
			o === null || options.some((x) => x.ordinal === o && x.isText && !!x.url);
		let selected: number | null;
		let forced: number | null;
		if (keepSelection && valid(prev.selected) && valid(prev.forced)) {
			({ selected, forced } = prev);
		} else {
			const lang = audio.find((a) => a.selected)?.language ?? null;
			({ selected, forced } = chooseSubtitles(options, lang, prefs.get()));
		}
		if (selected !== null) lastSubtitle = selected;
		syncTracks(options);
		// Every track is disabled while the new source attaches: Chrome holds a new source at
		// HAVE_CURRENT_DATA while any enabled track is still loading. The shown one returns on playing.
		tracksLive = false;
		setTrackModes();
		const active = s.quality ?? requested;
		const aspect = s.video.width && s.video.height ? s.video.width / s.video.height : null;
		patch({
			session: s,
			caps,
			delivery,
			quality: {
				choice: state().quality.choice,
				active,
				available: s.qualities?.length ? s.qualities : [active]
			},
			audio: { options: audio, mode: s.audioMode ?? null },
			subtitles: { options, selected, forced, offsetSeconds: prev.offsetSeconds },
			hdrShown: !!s.video.hdr && !!caps?.hdrDisplay,
			...(aspect ? { aspect, frameMode: prefs.get().frameModes[aspectClassOf(aspect)] } : {}),
			status: state().status === 'switching' ? 'switching' : 'loading'
		});
		setCueTrack();
		transport?.destroy();
		const t = createTransport(video, delivery, {
			loadHls,
			now,
			log,
			onFailure: (failure) => {
				if (transport === t) onTransportFailure(failure);
			},
			onNetwork: (ok) => {
				if (transport === t) patch({ online: ok && navigatorOnline() });
			}
		});
		transport = t;
		const url = delivery === 'native' ? (s.masterPlaylistUrl ?? s.playlistUrl) : s.playlistUrl;
		void t.attach(url, at);
		log('session', `${s.video.mode} ${s.video.codec} ${active} ${delivery}`);
	}

	async function startItem(startAt: number | 'resume', autoplay: boolean) {
		const my = ++gen;
		const item = state().item;
		if (!video || !item) return;
		clearItem();
		patch({ status: 'starting', error: null, autoplayBlocked: false });
		const report = await resolveCaps(probeOf(video), sessionStore);
		if (my !== gen) return;
		caps = report.caps;
		delivery = report.delivery;
		if (!delivery) return fail(errorFromStatus(null, null, 'unsupported'));
		const total = item.file.durationSeconds ?? item.progress?.durationSeconds ?? null;
		const start =
			typeof startAt === 'number'
				? clamp(startAt, 0, total ? Math.max(0, total - 1) : startAt)
				: (resumePoint(item.progress, total, prefs.get().resume) ?? 0);
		resumeFrom = startAt === 'resume' && start > 0 ? start : null;
		const choice = prefs.get().quality;
		const quality: QualityLevel = choice === 'auto' ? 'original' : choice;
		pendingPosition = start;
		awaitingStart = true;
		patch({ caps, delivery, quality: { choice, active: null, available: [] } });
		const result = await openSession(
			{ fileId: item.file.fileId, audio: preferredAudio(item), caps, quality, startSeconds: start },
			my
		);
		if (result === null) return;
		if (!isSession(result)) return fail(result);
		attach(result, start, autoplay, quality, false);
		lastSwitchAt = now();
		progress.reset(item.fileId, start);
		mediaSession.setItem(item);
		setMediaHandlers();
		fetchChapters(result, item);
	}

	/** A new session for the same item at the current position (quality, audio, recovery). */
	async function restart(
		reason: SwitchReason,
		change: { quality?: QualityLevel; audio?: number | null }
	): Promise<HqpError | null> {
		const item = state().item;
		const prev = session;
		if (!video || !item || !prev || !caps) return errorFromStatus(null, null);
		const my = ++gen;
		const at = position();
		const intent = wantPlay || !video.paused;
		netTimer = cancel(netTimer);
		bufferingTimer = cancel(bufferingTimer);
		patch({ status: 'switching' });
		preparing = true;
		const quality = change.quality ?? state().quality.active ?? 'original';
		const audio = change.audio !== undefined ? change.audio : prev.audio >= 0 ? prev.audio : null;
		log('switch', `${reason} ${quality}`);
		const result = await openSession(
			{ fileId: item.file.fileId, audio, caps, quality, startSeconds: at },
			my
		);
		if (result === null) return null;
		if (!isSession(result)) {
			preparing = false;
			if (reason === 'reload' || reason === 'decode') {
				if (result.code === 'network') recoverNetwork('reload failed');
				else fail(result);
				return result;
			}
			// The previous session still plays: carry on with it.
			patch({ status: video.paused ? 'paused' : 'playing' });
			return result;
		}
		const resumeAt = video.paused ? at : position();
		attach(result, resumeAt, intent, quality, true);
		if (prev.sessionId !== result.sessionId) void api.deleteSession(prev.sessionId);
		lastSwitchAt = now();
		stalls = [];
		suggested = false;
		return null;
	}

	function recoverNetwork(reason: string) {
		log('network', reason);
		netSince ||= now();
		if (now() - netSince >= NETWORK_GIVE_UP_MS) return fail(errorFromStatus(null, null, 'network'));
		patch({ online: false });
		const my = gen;
		netTimer = cancel(netTimer);
		netTimer = later(() => {
			netTimer = null;
			if (my === gen) void restart('reload', {});
		}, backoffDelay(netAttempt++));
	}

	function recoverExpired() {
		const t = now();
		expiries = expiries.filter((x) => x > t - 30_000);
		expiries.push(t);
		if (expiries.length > 2) return fail(errorFromStatus(404, null));
		log('expired');
		void restart('reload', {});
	}

	async function onDecodeFailure(detail: string) {
		const s = session;
		log('decode', detail);
		if (!s || !caps) return;
		if (!decodeRetried && s.video.mode === 'copy') {
			const codec = decodeFallbackCodec(s.video.codec, caps);
			if (codec) {
				decodeRetried = true;
				disableCodec(sessionStore, codec);
				caps = applyCapsOverride(caps, readCapsOverride(sessionStore));
				patch({ caps });
				toast('warning', `Converted stream: this device could not decode ${CODEC_NAMES[codec]}`);
				await restart('decode', {});
				return;
			}
		}
		fail(errorFromStatus(null, null, 'decode', '1080p'));
	}

	function onTransportFailure(failure: TransportFailure) {
		log('transport', `${failure.kind} ${failure.status ?? ''} ${failure.detail}`.trim());
		switch (failure.kind) {
			case 'decode':
				return void onDecodeFailure(failure.detail);
			case 'expired':
				return recoverExpired();
			case 'network':
				return failure.status === null && delivery === 'native'
					? recoverNetwork(failure.detail)
					: fail(errorFromStatus(null, null, 'network'));
			case 'http':
				return fail(errorFromStatus(failure.status, null));
			case 'unsupported':
				return fail(errorFromStatus(null, null, 'unsupported'));
			default:
				return fail(errorFromStatus(null, null));
		}
	}

	// ---- Tracks and cues ------------------------------------------------------------------------

	function removeTracks() {
		cueTrack?.removeEventListener('cuechange', emitCues);
		cueTrack = null;
		for (const { el } of tracks.values()) {
			el.removeEventListener('load', onTrackLoad);
			el.remove();
		}
		tracks.clear();
		appliedOffset.clear();
		tracksLive = false;
	}

	function syncTracks(options: HqpSubtitleOption[]) {
		if (!video || !doc) return;
		const wanted = options.filter((o) => o.isText && o.url);
		const same =
			wanted.length === tracks.size && wanted.every((o) => tracks.get(o.ordinal)?.url === o.url);
		if (same) return;
		removeTracks();
		for (const o of wanted) {
			const el = doc.createElement('track');
			el.kind = 'subtitles';
			el.label = o.label;
			el.srclang = toBcp47(o.language);
			el.src = o.url!;
			el.addEventListener('load', onTrackLoad);
			video.appendChild(el);
			el.track.mode = tracksLive ? 'hidden' : 'disabled';
			tracks.set(o.ordinal, { el, url: o.url! });
		}
	}

	function applyOffset(el: HTMLTrackElement) {
		const want = state().subtitles.offsetSeconds;
		const delta = want - (appliedOffset.get(el) ?? 0);
		const list = el.track.cues;
		if (!delta || !list || list.length === 0) return;
		for (const cue of Array.from(list)) {
			cue.startTime = Math.round((cue.startTime + delta) * 1000) / 1000;
			cue.endTime = Math.round((cue.endTime + delta) * 1000) / 1000;
		}
		appliedOffset.set(el, want);
	}

	function onTrackLoad(event: Event) {
		applyOffset(event.target as HTMLTrackElement);
		emitCues();
	}

	function emitCues() {
		const active = cueTrack?.activeCues;
		if (!active || active.length === 0) {
			if (cues.get().length) cues.set([]);
			return;
		}
		const list: HqpCue[] = [];
		Array.from(active).forEach((cue, i) => {
			const lines = cueToSpans((cue as VTTCue).text ?? '');
			if (lines.length) list.push({ id: cue.id || `${cue.startTime}:${i}`, lines });
		});
		cues.set(list);
	}

	function setTrackModes() {
		const sub = state().subtitles;
		const shown = sub.selected ?? sub.forced;
		const native = system.pip || system.airplayActive || system.nativeFullscreen;
		for (const [ordinal, { el }] of tracks) {
			// Only the shown (or forced) track is ever enabled, so one slow WebVTT never loads unasked.
			const mode: TextTrackMode =
				!tracksLive || ordinal !== shown ? 'disabled' : native ? 'showing' : 'hidden';
			if (el.track.mode !== mode) el.track.mode = mode;
		}
	}

	function setCueTrack() {
		const sub = state().subtitles;
		const shown = sub.selected ?? sub.forced;
		const next = shown === null ? null : (tracks.get(shown)?.el.track ?? null);
		if (next !== cueTrack) {
			cueTrack?.removeEventListener('cuechange', emitCues);
			cueTrack = next;
			cueTrack?.addEventListener('cuechange', emitCues);
		}
		setTrackModes();
		emitCues();
	}

	function setSubtitleChoice(selected: number | null, forced: number | null) {
		patch({ subtitles: { ...state().subtitles, selected, forced } });
		setCueTrack();
	}

	function applySubtitlePolicy() {
		const s = state();
		const lang = s.audio.options.find((a) => a.selected)?.language ?? null;
		const pick = chooseSubtitles(s.subtitles.options, lang, prefs.get());
		if (pick.selected !== null) lastSubtitle = pick.selected;
		setSubtitleChoice(pick.selected, pick.forced);
	}

	// ---- Chapters, item lifecycle ---------------------------------------------------------------

	function fetchChapters(s: PlaybackSession, item: HqpItem) {
		if (chaptersFor === item.fileId || !s.chaptersUrl) return;
		chaptersFor = item.fileId;
		void api.chapters(s.chaptersUrl).then((chapters) => {
			if (destroyed || state().item?.fileId !== item.fileId) return;
			patch({ chapters, chapterIndex: chapterAt(chapters, position()) });
			updateCredits();
		});
	}

	function clearItem() {
		clearUpNext();
		resumeTimer = cancel(resumeTimer);
		seekSaveTimer = cancel(seekSaveTimer);
		bufferingTimer = cancel(bufferingTimer);
		stallTimer = cancel(stallTimer);
		netTimer = cancel(netTimer);
		removeTracks();
		cues.set([]);
		chaptersFor = null;
		creditsAt = Number.POSITIVE_INFINITY;
		opening = null;
		upNextDismissed = false;
		trickplayLoad = null;
		trickplayAt = 0;
		decodeRetried = false;
		suggested = false;
		originalBitrate = null;
		lastSubtitle = null;
		itemStarted = false;
		stalls = [];
		openStall = null;
		expiries = [];
		patch({
			session: null,
			chapters: [],
			chapterIndex: -1,
			skipIntro: null,
			trickplay: null,
			resume: null,
			audio: { options: [], mode: null },
			subtitles: EMPTY_SUBTITLES,
			hdrShown: false
		});
	}

	/** Saves the leaving item's place, closes its session and local per-item state. */
	function leaveItem() {
		const s = state();
		const item = s.item;
		if (item && itemStarted) {
			const pos = position();
			const dur = duration() || null;
			void progress.save('item', item.fileId, pos, dur, true);
			const saved = {
				fileId: item.fileId,
				positionSeconds: pos,
				durationSeconds: dur,
				completed: isCompletedPosition(pos, dur),
				updatedAt: new Date(now()).toISOString()
			};
			patch({ queue: s.queue.map((q) => (q === item ? { ...q, progress: saved } : q)) });
		}
		progress.cancel();
		++gen;
		closeSession();
		clearItem();
		wantPlay = false;
		preparing = false;
		if (video && !video.paused) video.pause();
	}

	async function goTo(target: number, cause: 'user' | 'countdown') {
		const s = state();
		if (destroyed || target < 0 || target >= s.queue.length) return;
		autoplays = cause === 'countdown' ? autoplays + 1 : 0;
		leaveItem();
		const item = state().queue[target];
		patch({ index: target, item, status: 'starting' });
		options.onItemChange?.(item, target);
		await startItem('resume', true);
	}

	function setMediaHandlers() {
		mediaSession.setHandlers({
			play: () => void engine.play(),
			pause: () => engine.pause(),
			seekBy: (delta) => engine.skip(delta),
			seekTo: (seconds) => engine.seek(seconds),
			previous: () => engine.seekChapter(-1),
			next: hasNext() ? () => void engine.next() : null
		});
	}

	function showResume(from: number) {
		patch({ resume: { from, until: now() + RESUME_NOTICE_MS } });
		announce(`Resumed at ${formatTime(from)}`);
		resumeTimer = cancel(resumeTimer);
		resumeTimer = later(() => {
			resumeTimer = null;
			patch({ resume: null });
		}, RESUME_NOTICE_MS);
	}

	async function attemptPlay(): Promise<void> {
		if (!video) return;
		try {
			await video.play();
		} catch (e) {
			const name = (e as Error | null)?.name ?? '';
			if (name === 'AbortError') return;
			log('play', name || 'rejected');
			patch({ autoplayBlocked: true, status: 'paused' });
		}
	}

	/** The new source reached its start: apply a seek asked while it was loading. */
	function settleStart() {
		awaitingStart = false;
		if (pendingSeek === null || !video) return;
		const target = pendingSeek;
		pendingSeek = null;
		video.currentTime = target;
	}

	function restoreFade() {
		if (fading && video) video.volume = prefs.get().volume;
		fading = false;
	}

	// ---- Media element events -------------------------------------------------------------------

	function scheduleBufferingCheck() {
		bufferingTimer = cancel(bufferingTimer);
		bufferingTimer = later(() => {
			bufferingTimer = null;
			if (state().status !== 'buffering') return;
			emitClock(true);
			if (state().status === 'buffering') scheduleBufferingCheck();
		}, 1000);
	}

	function endStall() {
		if (openStall) openStall.end = now();
		openStall = null;
	}

	function handleEnded() {
		saveProgress('ended');
		wakeLock.ended();
		mediaSession.setState('paused');
		endStall();
		if (state().sleep.mode === 'end-of-item') {
			sleepTimer.clear();
			patch({ status: 'ended', sleep: { mode: 'off', endsAt: null } });
			clearCountdown();
			if (state().upNext?.countdownEndsAt) {
				patch({ upNext: { ...state().upNext!, countdownEndsAt: null } });
			}
			toast('info', 'Sleep timer paused playback');
			announce('Sleep timer paused playback');
			return;
		}
		patch({ status: 'ended' });
		if (hasNext() && !state().upNext) {
			upNextDismissed = false;
			showUpNext('end');
		}
	}

	function handleMediaError() {
		if (!video || !session || !transport) return;
		const status = state().status;
		if (status === 'error' || status === 'idle' || status === 'starting') return;
		const code = video.error?.code ?? 0;
		log('media-error', String(code));
		// hls.js watches the element itself and reports a media error of its own.
		if (delivery !== 'native') return;
		if (code === 3) return void onDecodeFailure('video-error-3');
		if (code === 2) return recoverNetwork('video-error-2');
		// Not supported: either the stream (decode) or the playlist answer (HTTP): ask the server.
		const s = session;
		const my = gen;
		void api.probe(s.masterPlaylistUrl ?? s.playlistUrl).then((http) => {
			if (my !== gen) return;
			if (http >= 200 && http < 300) return void onDecodeFailure(`video-error-${code}`);
			if (http === 0) return recoverNetwork('playlist unreachable');
			onTransportFailure({
				kind: http === 404 || http === 410 ? 'expired' : 'http',
				status: http,
				detail: 'playlist'
			});
		});
	}

	function handleStalled() {
		if (delivery !== 'native' || !video || video.paused) return;
		const my = gen;
		const at = video.currentTime;
		stallTimer = cancel(stallTimer);
		stallTimer = later(() => {
			stallTimer = null;
			const v = video;
			if (my !== gen || !v || v.paused || v.readyState >= 3) return;
			if (Math.abs(v.currentTime - at) < 0.5) recoverNetwork('stalled');
		}, NATIVE_STALL_MS);
	}

	const mediaHandlers: Record<string, (event: Event) => void> = {
		loadedmetadata: () => {
			if (!video) return;
			itemStarted = true;
			if (video.videoWidth && video.videoHeight) {
				const aspect = video.videoWidth / video.videoHeight;
				patch({ aspect, frameMode: prefs.get().frameModes[aspectClassOf(aspect)] });
			}
			updateCredits();
			updatePosition();
			emitClock(true);
		},
		durationchange: () => {
			updateCredits();
			emitClock(true);
		},
		progress: () => emitClock(true),
		seeking: () => {
			lastSeekAt = now();
			emitClock(true);
		},
		seeked: () => {
			emitClock(true);
			updatePosition();
			seekSaveTimer = cancel(seekSaveTimer);
			seekSaveTimer = later(() => {
				seekSaveTimer = null;
				saveProgress('seek');
			}, 1000);
			if (video && state().status === 'ended' && !video.ended) {
				patch({ status: video.paused ? 'paused' : 'playing' });
			}
		},
		timeupdate: () => {
			stallTimer = cancel(stallTimer);
			emitClock(false);
		},
		canplay: () => {
			const status = state().status;
			if (preparing || !awaitingStart || (status !== 'loading' && status !== 'switching')) return;
			settleStart();
			if (resumeFrom !== null) showResume(resumeFrom);
			resumeFrom = null;
			if (wantPlay) {
				wantPlay = false;
				void attemptPlay();
			} else patch({ status: 'paused' });
		},
		play: () => {
			mediaSession.setState('playing');
			updatePosition();
		},
		playing: () => {
			// The previous source keeps playing while a switch is prepared.
			if (preparing) return;
			settleStart();
			started = true;
			if (!tracksLive) {
				tracksLive = true;
				setTrackModes();
			}
			endStall();
			bufferingTimer = cancel(bufferingTimer);
			stallTimer = cancel(stallTimer);
			netSince = 0;
			netAttempt = 0;
			patch({
				status: 'playing',
				autoplayBlocked: false,
				...(state().online || !navigatorOnline() ? {} : { online: true })
			});
			wakeLock.playing();
			mediaSession.setState('playing');
		},
		waiting: () => {
			if (!video || video.paused || !started) return;
			const status = state().status;
			if (status !== 'playing' && status !== 'buffering') return;
			if (!openStall) {
				const seek = video.seeking || now() - lastSeekAt < 2000;
				openStall = { start: now(), end: null, seek };
				stalls = [...stalls.filter((x) => x.start > now() - 180_000), openStall];
			}
			patch({ status: 'buffering' });
			scheduleBufferingCheck();
		},
		pause: () => {
			if (!video || video.ended) return;
			const status = state().status;
			if (status !== 'playing' && status !== 'buffering' && status !== 'paused') return;
			endStall();
			bufferingTimer = cancel(bufferingTimer);
			patch({ status: 'paused' });
			saveProgress('pause');
			wakeLock.paused();
			mediaSession.setState('paused');
			updatePosition();
		},
		ended: () => handleEnded(),
		ratechange: () => {
			if (video && !state().held) patch({ rate: video.playbackRate });
			updatePosition();
		},
		volumechange: () => {
			if (video && !fading) patch({ volume: video.volume, muted: video.muted });
		},
		error: () => handleMediaError(),
		stalled: () => handleStalled()
	};

	function onVisibility() {
		if (!doc) return;
		if (doc.visibilityState === 'hidden') {
			saveProgress('hide', true);
			wakeLock.hidden();
		} else wakeLock.visible(!!video && !video.paused);
	}

	function onPageHide(event: Event) {
		saveProgress('hide', true);
		if (!(event as PageTransitionEvent).persisted && session) {
			void api.deleteSession(session.sessionId);
		}
	}

	function onOnline() {
		patch({ online: true });
		void progress.retryPending();
		transport?.retryNow();
		wakeRetry?.();
		if (netTimer) {
			netTimer = cancel(netTimer);
			void restart('reload', {});
		}
	}

	function onOffline() {
		patch({ online: false });
	}

	function onSystem(next: SystemState) {
		system = next;
		patch({
			pip: next.pip,
			airplay: { available: next.airplayAvailable, active: next.airplayActive },
			fullscreen: next.fullscreen
		});
		setTrackModes();
	}

	// ---- Public API -------------------------------------------------------------------------------

	const engine: HqpEngine = {
		snapshot: { subscribe: snapshot.subscribe },
		clock: { subscribe: clock.subscribe },
		cues: { subscribe: cues.subscribe },
		prefs: { subscribe: prefs.subscribe },

		attach(element) {
			if (destroyed || element === video) return;
			detachVideo?.();
			video = element;
			doc = element.ownerDocument;
			win = (doc?.defaultView as (Window & typeof globalThis) | null) ?? null;
			// iOS ignores volume writes: detect it before applying the saved level.
			const before = element.volume;
			const probeLevel = before === 1 ? 0.5 : 1;
			try {
				element.volume = probeLevel;
				volumeWritable = element.volume === probeLevel;
				element.volume = before;
			} catch {
				volumeWritable = false;
			}
			const p = prefs.get();
			if (volumeWritable) element.volume = p.volume;
			element.muted = p.muted;
			for (const [type, fn] of Object.entries(mediaHandlers)) element.addEventListener(type, fn);
			doc?.addEventListener('visibilitychange', onVisibility);
			win?.addEventListener('pagehide', onPageHide);
			win?.addEventListener('online', onOnline);
			win?.addEventListener('offline', onOffline);
			const stopSystem = doc ? watchSystem(element, doc, onSystem) : () => {};
			wakeLock = createWakeLock(win?.navigator);
			mediaSession = createMediaSessionBridge(win);
			patch({ online: navigatorOnline(), volume: p.volume, muted: p.muted });
			detachVideo = () => {
				for (const [type, fn] of Object.entries(mediaHandlers)) {
					element.removeEventListener(type, fn);
				}
				doc?.removeEventListener('visibilitychange', onVisibility);
				win?.removeEventListener('pagehide', onPageHide);
				win?.removeEventListener('online', onOnline);
				win?.removeEventListener('offline', onOffline);
				stopSystem();
			};
		},

		async load(payload, opts = {}) {
			if (destroyed) return;
			if (!video) throw new Error('HqpEngine.attach(video) must run before load()');
			if (state().item) leaveItem();
			const queue = [...payload.queue];
			if (queue.length === 0) return fail(errorFromStatus(404, null));
			const index = clamp(Math.trunc(payload.index) || 0, 0, queue.length - 1);
			autoplays = 0;
			patch({ queue, index, item: queue[index], status: 'starting', error: null });
			await startItem(opts.startAt ?? 'resume', opts.autoplay ?? true);
		},

		async play() {
			if (!video || !session) return;
			const status = state().status;
			if (status === 'loading' || status === 'switching' || status === 'starting') {
				wantPlay = true;
				return;
			}
			await attemptPlay();
		},

		pause() {
			wantPlay = false;
			video?.pause();
		},

		toggle() {
			if (!video) return;
			if (video.paused || state().status === 'ended') void engine.play();
			else engine.pause();
		},

		seek(seconds) {
			if (!video || !Number.isFinite(seconds)) return;
			const d = duration();
			const target = clamp(seconds, 0, d > 0 ? Math.max(0, d - 0.25) : seconds);
			lastSeekAt = now();
			if (awaitingStart) {
				pendingSeek = target;
				pendingPosition = target;
				emitClock(true);
				return;
			}
			video.currentTime = target;
			emitClock(true);
		},

		skip(delta) {
			engine.seek(position() + delta);
		},

		seekChapter(direction) {
			const chapters = state().chapters;
			const pos = position();
			if (chapters.length === 0) {
				if (direction < 0) engine.seek(0);
				return;
			}
			const i = chapterAt(chapters, pos);
			if (direction > 0) {
				const next = chapters[i + 1];
				if (next) engine.seek(next.start);
				return;
			}
			const current = chapters[i];
			if (current && pos - current.start > 3) engine.seek(current.start);
			else engine.seek(chapters[Math.max(0, i - 1)]?.start ?? 0);
		},

		stepFrame(direction) {
			if (!video) return;
			if (!video.paused) engine.pause();
			const fps = (session?.video as { frameRate?: number } | undefined)?.frameRate || 24;
			engine.seek(position() + direction / fps);
		},

		startOver() {
			resumeTimer = cancel(resumeTimer);
			patch({ resume: null });
			engine.seek(0);
			if (video?.paused) void engine.play();
		},

		setRate(rate) {
			const r = clamp(rate, 0.25, 4);
			if (state().held) heldBase = r;
			else if (video) video.playbackRate = r;
			patch({ rate: r });
		},

		holdRate(on) {
			if (!video || on === state().held) return;
			if (on) {
				heldBase = video.playbackRate;
				patch({ held: true });
				video.playbackRate = 2;
			} else {
				patch({ held: false });
				video.playbackRate = heldBase;
			}
		},

		setVolume(level) {
			const v = clamp(level, 0, 1);
			const unmute = v > 0 && state().muted;
			if (video) {
				if (volumeWritable) video.volume = v;
				if (unmute) video.muted = false;
			}
			commitPrefs(unmute ? { volume: v, muted: false } : { volume: v });
			patch({ volume: v, ...(unmute ? { muted: false } : {}) });
		},

		setMuted(muted) {
			if (video) video.muted = muted;
			commitPrefs({ muted });
			patch({ muted });
		},

		async setQuality(choice: QualityChoice) {
			const s = state();
			const previous = s.quality.choice;
			const target: QualityLevel =
				choice === 'auto'
					? previous === 'auto'
						? (s.quality.active ?? 'original')
						: 'original'
					: choice;
			commitPrefs({ quality: choice });
			patch({ quality: { ...s.quality, choice } });
			if (s.status === 'error' && s.item) {
				await startItem(errorPosition, true);
				return;
			}
			if (!session || s.status === 'starting' || s.status === 'idle') return;
			if (target !== s.quality.active) {
				const error = await restart('quality', { quality: target });
				if (error) {
					commitPrefs({ quality: previous });
					patch({ quality: { ...state().quality, choice: previous } });
					toast('error', `Couldn't change the quality: ${error.message}`);
					return;
				}
			}
			announce(`Quality ${choice === 'auto' ? 'Auto' : levelLabel(target)}`);
		},

		async setAudio(ordinal) {
			const s = state();
			const option = s.audio.options.find((o) => o.ordinal === ordinal);
			if (!option || option.selected || !session) return;
			if (s.status === 'starting' || s.status === 'error' || s.status === 'idle') return;
			toast('info', `Switching to ${option.label}…`);
			const error = await restart('audio', { audio: ordinal });
			if (error) {
				toast('error', `Couldn't switch the audio: ${error.message}`);
				return;
			}
			if (option.language && languageKey(option.language)) {
				commitPrefs({ audioLanguage: languageKey(option.language) });
			}
			if (prefs.get().subtitleMode === 'auto') applySubtitlePolicy();
			announce(`Audio: ${option.label}`);
		},

		async cycleAudio() {
			const list = state().audio.options;
			if (list.length < 2) return;
			const at = list.findIndex((o) => o.selected);
			await engine.setAudio(list[(at + 1) % list.length].ordinal);
		},

		setSubtitles(ordinal) {
			const sub = state().subtitles;
			if (ordinal === null) {
				commitPrefs({ subtitleMode: 'off' });
				const lang = state().audio.options.find((a) => a.selected)?.language ?? null;
				setSubtitleChoice(null, chooseSubtitles(sub.options, lang, prefs.get()).forced);
				announce('Subtitles off');
				return;
			}
			const option = sub.options.find((o) => o.ordinal === ordinal);
			if (!option || !option.isText || !option.url) return;
			lastSubtitle = ordinal;
			const lang = languageKey(option.language);
			commitPrefs({ subtitleMode: 'on', ...(lang ? { subtitleLanguage: lang } : {}) });
			setSubtitleChoice(ordinal, null);
			announce(`Subtitles: ${option.label}`);
		},

		toggleSubtitles() {
			const sub = state().subtitles;
			if (sub.selected !== null) return engine.setSubtitles(null);
			const usable = (o: number | null) =>
				o !== null && sub.options.some((x) => x.ordinal === o && x.isText && !!x.url);
			const lang = state().audio.options.find((a) => a.selected)?.language ?? null;
			const target = usable(lastSubtitle)
				? lastSubtitle
				: chooseSubtitles(sub.options, lang, { ...prefs.get(), subtitleMode: 'on' }).selected;
			if (target !== null) engine.setSubtitles(target);
		},

		setSubtitleOffset(seconds) {
			const value = Math.round(clamp(Number(seconds) || 0, -10, 10) * 10) / 10;
			patch({ subtitles: { ...state().subtitles, offsetSeconds: value } });
			for (const { el } of tracks.values()) applyOffset(el);
			emitCues();
		},

		setFrameMode(mode) {
			const aspectClass = aspectClassOf(state().aspect);
			commitPrefs({ frameModes: { [aspectClass]: mode } });
			patch({ frameMode: mode });
		},

		playIndex: (index) => goTo(index, 'user'),

		async next() {
			if (hasNext()) await goTo(state().index + 1, 'user');
		},

		cancelUpNext() {
			upNextDismissed = true;
			clearUpNext();
		},

		confirmStillWatching() {
			autoplays = 0;
			const up = state().upNext;
			patch({ stillWatching: false });
			if (up) void goTo(up.index, 'user');
		},

		setSleep(mode: SleepMode) {
			sleepTimer.clear();
			restoreFade();
			const endsAt = sleepEndsAt(mode, now());
			patch({ sleep: { mode, endsAt } });
			if (endsAt !== null) sleepTimer.start(endsAt);
			const up = state().upNext;
			if (mode === 'end-of-item' && up?.countdownEndsAt) {
				clearCountdown();
				patch({ upNext: { ...up, countdownEndsAt: null } });
			}
			announce(
				mode === 'off'
					? 'Sleep timer off'
					: mode === 'end-of-item'
						? 'Sleep at the end of this one'
						: `Sleep in ${mode} minutes`
			);
		},

		async togglePip() {
			if (!video || !doc) return;
			try {
				await togglePictureInPicture(video, doc);
			} catch (e) {
				log('pip', (e as Error)?.name ?? 'failed');
			}
		},

		showAirPlayPicker() {
			if (video) showAirPlayPicker(video);
		},

		async toggleFullscreen(target) {
			if (!doc) return;
			try {
				await toggleElementFullscreen(target, doc);
			} catch (e) {
				log('fullscreen', (e as Error)?.name ?? 'failed');
			}
		},

		setClockRate(hz) {
			clockHz = hz === 1 ? 1 : 4;
		},

		noteInteraction() {
			lastInteractionAt = now();
			autoplays = 0;
			const up = state().upNext;
			if (!up || (up.countdownEndsAt === null && !countdownResume)) return;
			if (up.countdownEndsAt !== null) {
				countdownLeft = Math.max(1000, up.countdownEndsAt - now());
				countdownTimer = cancel(countdownTimer);
				patch({ upNext: { ...up, countdownEndsAt: null } });
			}
			countdownResume = cancel(countdownResume);
			countdownResume = later(() => {
				countdownResume = null;
				const current = state().upNext;
				if (!current) return;
				patch({ upNext: { ...current, countdownEndsAt: now() + countdownLeft } });
				runCountdown(countdownLeft);
			}, COUNTDOWN_PAUSE_MS);
		},

		async retry() {
			const s = state();
			if (s.status === 'error' && s.item) {
				await startItem(errorPosition, true);
				return;
			}
			if (session) await restart('reload', {});
		},

		dismissToast,

		async ensureTrickplay() {
			const s = session;
			const item = state().item;
			if (!s?.trickplayUrl || !item) return null;
			const current = state().trickplay;
			if (current && current.status !== 'pending') return current;
			if (trickplayLoad) return trickplayLoad;
			// Pending sheets are asked again on a later scrub, at most every 10 s (never polled).
			if (current && now() - trickplayAt < 10_000) return current;
			trickplayAt = now();
			const load = api.trickplay(s.trickplayUrl).then((manifest) => {
				if (state().item?.fileId === item.fileId) patch({ trickplay: manifest });
				return manifest;
			});
			trickplayLoad = load;
			try {
				return await load;
			} finally {
				if (trickplayLoad === load) trickplayLoad = null;
			}
		},

		updatePrefs(changes) {
			commitPrefs(changes);
			const p = prefs.get();
			if (video && ('volume' in changes || 'muted' in changes)) {
				if (volumeWritable) video.volume = p.volume;
				video.muted = p.muted;
				patch({ volume: p.volume, muted: p.muted });
			}
			if (changes.frameModes) patch({ frameMode: p.frameModes[aspectClassOf(state().aspect)] });
			const up = state().upNext;
			if (changes.autoplayNext === false && up?.countdownEndsAt) {
				clearCountdown();
				patch({ upNext: { ...up, countdownEndsAt: null } });
			}
		},

		metrics() {
			if (refreshHz === undefined) {
				refreshHz = null;
				const raf = win?.requestAnimationFrame?.bind(win);
				void estimateRefreshRate(raf).then((hz) => (refreshHz = hz));
			}
			const s = state();
			return buildMetrics({
				video,
				session,
				delivery,
				item: s.item,
				hdrShown: s.hdrShown,
				audio: s.audio.options,
				subtitles: s.subtitles,
				stats: transport?.stats() ?? null,
				quality: { choice: s.quality.choice, active: s.quality.active },
				screen: {
					width: win?.innerWidth ?? 0,
					height: win?.innerHeight ?? 0,
					dpr: win?.devicePixelRatio ?? 1,
					refreshHz,
					hdr: !!win?.matchMedia?.('(dynamic-range: high)').matches
				}
			});
		},

		diagnostics() {
			const s = state();
			const report = {
				hqp: 1,
				at: new Date(now()).toISOString(),
				metrics: engine.metrics(),
				state: {
					status: s.status,
					error: s.error,
					index: s.index,
					queueLength: s.queue.length,
					fileId: s.item?.fileId ?? null,
					kind: s.item?.kind ?? null,
					quality: s.quality,
					audio: s.audio.options.find((a) => a.selected)?.ordinal ?? null,
					subtitles: {
						selected: s.subtitles.selected,
						forced: s.subtitles.forced,
						offsetSeconds: s.subtitles.offsetSeconds
					},
					online: s.online,
					pip: s.pip,
					airplay: s.airplay,
					rate: s.rate,
					frameMode: s.frameMode,
					aspect: s.aspect,
					sleep: s.sleep.mode
				},
				caps,
				events
			};
			// Defence in depth: nothing that looks like a local path leaves the device.
			return JSON.stringify(report, null, 2).replace(
				/(?<![A-Za-z])[A-Za-z]:[\\/][^"\s]*/g,
				'[path]'
			);
		},

		async destroy() {
			if (destroyed) return;
			const pending: Array<Promise<unknown>> = [];
			const item = state().item;
			if (item && itemStarted) {
				pending.push(progress.save('close', item.fileId, position(), duration() || null, true));
			}
			destroyed = true;
			progress.cancel();
			++gen;
			if (session) pending.push(api.deleteSession(session.sessionId));
			session = null;
			transport?.destroy();
			transport = null;
			removeTracks();
			resetSource();
			wakeLock.release();
			mediaSession.clear();
			sleepTimer.clear();
			detachVideo?.();
			detachVideo = null;
			wakeRetry?.();
			for (const id of timers) clearTimeout(id);
			timers.clear();
			cues.set([]);
			patch({
				status: 'idle',
				session: null,
				upNext: null,
				stillWatching: false,
				toasts: [],
				resume: null
			});
			await Promise.allSettled(pending);
		}
	};

	return engine;
}
