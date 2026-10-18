// Alan's HQP engine contract. Pure types: safe to import from server code.
// hls.js/light ships no .d.ts: the engine adds src/lib/player/hqp/hls-light.d.ts containing
//   declare module 'hls.js/light' { export { default } from 'hls.js'; export * from 'hls.js'; }
import type HlsDefault from 'hls.js';
import type {
	Chapter,
	ClientCaps,
	HdrKind,
	PlayableFile,
	PlaybackSession,
	ProgressEntry,
	QualityLevel,
	TrickplayManifest
} from '$lib/media/types';

/** Svelte-compatible store contract: subscribe calls run synchronously with the current value. */
export interface Readable<T> {
	subscribe(run: (value: T) => void): () => void;
}

export type HqpStatus =
	| 'idle'
	| 'starting' // fetching caps and creating the session
	| 'loading' // source attached, waiting for the first frame
	| 'playing'
	| 'paused'
	| 'buffering'
	| 'switching' // quality or audio restart in progress
	| 'ended'
	| 'error';

export type QualityChoice = 'auto' | QualityLevel;
export type FrameMode = 'fit' | 'fill';
/** Picture aspect classes for remembering Fit/Fill: <= 1.85, <= 2.2, > 2.2. */
export type AspectClass = 'standard' | 'wide' | 'scope';
export type SleepMode = 'off' | 'end-of-item' | 15 | 30 | 60;
export type Delivery = 'native' | 'hls.js';

export interface HqpArtwork {
	stillPath: string | null; // TMDB path, 16:9: the episode still, or the film backdrop
	backdropPath: string | null;
	posterPath: string | null;
	logoPath: string | null;
}

export interface HqpItem {
	fileId: string;
	kind: 'movie' | 'episode';
	title: string; // film title, or episode name ("Episode 3" when unnamed)
	showTitle: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	overview: string | null;
	year: number | null;
	runtimeMinutes: number | null;
	originalLanguage: string | null; // ISO 639-1 from TMDB ('en'); marks the VO audio track
	artwork: HqpArtwork;
	titleHref: string; // /movies/<id>, /tv/<tmdbId>?season=<n>, or /my/films?tab=local
	file: PlayableFile;
	progress: ProgressEntry | null; // saved progress when the page was loaded
}

export interface HqpLaunchPayload {
	queue: HqpItem[]; // film: [film]; series: every local episode of the show, (season, episode) order
	index: number; // the item to play
	returnHref: string; // where Close goes when there is no in-site history entry
}

export interface HqpLoadOptions {
	startAt?: number | 'resume'; // default 'resume'
	autoplay?: boolean; // default true
}

export type HqpErrorCode =
	| 'unauthorized' // 401
	| 'forbidden' // 403
	| 'not-found' // 404
	| 'gone' // 409: the file moved or was deleted
	| 'library-offline' // 503
	| 'bad-request' // 400
	| 'network'
	| 'decode'
	| 'unsupported' // no native HLS and no MSE
	| 'unknown';

export interface HqpError {
	code: HqpErrorCode;
	status: number | null;
	message: string; // the server's { error } text when present, else a plain sentence
	fallback: QualityLevel | null; // a converted level worth offering ("Try 1080p (converted)")
}

export interface HqpAudioOption {
	ordinal: number;
	label: string;
	language: string | null; // ISO 639-2
	title: string | null;
	channels: number | null;
	codec: string | null; // null until the contract carries it
	isOriginal: boolean; // language matches item.originalLanguage
	selected: boolean;
}

export interface HqpSubtitleOption {
	ordinal: number;
	label: string;
	language: string | null;
	title: string | null;
	forced: boolean;
	sdh: boolean; // title matches /sdh|\bcc\b|sourds|malentendants|hearing/i
	isText: boolean; // false = image subtitles (PGS): listed, never selectable
	url: string | null; // WebVTT URL from the session; null for image subtitles
}

export interface HqpSubtitleState {
	options: HqpSubtitleOption[];
	selected: number | null; // the user's (or policy's) full track; null = Off
	forced: number | null; // forced track rendered while selected is null
	offsetSeconds: number; // -10..10 in 0.1 steps
}

export interface HqpCueSpan {
	text: string;
	italic: boolean;
	bold: boolean;
}

export interface HqpCue {
	id: string;
	lines: HqpCueSpan[][];
}

export interface HqpUpNext {
	index: number;
	item: HqpItem;
	reason: 'credits' | 'end';
	countdownEndsAt: number | null; // epoch ms; null = no countdown running
}

export interface HqpToast {
	id: number;
	kind: 'info' | 'warning' | 'error';
	text: string;
	action: { label: string; run: () => void } | null;
	until: number; // epoch ms
}

export interface HqpState {
	status: HqpStatus;
	autoplayBlocked: boolean;
	queue: HqpItem[];
	index: number;
	item: HqpItem | null;
	session: PlaybackSession | null;
	delivery: Delivery | null;
	caps: ClientCaps | null;
	quality: { choice: QualityChoice; active: QualityLevel | null; available: QualityLevel[] };
	audio: { options: HqpAudioOption[]; mode: 'copy' | 'transcode' | null };
	subtitles: HqpSubtitleState;
	chapters: Chapter[];
	chapterIndex: number; // -1 without chapters
	skipIntro: { end: number } | null;
	trickplay: TrickplayManifest | null; // null until ensureTrickplay() resolved
	rate: number;
	held: boolean; // long-press 2x active
	volume: number;
	muted: boolean;
	frameMode: FrameMode; // for the current aspect class
	aspect: number | null; // videoWidth / videoHeight once known
	hdrShown: boolean; // HDR stream on an HDR display
	resume: { from: number; until: number } | null; // "Resumed at" notice, until = epoch ms
	upNext: HqpUpNext | null;
	stillWatching: boolean;
	sleep: { mode: SleepMode; endsAt: number | null };
	pip: boolean;
	airplay: { available: boolean; active: boolean };
	fullscreen: boolean;
	online: boolean;
	toasts: HqpToast[];
	error: HqpError | null;
	announcement: { id: number; text: string } | null; // polite live region
}

export interface HqpClock {
	position: number;
	duration: number;
	bufferedEnd: number; // end of the buffered range containing position (position when none)
	ranges: Array<[number, number]>;
}

export interface HqpMetrics {
	sessionId: string | null;
	delivery: Delivery | null;
	videoMode: 'copy' | 'transcode' | null;
	reason: string | null;
	codec: string | null;
	profile: string | null;
	width: number | null;
	height: number | null;
	frameRate: number | null;
	bitDepth: 8 | 10 | null;
	hdr: HdrKind;
	hdrShown: boolean;
	audio: {
		label: string | null;
		codec: string | null;
		channels: number | null;
		mode: 'copy' | 'transcode' | null;
	};
	subtitles: string | null; // "SRT → WebVTT · French forced", or null when off
	segmentSeconds: number | null;
	bitrate: { measured: number | null; file: number | null }; // bits per second
	throughput: number | null; // bits per second; null when not measurable (native HLS)
	bufferAhead: number; // seconds
	frames: { dropped: number; total: number } | null;
	screen: { width: number; height: number; dpr: number; refreshHz: number | null; hdr: boolean };
	quality: { choice: QualityChoice; active: QualityLevel | null };
}

export interface HqpSubtitleStyle {
	size: 's' | 'm' | 'l' | 'xl';
	background: 'shadow' | 'outline' | 'box';
	color: 'white' | 'yellow';
	position: 'auto' | 'low';
}

export interface HqpPrefs {
	version: 1;
	quality: QualityChoice; // default 'auto'
	volume: number; // 0..1, default 1
	muted: boolean;
	audioLanguage: string | null; // ISO 639-2; null = server default (French first)
	subtitleMode: 'auto' | 'on' | 'off'; // default 'auto'
	subtitleLanguage: string; // ISO 639-2, default 'fre'
	subtitleStyle: HqpSubtitleStyle; // default m, shadow, white, auto
	autoplayNext: boolean; // default true
	autoHideMs: 2000 | 3000 | 5000; // default 3000
	frameModes: Record<AspectClass, FrameMode>; // default all 'fit'
	liteGlass: boolean; // default false
	resume: boolean; // default true
	hints: { fineScrub: boolean; homeScreen: boolean }; // true once shown
}

export type HqpPrefsPatch = Partial<
	Omit<HqpPrefs, 'version' | 'subtitleStyle' | 'frameModes' | 'hints'>
> & {
	subtitleStyle?: Partial<HqpSubtitleStyle>;
	frameModes?: Partial<Record<AspectClass, FrameMode>>;
	hints?: Partial<HqpPrefs['hints']>;
};

/** Injectable browser probes for capability detection (tests pass fakes). */
export interface CapsProbe {
	vendor: string;
	canPlayType(type: string): string;
	mseIsTypeSupported: ((type: string) => boolean) | null; // MediaSource or ManagedMediaSource
	hlsJsSupported: boolean;
	matchMedia(query: string): boolean;
	decodingInfo:
		| ((
				config: MediaDecodingConfiguration
		  ) => Promise<{ supported: boolean; powerEfficient: boolean }>)
		| null;
}

export interface HqpEngineOptions {
	fetch?: typeof fetch;
	now?: () => number;
	storage?: Storage | null; // localStorage for prefs (guarded; null = memory only)
	sessionStorage?: Storage | null; // caps cache and overrides
	loadHls?: () => Promise<typeof HlsDefault>; // default: () => import('hls.js/light').then((m) => m.default)
	probe?: (video: HTMLVideoElement) => CapsProbe; // default: browser probe
	onItemChange?: (item: HqpItem, index: number) => void;
}

export type HqpShortcutAction =
	| 'toggle'
	| 'back10'
	| 'forward10'
	| 'back5'
	| 'forward5'
	| 'prevChapter'
	| 'nextChapter'
	| 'volumeUp'
	| 'volumeDown'
	| 'mute'
	| 'fullscreen'
	| 'subtitles'
	| 'audioNext'
	| 'tracks'
	| 'info'
	| 'episodes'
	| 'nextItem'
	| 'pip'
	| 'percent'
	| 'home'
	| 'end'
	| 'frameBack'
	| 'frameForward'
	| 'slower'
	| 'faster'
	| 'help'
	| 'escape';

export interface HqpShortcut {
	keys: string[];
	shift?: boolean;
	action: HqpShortcutAction;
	label: string;
	display: string;
}

export interface HqpEngine {
	readonly snapshot: Readable<HqpState>;
	readonly clock: Readable<HqpClock>;
	readonly cues: Readable<HqpCue[]>;
	readonly prefs: Readable<HqpPrefs>;
	attach(video: HTMLVideoElement): void;
	load(payload: HqpLaunchPayload, options?: HqpLoadOptions): Promise<void>;
	play(): Promise<void>;
	pause(): void;
	toggle(): void;
	seek(seconds: number): void;
	skip(deltaSeconds: number): void;
	seekChapter(direction: 1 | -1): void;
	stepFrame(direction: 1 | -1): void;
	startOver(): void;
	setRate(rate: number): void;
	holdRate(on: boolean): void;
	setVolume(level: number): void;
	setMuted(muted: boolean): void;
	setQuality(choice: QualityChoice): Promise<void>;
	setAudio(ordinal: number): Promise<void>;
	cycleAudio(): Promise<void>;
	setSubtitles(ordinal: number | null): void;
	toggleSubtitles(): void;
	setSubtitleOffset(seconds: number): void;
	setFrameMode(mode: FrameMode): void;
	playIndex(index: number): Promise<void>;
	next(): Promise<void>;
	cancelUpNext(): void;
	confirmStillWatching(): void;
	setSleep(mode: SleepMode): void;
	togglePip(): Promise<void>;
	showAirPlayPicker(): void;
	toggleFullscreen(target: HTMLElement): Promise<void>;
	setClockRate(hz: 1 | 4): void;
	noteInteraction(): void; // any user input: resets the autoplay counter, pauses the countdown 2 s
	retry(): Promise<void>;
	dismissToast(id: number): void;
	ensureTrickplay(): Promise<TrickplayManifest | null>;
	updatePrefs(patch: HqpPrefsPatch): void;
	metrics(): HqpMetrics;
	diagnostics(): string; // JSON: metrics, state summary, caps, last 20 events; never a file path
	destroy(): Promise<void>; // saves progress, deletes the session, releases everything
}
