// Test double for an HTMLVideoElement and the document/window around it (node environment).
// It never plays anything: tests drive it with emit() and plain property writes, like a script.

export interface FakeCue {
	id: string;
	startTime: number;
	endTime: number;
	text: string;
}

export class FakeTextTrack extends EventTarget {
	mode: TextTrackMode = 'disabled';
	cues: FakeCue[] | null = null;
	activeCues: FakeCue[] | null = null;
	constructor(
		public kind: string,
		public label: string,
		public language: string
	) {
		super();
	}
	/** Simulates the browser finishing the WebVTT load. */
	setCues(cues: FakeCue[]) {
		this.cues = cues;
	}
	/** Simulates time marching onto `cues` and fires cuechange. */
	setActive(cues: FakeCue[]) {
		this.activeCues = cues;
		this.dispatchEvent(new Event('cuechange'));
	}
}

export class FakeTrackElement extends EventTarget {
	readonly tagName = 'TRACK';
	kind = '';
	src = '';
	srclang = '';
	label = '';
	default = false;
	parent: FakeMediaImpl | null = null;
	private _track: FakeTextTrack | null = null;
	get track(): FakeTextTrack {
		this._track ??= new FakeTextTrack(this.kind, this.label, this.srclang);
		return this._track;
	}
	remove() {
		this.parent?.removeTrack(this);
	}
	/** Simulates the WebVTT file arriving. */
	load(cues: FakeCue[]) {
		this.track.setCues(cues);
		this.dispatchEvent(new Event('load'));
	}
}

class FakeMediaMetadata {
	title: string;
	artist: string;
	album: string;
	artwork: MediaImage[];
	constructor(init: MediaMetadataInit = {}) {
		this.title = init.title ?? '';
		this.artist = init.artist ?? '';
		this.album = init.album ?? '';
		this.artwork = [...(init.artwork ?? [])];
	}
}

export class FakeMediaSession {
	metadata: FakeMediaMetadata | null = null;
	playbackState: MediaSessionPlaybackState = 'none';
	handlers = new Map<string, MediaSessionActionHandler | null>();
	positions: MediaPositionState[] = [];
	unsupported = new Set<string>();
	setActionHandler(action: string, handler: MediaSessionActionHandler | null) {
		if (this.unsupported.has(action)) throw new TypeError(`${action} is not supported`);
		this.handlers.set(action, handler);
	}
	setPositionState(state?: MediaPositionState) {
		if (state && (state.position ?? 0) > (state.duration ?? 0)) throw new TypeError('position');
		if (state) this.positions.push(state);
	}
}

export class FakeWakeLockSentinel extends EventTarget {
	released = false;
	readonly type = 'screen';
	async release() {
		if (this.released) return;
		this.released = true;
		this.dispatchEvent(new Event('release'));
	}
}

export class FakeWakeLock {
	requests = 0;
	sentinels: FakeWakeLockSentinel[] = [];
	fail = false;
	async request(): Promise<FakeWakeLockSentinel> {
		this.requests++;
		if (this.fail) throw new DOMException('Not allowed', 'NotAllowedError');
		const sentinel = new FakeWakeLockSentinel();
		this.sentinels.push(sentinel);
		return sentinel;
	}
	get active(): number {
		return this.sentinels.filter((s) => !s.released).length;
	}
}

export class FakeWindow extends EventTarget {
	innerWidth = 1440;
	innerHeight = 900;
	devicePixelRatio = 1;
	MediaMetadata = FakeMediaMetadata;
	media: Record<string, boolean> = {};
	navigator: {
		onLine: boolean;
		vendor: string;
		wakeLock?: FakeWakeLock;
		mediaSession?: FakeMediaSession;
	} = {
		onLine: true,
		vendor: 'Google Inc.',
		wakeLock: new FakeWakeLock(),
		mediaSession: new FakeMediaSession()
	};
	rafCallbacks: FrameRequestCallback[] = [];
	matchMedia(query: string) {
		return { matches: !!this.media[query] } as MediaQueryList;
	}
	requestAnimationFrame(callback: FrameRequestCallback): number {
		this.rafCallbacks.push(callback);
		return this.rafCallbacks.length;
	}
	/** Runs the queued animation frames once at time `t`. */
	frame(t: number) {
		const callbacks = this.rafCallbacks;
		this.rafCallbacks = [];
		for (const cb of callbacks) cb(t);
	}
}

export class FakeDocument extends EventTarget {
	visibilityState: DocumentVisibilityState = 'visible';
	fullscreenEnabled = true;
	fullscreenElement: unknown = null;
	pictureInPictureElement: unknown = null;
	pictureInPictureEnabled = true;
	defaultView: FakeWindow = new FakeWindow();
	get hidden() {
		return this.visibilityState === 'hidden';
	}
	createElement(tag: string) {
		if (tag !== 'track') throw new Error(`fake document cannot create <${tag}>`);
		return new FakeTrackElement();
	}
	async exitFullscreen() {
		this.fullscreenElement = null;
		this.dispatchEvent(new Event('fullscreenchange'));
	}
	async exitPictureInPicture() {
		const video = this.pictureInPictureElement as FakeMediaImpl | null;
		this.pictureInPictureElement = null;
		video?.dispatchEvent(new Event('leavepictureinpicture'));
	}
	/** Sets visibilityState and fires visibilitychange. */
	setVisibility(state: DocumentVisibilityState) {
		this.visibilityState = state;
		this.dispatchEvent(new Event('visibilitychange'));
	}
}

class FakeTimeRanges {
	constructor(private readonly ranges: Array<[number, number]>) {}
	get length() {
		return this.ranges.length;
	}
	start(i: number) {
		return this.ranges[i][0];
	}
	end(i: number) {
		return this.ranges[i][1];
	}
}

export class FakeMediaImpl extends EventTarget {
	readonly tagName = 'VIDEO';
	readonly ownerDocument = new FakeDocument();
	src = '';
	currentTime = 0;
	duration = Number.NaN;
	paused = true;
	ended = false;
	seeking = false;
	readyState = 0;
	declare volume: number;
	muted = false;
	playbackRate = 1;
	defaultPlaybackRate = 1;
	videoWidth = 0;
	videoHeight = 0;
	error: { code: number; message: string } | null = null;
	tracks: FakeTrackElement[] = [];
	/** Calls made by the code under test. */
	calls = { play: 0, pause: 0, load: 0 };
	/** When set, the next play() rejects with this error and the media stays paused. */
	rejectPlay: Error | null = null;
	/** Answers of canPlayType by MIME type ('' when absent). */
	canPlay: Record<string, string> = {};
	/** Simulates an iPhone, where volume always reads 1. */
	volumeLocked = false;
	frames = { droppedVideoFrames: 0, totalVideoFrames: 0 };
	private bufferedRanges: Array<[number, number]> = [];
	private attributes = new Map<string, string>();

	get buffered() {
		return new FakeTimeRanges(this.bufferedRanges) as unknown as TimeRanges;
	}
	get textTracks() {
		return this.tracks.map((t) => t.track);
	}
	setBuffered(ranges: Array<[number, number]>) {
		this.bufferedRanges = ranges;
	}
	emit(type: string) {
		this.dispatchEvent(new Event(type));
	}
	play(): Promise<void> {
		this.calls.play++;
		if (this.rejectPlay) {
			const error = this.rejectPlay;
			this.rejectPlay = null;
			return Promise.reject(error);
		}
		if (this.paused) {
			this.paused = false;
			this.emit('play');
		}
		return Promise.resolve();
	}
	pause() {
		this.calls.pause++;
		if (!this.paused) {
			this.paused = true;
			this.emit('pause');
		}
	}
	load() {
		this.calls.load++;
		this.readyState = 0;
		this.paused = true;
	}
	canPlayType(type: string) {
		return this.canPlay[type] ?? '';
	}
	getVideoPlaybackQuality() {
		return { ...this.frames, creationTime: 0, corruptedVideoFrames: 0 };
	}
	setAttribute(name: string, value: string) {
		this.attributes.set(name, value);
	}
	getAttribute(name: string) {
		return this.attributes.get(name) ?? null;
	}
	removeAttribute(name: string) {
		this.attributes.delete(name);
		if (name === 'src') this.src = '';
	}
	appendChild<T>(child: T): T {
		if (child instanceof FakeTrackElement) {
			child.parent = this;
			this.tracks.push(child);
		}
		return child;
	}
	removeTrack(child: FakeTrackElement) {
		this.tracks = this.tracks.filter((t) => t !== child);
		child.parent = null;
	}
	async requestPictureInPicture() {
		this.ownerDocument.pictureInPictureElement = this;
		this.emit('enterpictureinpicture');
		return {} as PictureInPictureWindow;
	}
	/** Simulates the metadata of a 16:9 picture arriving. */
	loadMetadata(duration: number, width = 1920, height = 1080) {
		this.duration = duration;
		this.videoWidth = width;
		this.videoHeight = height;
		this.readyState = 1;
		this.emit('loadedmetadata');
		this.emit('durationchange');
	}
	/** Simulates enough data to play (canplay), optionally starting playback (playing). */
	ready() {
		this.readyState = 4;
		this.emit('canplay');
	}
}

// Volume reads back as 1 on a locked (iPhone-like) element.
Object.defineProperty(FakeMediaImpl.prototype, 'volume', {
	get(this: FakeMediaImpl & { _volume?: number }) {
		return this.volumeLocked ? 1 : (this._volume ?? 1);
	},
	set(this: FakeMediaImpl & { _volume?: number }, value: number) {
		if (!this.volumeLocked) this._volume = value;
		this.dispatchEvent(new Event('volumechange'));
	},
	configurable: true
});

export type FakeMedia = HTMLVideoElement & {
	emit(type: string): void;
	setBuffered(ranges: Array<[number, number]>): void;
	/** The fake itself, for scripted state and inspection. */
	fake: FakeMediaImpl;
	doc: FakeDocument;
	win: FakeWindow;
};

export function createFakeMedia(): FakeMedia {
	const media = new FakeMediaImpl();
	const out = media as unknown as FakeMedia;
	Object.defineProperties(out, {
		fake: { value: media },
		doc: { value: media.ownerDocument },
		win: { value: media.ownerDocument.defaultView }
	});
	return out;
}
