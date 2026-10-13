// PlayerSource adapter for official trailers through the YouTube IFrame Player
// API on the privacy-enhanced host. This is the only file in the app allowed
// to name that host; the embed element is created by the API, never by hand.

import { isYouTubeKey } from '$lib/tmdb/images';
import type { Capabilities, LoadOptions, PlayerEvent, PlayerSnapshot, PlayerSource } from './types';

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const API_SRC = 'https://www.youtube.com/iframe_api';
const POLL_MS = 250;
const AUTOPLAY_GRACE_MS = 1500;
const DEFAULT_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	setPlaybackRate(rate: number): void;
	getAvailablePlaybackRates(): number[];
	setVolume(volume: number): void;
	mute(): void;
	unMute(): void;
	getCurrentTime(): number;
	getDuration(): number;
	getVideoLoadedFraction(): number;
	getPlayerState(): number;
	loadModule(name: string): void;
	unloadModule(name: string): void;
	setOption(module: string, option: string, value: unknown): void;
	getIframe(): HTMLIFrameElement;
	destroy(): void;
}

interface YTNamespace {
	Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
	PlayerState: {
		UNSTARTED: -1;
		ENDED: 0;
		PLAYING: 1;
		PAUSED: 2;
		BUFFERING: 3;
		CUED: 5;
	};
}

declare global {
	interface Window {
		YT?: YTNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let apiPromise: Promise<YTNamespace> | null = null;

// The API script is injected once per page session and cached; the player
// element itself is created and destroyed with each source.
function loadApi(): Promise<YTNamespace> {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT?.Player) resolve(window.YT);
			else reject(new Error('YouTube API did not initialise'));
		};
		const script = document.createElement('script');
		script.src = API_SRC;
		script.async = true;
		script.onerror = () => {
			apiPromise = null;
			reject(new Error('YouTube API failed to load'));
		};
		document.head.append(script);
	});
	return apiPromise;
}

const INITIAL: PlayerSnapshot = {
	status: 'idle',
	position: 0,
	duration: 0,
	buffered: 0,
	rate: 1,
	volume: 1,
	muted: false,
	captions: false
};

export function createYouTubeSource(videoKey: string): PlayerSource {
	if (!isYouTubeKey(videoKey)) throw new Error('Invalid YouTube video key');

	let player: YTPlayer | null = null;
	let snapshot: PlayerSnapshot = { ...INITIAL };
	const handlers = new Map<PlayerEvent, Set<(snapshot: PlayerSnapshot) => void>>();
	let timer: number | null = null;
	let destroyed = false;

	function emit(event: PlayerEvent) {
		for (const handler of handlers.get(event) ?? []) handler(snapshot);
	}

	function patch(partial: Partial<PlayerSnapshot>, event: PlayerEvent = 'state') {
		snapshot = { ...snapshot, ...partial };
		emit(event);
	}

	function tick() {
		if (!player) return;
		const duration = player.getDuration() || 0;
		patch(
			{
				position: player.getCurrentTime() || 0,
				duration,
				buffered: (player.getVideoLoadedFraction() || 0) * duration
			},
			'time'
		);
	}

	function startPolling() {
		if (timer !== null) return;
		timer = window.setInterval(tick, POLL_MS);
	}

	function stopPolling() {
		if (timer !== null) window.clearInterval(timer);
		timer = null;
	}

	function onStateChange(state: number, YT: YTNamespace) {
		const map: Record<number, PlayerSnapshot['status']> = {
			[YT.PlayerState.PLAYING]: 'playing',
			[YT.PlayerState.PAUSED]: 'paused',
			[YT.PlayerState.BUFFERING]: 'buffering',
			[YT.PlayerState.ENDED]: 'ended',
			[YT.PlayerState.CUED]: 'ready',
			[YT.PlayerState.UNSTARTED]: 'ready'
		};
		const status = map[state] ?? snapshot.status;
		if (status === 'playing') startPolling();
		else stopPolling();
		tick();
		patch({ status });
	}

	return {
		async load(container: HTMLElement, options: LoadOptions) {
			patch({ status: 'loading', captions: options.captions });
			const YT = await loadApi();
			if (destroyed) return;
			const mount = document.createElement('div');
			container.replaceChildren(mount);
			await new Promise<void>((resolve, reject) => {
				player = new YT.Player(mount, {
					host: YOUTUBE_EMBED_ORIGIN,
					videoId: videoKey,
					width: '100%',
					height: '100%',
					playerVars: {
						autoplay: options.autoplay ? 1 : 0,
						controls: 0,
						disablekb: 1,
						playsinline: 1,
						rel: 0,
						iv_load_policy: 3,
						modestbranding: 1,
						enablejsapi: 1,
						origin: window.location.origin,
						start: Math.max(0, Math.floor(options.startAt)),
						cc_load_policy: options.captions ? 1 : 0
					},
					events: {
						onReady: () => {
							try {
								player?.getIframe().setAttribute('title', `Trailer ${videoKey}`);
							} catch {
								// The title is a courtesy; the dialog already names the player.
							}
							patch({ status: 'ready', duration: player?.getDuration() || 0 });
							resolve();
						},
						onStateChange: (event: { data: number }) => onStateChange(event.data, YT),
						onError: (event: { data: number }) => {
							patch({ status: 'error', error: `YouTube error ${event.data}` }, 'error');
							reject(new Error(snapshot.error));
						}
					}
				});
			});
			if (options.autoplay) {
				// Mobile browsers may refuse autoplay: if nothing starts within the
				// grace period the shell shows a Play label instead of a black stage.
				window.setTimeout(() => {
					if (!destroyed && snapshot.status === 'ready') emit('autoplayblocked');
				}, AUTOPLAY_GRACE_MS);
			}
		},
		play: () => player?.playVideo(),
		pause: () => player?.pauseVideo(),
		seek: (seconds) => {
			player?.seekTo(Math.max(0, seconds), true);
			if (player) tick();
		},
		setRate: (rate) => {
			player?.setPlaybackRate(rate);
			patch({ rate });
		},
		setVolume: (level) => {
			player?.setVolume(Math.round(level * 100));
			patch({ volume: level });
		},
		setMuted: (muted) => {
			if (muted) player?.mute();
			else player?.unMute();
			patch({ muted });
		},
		setCaptions: (on) => {
			try {
				if (on) {
					player?.loadModule('captions');
					player?.setOption('captions', 'track', {});
				} else {
					player?.unloadModule('captions');
				}
			} catch {
				// The captions module is best-effort; YouTube may not expose it.
			}
			patch({ captions: on });
		},
		getState: () => snapshot,
		on: (event, handler) => {
			const set = handlers.get(event) ?? new Set();
			set.add(handler);
			handlers.set(event, set);
			return () => {
				set.delete(handler);
			};
		},
		capabilities: (): Capabilities => ({
			fullscreen: true,
			pip: false,
			captions: true,
			rates: player?.getAvailablePlaybackRates?.() ?? DEFAULT_RATES,
			boost: false,
			qualities: ['Auto']
		}),
		destroy: () => {
			destroyed = true;
			stopPolling();
			try {
				player?.destroy();
			} catch {
				// Already gone.
			}
			player = null;
			handlers.clear();
		}
	};
}
