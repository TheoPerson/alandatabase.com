// Test double for the hls.js light class: records its config and calls, and fires scripted events.

type Handler = (event: string, data: unknown) => void;

export class FakeHls {
	static Events = { ERROR: 'hlsError', FRAG_LOADED: 'hlsFragLoaded' };
	static ErrorTypes = {
		NETWORK_ERROR: 'networkError',
		MEDIA_ERROR: 'mediaError',
		MUX_ERROR: 'muxError',
		OTHER_ERROR: 'otherError'
	};
	static supported = true;
	static isSupported = () => FakeHls.supported;
	static instances: FakeHls[] = [];
	static reset() {
		FakeHls.instances = [];
		FakeHls.supported = true;
	}
	handlers = new Map<string, Handler[]>();
	source: string | null = null;
	media: unknown = null;
	startLoads: number[] = [];
	recovers = 0;
	destroyed = false;
	constructor(public config: Record<string, unknown>) {
		FakeHls.instances.push(this);
	}
	on(event: string, fn: Handler) {
		this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
	}
	loadSource(url: string) {
		this.source = url;
	}
	attachMedia(media: unknown) {
		this.media = media;
	}
	startLoad(position: number) {
		this.startLoads.push(position);
	}
	recoverMediaError() {
		this.recovers++;
	}
	destroy() {
		this.destroyed = true;
	}
	fire(event: string, data: unknown) {
		for (const fn of this.handlers.get(event) ?? []) fn(event, data);
	}
	/** A fatal error of `type` (networkError carries an HTTP `code`). */
	error(type: string, details: string, code?: number) {
		this.fire(FakeHls.Events.ERROR, {
			type,
			details,
			fatal: true,
			response: code === undefined ? undefined : { code }
		});
	}
	/** A loaded fragment: `bytes` over `duration` seconds of media, fetched in `loadMs`. */
	frag(bytes: number, duration: number, loadMs: number) {
		this.fire(FakeHls.Events.FRAG_LOADED, {
			frag: {
				duration,
				stats: { loaded: bytes, loading: { start: 1000, first: 1000, end: 1000 + loadMs } }
			}
		});
	}
}
